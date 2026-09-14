import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import '../styles/systemoverview.scss';

interface SystemOverviewProps {
    searchQuery: string;
    darkMode: boolean;
}

const SystemOverview: React.FC<SystemOverviewProps> = ({ searchQuery, darkMode }) => {
    
    // --- Mock Data & Animation State ---
    const targetCredits = 54321500; 
    const [displayCredits, setDisplayCredits] = useState(0); 
    const [agents] = useState({ standard: 12, supervisor: 3, collaborator: 8 });

    // --- Counter Animation Effect ---
    useEffect(() => {
        let startTimestamp: number | null = null;
        const duration = 1500; // Animation duration in milliseconds

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Ease-out cubic formula for smooth deceleration at the end
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            setDisplayCredits(Math.floor(easeOut * targetCredits));

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setDisplayCredits(targetCredits); // Lock exactly on target
            }
        };

        window.requestAnimationFrame(step);
    }, [targetCredits]);
    
    const radarData = [
        { axis: "RAG Retrieval", value: 0.8 },
        { axis: "Code Interpreter", value: 0.4 },
        { axis: "Web Search", value: 0.9 },
        { axis: "Workflows", value: 0.6 },
        { axis: "Custom MCP", value: 0.3 }
    ];

    const circularData = [
        { name: "Shopify", value: 85 }, { name: "SAP ERP", value: 40 },
        { name: "Salesforce", value: 65 }, { name: "Zendesk", value: 30 },
        { name: "PowerPoint", value: 90 }, { name: "Luma Video", value: 75 },
        { name: "Datadog", value: 50 }, { name: "Jira Agile", value: 60 }
    ];

    const allSessions = [
        { id: "S-101", title: "Q3 Financial Data Analysis", status: "ACTIVE" },
        { id: "S-102", title: "Shopify Campaign Launch", status: "ARCHIVED" },
        { id: "S-103", title: "Salesforce Pipeline Audit", status: "ACTIVE" }
    ];

    const allArtifacts = [
        { id: "A-1", name: "Q3_Report.pptx", type: "DOCUMENT" },
        { id: "A-2", name: "Promo_Ad_V2.mp4", type: "VIDEO" },
        { id: "A-3", name: "Inventory_Restock.csv", type: "DOCUMENT" },
        { id: "A-4", name: "Voice_Script.mp3", type: "AUDIO" }
    ];

    const promptWords = [
        { text: "Strict", size: 40 }, { text: "Analyze", size: 25 }, 
        { text: "Professional", size: 35 }, { text: "Creative", size: 20 },
        { text: "Execute", size: 45 }, { text: "Format", size: 15 },
        { text: "Data", size: 30 }, { text: "Synthesize", size: 38 }
    ];

    // Filtered data based on search query
    const filteredSessions = allSessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredArtifacts = allArtifacts.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // --- D3 Refs ---
    const radarRef = useRef<SVGSVGElement>(null);
    const circularRef = useRef<SVGSVGElement>(null);
    const heatmapRef = useRef<SVGSVGElement>(null);
    const cloudRef = useRef<SVGSVGElement>(null);

    // --- D3: Active Agents Radar Chart ---
    useEffect(() => {
        if (!radarRef.current) return;
        d3.select(radarRef.current).selectAll("*").remove();

        const width = 200, height = 200, radius = Math.min(width, height) / 2 - 20;
        const svg = d3.select(radarRef.current).attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);
        
        const angleSlice = (Math.PI * 2) / radarData.length;
        const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);

        // Draw grid circles
        svg.selectAll(".gridCircle").data([0.25, 0.5, 0.75, 1]).enter().append("circle")
           .attr("r", (d: number) => rScale(d))
           .style("fill", "none").style("stroke", darkMode ? "#374151" : "#e5e7eb").style("stroke-dasharray", "3,3");

        // Draw radar blob
        const radarLine = d3.lineRadial<{axis: string, value: number}>().angle((_, i) => i * angleSlice).radius(d => rScale(d.value)).curve(d3.curveLinearClosed);
        
        svg.append("path")
           .datum(radarData)
           .attr("d", radarLine)
           .style("fill", "#0891b2").style("fill-opacity", 0.3)
           .style("stroke", "#0891b2").style("stroke-width", 2);
    }, [darkMode]);

    // --- D3: Execution Affinity Circular Barplot ---
    useEffect(() => {
        if (!circularRef.current) return;
        d3.select(circularRef.current).selectAll("*").remove();

        const width = 250, height = 250, innerRadius = 40, outerRadius = Math.min(width, height) / 2 - 10;
        const svg = d3.select(circularRef.current).attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const x = d3.scaleBand().range([0, 2 * Math.PI]).domain(circularData.map(d => d.name));
        const y = d3.scaleRadial().range([innerRadius, outerRadius]).domain([0, 100]);

        const arc = d3.arc<any>()
            .innerRadius(innerRadius)
            .outerRadius((d: any) => y(d.value))
            .startAngle((d: any) => x(d.name) as number)
            .endAngle((d: any) => (x(d.name) as number) + x.bandwidth())
            .padAngle(0.05).padRadius(innerRadius);

        svg.append("g").selectAll("path").data(circularData).enter().append("path")
            .attr("fill", "#800020")
            .attr("d", arc as any)
            .style("transition", "all 0.3s")
            // Fixed TypeScript event/this shadowing using arrow functions and currentTarget
            .on("mouseover", (event: any) => { d3.select(event.currentTarget).attr("fill", "#c00030"); })
            .on("mouseout", (event: any) => { d3.select(event.currentTarget).attr("fill", "#800020"); });
            
    }, [darkMode]);

    // --- D3: Calendar Heatmap (Mini) ---
    useEffect(() => {
        if (!heatmapRef.current) return;
        d3.select(heatmapRef.current).selectAll("*").remove();
        const width = 250, height = 80;
        const svg = d3.select(heatmapRef.current).attr("viewBox", `0 0 ${width} ${height}`);
        
        const data = Array.from({length: 84}, () => Math.floor(Math.random() * 5));
        const color = d3.scaleLinear<string>().domain([0, 4]).range(darkMode ? ["#1f2937", "#10b981"] : ["#e5e7eb", "#10b981"]);

        svg.selectAll("rect").data(data).enter().append("rect")
            .attr("x", (_: number, i: number) => Math.floor(i / 7) * 12)
            .attr("y", (_: number, i: number) => (i % 7) * 12)
            .attr("width", 10).attr("height", 10)
            .attr("rx", 2)
            .style("fill", (d: number) => color(d));
    }, [darkMode]);

    // --- D3: Word Cloud ---
    useEffect(() => {
        if (!cloudRef.current) return;
        d3.select(cloudRef.current).selectAll("*").remove();
        const width = 250, height = 150;
        const svg = d3.select(cloudRef.current).attr("viewBox", `0 0 ${width} ${height}`);

        const simulation = d3.forceSimulation(promptWords as any)
            .force("charge", d3.forceManyBody().strength(-15))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius((d: any) => d.size * 0.8));

        const text = svg.selectAll("text").data(promptWords).enter().append("text")
            .text((d: any) => d.text)
            .style("font-size", (d: any) => `${d.size}px`)
            .style("fill", darkMode ? "#9ca3af" : "#4b5563")
            .style("font-weight", "bold")
            .style("text-anchor", "middle");

        simulation.on("tick", () => {
            text.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
        });
    }, [darkMode]);

    return (
        <div className="system-overview-grid">
            
            {/* LINE 1 */}
            <div className="so-row line-1">
                {/* 1. Added minWidth: 0 to the card container */}
                <div className="ft-card stat-counter flash-card" style={{ minWidth: 0 }}>
                    <span className="label">Compute Credits Available</span>
                    
                    {/* 2. Added wordBreak and lineHeight to force the number onto the next line gracefully */}
                    <h1 
                        className="metric" 
                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word', lineHeight: '1.2', fontFamily: 'Google Sans Code' }}
                    >
                        {displayCredits.toLocaleString()}
                    </h1>
                    
                    <span className="trend positive">Runway: ~14 Days</span>
                    <br/><br/><br/><br/><br/><br/>
                </div>
                
                <div className="ft-card workforce-card">
                    <span className="label">Agentic Workforce</span>
                    <div className="role-breakdown">
                        <div className="role"><i className='bx bx-bot'></i> {agents.standard} <span>Standard</span></div>
                        <div className="role"><i className='bx bx-sitemap'></i> {agents.supervisor} <span>Supervisor</span></div>
                        <div className="role"><i className='bx bx-group'></i> {agents.collaborator} <span>Collaborator</span></div>
                    </div>
                </div>

                <div className="ft-card d3-card">
                    <span className="label">Active Agents Radar</span>
                    <svg ref={radarRef}></svg>
                </div>
            </div>

            {/* LINE 2 */}
            <div className="so-row line-2">
                <div className="ft-card d3-card">
                    <span className="label">Execution Affinity</span>
                    <svg ref={circularRef}></svg>
                </div>
                
                <div className="ft-card stat-counter">
                    <span className="label">Knowledge Vault</span>
                    <h1 className="metric">142</h1>
                    <span className="trend neutral">Indexed Vectors</span>
                    <br/><br/><br/><br/><br/><br/>
                </div>

                <div className="ft-card d3-card">
                    <span className="label">Productivity Map</span>
                    <svg ref={heatmapRef} style={{marginTop: '1rem'}}></svg>
                    <br/><br/><br/><br/>
                </div>
            </div>

            {/* LINE 3 */}
            <div className="so-row line-3">
                <div className="ft-card quick-actions-card">
                    <span className="label">Quick Actions</span>
                    <div className="action-buttons">
                        <button className="neu-action-btn">
                            <i className="bx bx-plus-circle"></i> Create Context Profile
                        </button>
                        <button className="neu-action-btn">
                            <i className="bx bx-cloud-upload"></i> Add Vector Document
                        </button>
                        <button className="neu-action-btn">
                            <i className="bx bx-git-branch"></i> Create Automation Workflow
                        </button>
                    </div>
                </div>

                <div className="ft-card list-card">
                    <span className="label">Recent Terminal Sessions</span>
                    <div className="list-wrapper">
                        {filteredSessions.length === 0 ? <p className="no-data">No matching sessions.</p> : 
                            filteredSessions.map(s => (
                                <div className="list-item" key={s.id}>
                                    <span className="item-title">{s.title}</span>
                                    <span className={`badge ${s.status === 'ACTIVE' ? 'success' : 'neutral'}`}>{s.status}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>

            {/* LINE 4 */}
            <div className="so-row line-4">
                <div className="ft-card list-card">
                    <span className="label">Recent Artifacts Gallery</span>
                    <div className="gallery-grid">
                        {filteredArtifacts.length === 0 ? <p className="no-data">No matching artifacts.</p> : 
                            filteredArtifacts.map(a => (
                                <div className="gallery-item" key={a.id}>
                                    <i className={`bx ${a.type === 'VIDEO' ? 'bx-video' : a.type === 'AUDIO' ? 'bx-headphone' : 'bx-file'}`}></i>
                                    <span>{a.name}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div className="ft-card d3-card">
                    <span className="label">System Prompt Focus</span>
                    <svg ref={cloudRef}></svg>
                </div>
            </div>

        </div>
    );
};

export default SystemOverview;