import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import '../styles/systemoverview.scss';

interface AgentsTelemetryProps {
    searchQuery: string;
    darkMode: boolean;
}

const AgentsTelemetry: React.FC<AgentsTelemetryProps> = ({ searchQuery, darkMode }) => {
    // --- Enterprise D3 Color Palette ---
    const d3Colors = darkMode ? 
        { text: "#9ca3af", title: "#f9fafb", grid: "#374151", accent1: "#8b5cf6", accent2: "#3b82f6", accent3: "#10b981", accent4: "#f59e0b", bg: "#1f2937", surface: "#111827" } : 
        { text: "#6b7280", title: "#111827", grid: "#e5e7eb", accent1: "#7c3aed", accent2: "#2563eb", accent3: "#059669", accent4: "#d97706", bg: "#ffffff", surface: "#f9fafb" };

    // --- D3 Refs ---
    const streamRef = useRef<SVGSVGElement>(null);
    const networkRef = useRef<SVGSVGElement>(null);
    const arcRef = useRef<SVGSVGElement>(null);
    const chordRef = useRef<SVGSVGElement>(null);
    const connectedScatterRef = useRef<SVGSVGElement>(null);
    const bundlingRef = useRef<SVGSVGElement>(null);

    // --- Mock Schema-Aligned Data (Global Admin Scoped) ---

    // 1. Streamgraph: Global Workload Evolution (System-wide Token volume by Agent Role)
    const streamData = Array.from({length: 30}, (_, i) => ({
        day: i,
        "Supervisors": Math.abs(Math.sin(i / 5) * 50000 + 10000 + Math.random() * 5000),
        "Collaborators": Math.abs(Math.cos(i / 4) * 30000 + 20000 + Math.random() * 5000),
        "Standard": Math.abs(Math.sin(i / 3) * 40000 + 5000 + Math.random() * 8000)
    }));

    // 2. Global Network Graph (Hubs mapping global Profile archetypes to major tools)
    const networkNodes = [
        { id: "Sup_Routing", group: 1, label: "Global Routers" },
        { id: "Collab_Code", group: 2, label: "Code Interpreters" },
        { id: "Collab_Data", group: 2, label: "Data Analysts" },
        { id: "Collab_Web", group: 2, label: "Web Searchers" },
        { id: "Tool_DB", group: 3, label: "Postgres MCP" },
        { id: "Tool_Luma", group: 3, label: "Luma API" },
        { id: "Vec_Global", group: 4, label: "Enterprise Vectors" }
    ];
    const networkLinks = [
        { source: "Sup_Routing", target: "Collab_Code", value: 8 },
        { source: "Sup_Routing", target: "Collab_Data", value: 10 },
        { source: "Sup_Routing", target: "Collab_Web", value: 6 },
        { source: "Collab_Code", target: "Tool_DB", value: 9 },
        { source: "Collab_Data", target: "Vec_Global", value: 12 },
        { source: "Collab_Web", target: "Tool_Luma", value: 4 }
    ];

    // 3. Arc Diagram: Global Execution Handoff Sequences
    const arcNodes = [
        { id: "User Prompt", x: 0 }, { id: "Supervisor", x: 1 }, 
        { id: "RAG Retrieve", x: 2 }, { id: "Sub-Agent", x: 3 }, 
        { id: "Tool Exec", x: 4 }, { id: "System Out", x: 5 }
    ];
    const arcLinks = [
        { source: "User Prompt", target: "Supervisor", value: 15 },
        { source: "Supervisor", target: "RAG Retrieve", value: 10 },
        { source: "RAG Retrieve", target: "Supervisor", value: 10 },
        { source: "Supervisor", target: "Sub-Agent", value: 8 },
        { source: "Sub-Agent", target: "Tool Exec", value: 12 },
        { source: "Tool Exec", target: "System Out", value: 15 }
    ];

    // 4. Chord Diagram: Global Context Exchange (Token flow between roles/tools)
    const chordMatrix = [
        [0,   120, 80,  40], // From Supervisors
        [30,  0,   150, 60], // From Collaborators
        [10,  40,  0,   90], // From Standard Agents
        [100, 30,  20,  0 ]  // From Automation Tools
    ];
    const chordNames = ["Supervisors", "Collaborators", "Standard", "Automation Tools"];

    // 5. Connected Scatterplot: Global Fleet Efficiency Trajectory
    const scatterTrajectory = Array.from({length: 15}, (_, i) => ({
        step: i,
        duration: 1500 - (i * 40) + (Math.random() * 100 - 50), // Fleet getting faster
        costRatio: 1.5 - (i * 0.05) + (Math.random() * 0.1 - 0.05) // Fleet getting cheaper per token
    }));

    // 6. Hierarchical Edge Bundling: Global Artifact Lineage
    const artifactHierarchy = {
        name: "root",
        children: [
            { name: "Model", children: [{ name: "Model.Nova_Pro" }, { name: "Model.Claude_35" }, { name: "Model.Titan" }] },
            { name: "Agent", children: [{ name: "Agent.Supervisor" }, { name: "Agent.Collaborator" }] },
            { name: "Artifact", children: [{ name: "Artifact.Code_Snippets" }, { name: "Artifact.Media_Assets" }, { name: "Artifact.Data_Reports" }] }
        ]
    };
    const artifactLinks = [
        { source: "Model.Nova_Pro", target: "Agent.Supervisor" },
        { source: "Model.Claude_35", target: "Agent.Collaborator" },
        { source: "Model.Titan", target: "Agent.Collaborator" },
        { source: "Agent.Supervisor", target: "Artifact.Data_Reports" },
        { source: "Agent.Supervisor", target: "Artifact.Code_Snippets" },
        { source: "Agent.Collaborator", target: "Artifact.Media_Assets" },
        { source: "Agent.Collaborator", target: "Artifact.Data_Reports" }
    ];

    const filteredNodes = useMemo(() => 
        networkNodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase())), 
    [searchQuery]);

    // --- 1. Streamgraph (Global Workload Evolution) ---
    useEffect(() => {
        if (!streamRef.current) return;
        const svg = d3.select(streamRef.current);
        svg.selectAll("*").remove();

        const width = 500, height = 250, margin = {top: 20, right: 20, bottom: 30, left: 40};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const keys = ["Supervisors", "Collaborators", "Standard"];
        const stack = d3.stack<any>().keys(keys).offset(d3.stackOffsetWiggle);
        const stackedData = stack(streamData);

        const x = d3.scaleLinear().domain([0, 29]).range([0, innerW]);
        const yMin = d3.min(stackedData, layer => d3.min(layer, d => d[0])) || 0;
        const yMax = d3.max(stackedData, layer => d3.max(layer, d => d[1])) || 1;
        const y = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

        const color = d3.scaleOrdinal<string>().domain(keys).range([d3Colors.accent1, d3Colors.accent2, d3Colors.accent3]);

        const area = d3.area<any>()
            .x(d => x(d.data.day))
            .y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveBasis);

        g.selectAll("path").data(stackedData).enter().append("path")
            .attr("d", area as any)
            .style("fill", d => color(d.key)).style("opacity", 0.8)
            .on("mouseover", function() { d3.selectAll(".stream-layer").style("opacity", 0.2); d3.select(this).style("opacity", 1); })
            .on("mouseout", function() { d3.selectAll(".stream-layer").style("opacity", 0.8); })
            .attr("class", "stream-layer")
            .append("title").text(d => d.key);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => `Day ${d}`)).style("color", d3Colors.text).style("font-family", "Google Sans Code");
    }, [darkMode]);

    // --- 2. Global Network Graph ---
    useEffect(() => {
        if (!networkRef.current) return;
        const svg = d3.select(networkRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 300;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g");

        const nodes = filteredNodes.map(d => Object.create(d));
        const links = networkLinks
            .filter(l => filteredNodes.some(n => n.id === l.source) && filteredNodes.some(n => n.id === l.target))
            .map(d => Object.create(d));

        if (nodes.length === 0) {
            g.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").style("fill", d3Colors.text).text("No matching telemetry nodes");
            return;
        }

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = g.append("g").selectAll("line").data(links).enter().append("line")
            .attr("stroke", d3Colors.grid).attr("stroke-opacity", 0.6).attr("stroke-width", (d: any) => Math.sqrt(d.value));

        const node = g.append("g").selectAll("circle").data(nodes).enter().append("circle")
            .attr("r", 10)
            .attr("fill", (d: any) => d.group === 1 ? d3Colors.accent4 : d.group === 2 ? d3Colors.accent1 : d.group === 3 ? d3Colors.accent3 : d3Colors.accent2)
            .attr("stroke", d3Colors.bg).attr("stroke-width", 2);

        const labels = g.append("g").selectAll("text").data(nodes).enter().append("text")
            .text((d: any) => d.label)
            .attr("x", 14).attr("y", 4)
            .style("fill", d3Colors.title).style("font-size", "10px").style("font-family", "Google Sans Code");

        simulation.on("tick", () => {
            link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
            node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
            labels.attr("x", (d: any) => d.x + 14).attr("y", (d: any) => d.y + 4);
        });
    }, [darkMode, filteredNodes]);

    // --- 3. Arc Diagram (Global Sequencing) ---
    useEffect(() => {
        if (!arcRef.current) return;
        const svg = d3.select(arcRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 250, margin = {top: 20, right: 30, bottom: 20, left: 30};
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${height - margin.bottom - 50})`);

        const x = d3.scalePoint().range([0, width - margin.left - margin.right]).domain(arcNodes.map(d => d.id)).padding(0.5);

        g.selectAll("path").data(arcLinks).enter().append("path")
            .attr("d", (d: any) => {
                const start = x(d.source) as number;
                const end = x(d.target) as number;
                const r = Math.abs(end - start) / 2;
                return `M ${start} 0 A ${r} ${r} 0 0 ${start < end ? 1 : 0} ${end} 0`;
            })
            .style("fill", "none")
            .attr("stroke", (d: any) => d.source === "RAG Retrieve" || d.target === "RAG Retrieve" ? d3Colors.accent3 : d3Colors.accent2)
            .attr("stroke-width", (d: any) => Math.log(d.value) * 1.5)
            .style("opacity", 0.4)
            .on("mouseover", function() { d3.select(this).style("opacity", 1); })
            .on("mouseout", function() { d3.select(this).style("opacity", 0.4); });

        g.selectAll("circle").data(arcNodes).enter().append("circle")
            .attr("cx", d => x(d.id) as number).attr("cy", 0).attr("r", 6)
            .style("fill", d3Colors.accent1).attr("stroke", d3Colors.bg).style("stroke-width", 2);

        g.selectAll("text").data(arcNodes).enter().append("text")
            .attr("x", d => x(d.id) as number).attr("y", 20)
            .text(d => d.id)
            .style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).style("font-family", "Google Sans Code")
            .attr("transform", (d: any) => `rotate(30, ${x(d.id)}, 20)`);

    }, [darkMode]);

    // --- 4. Chord Diagram (Global Context Exchange) ---
    useEffect(() => {
        if (!chordRef.current) return;
        const svg = d3.select(chordRef.current);
        svg.selectAll("*").remove();

        const width = 350, height = 350, innerRadius = 100, outerRadius = 110;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(chordMatrix);
        const color = d3.scaleOrdinal<number, string>().domain(d3.range(4)).range([d3Colors.accent1, d3Colors.accent2, d3Colors.accent3, d3Colors.accent4]);

        const group = g.append("g").selectAll("g").data(chord.groups).enter().append("g");
        
        group.append("path").style("fill", d => color(d.index)).style("stroke", d3Colors.bg)
            .attr("d", d3.arc<any>().innerRadius(innerRadius).outerRadius(outerRadius));

        group.append("text").each(d => { (d as any).angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", (d: any) => `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + 10}) ${d.angle > Math.PI ? "rotate(180)" : ""}`)
            .style("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
            .text((d: any) => chordNames[d.index])
            .style("font-size", "10px").style("fill", d3Colors.title).style("font-family", "Google Sans Code");

        g.append("g").attr("fill-opacity", 0.6).selectAll("path").data(chord).enter().append("path")
            .attr("d", d3.ribbon<any, any>().radius(innerRadius) as any)
            .style("fill", (d: any) => color(d.source.index)).style("stroke", d3Colors.bg)
            .on("mouseover", function() { d3.select(this).style("fill-opacity", 1); })
            .on("mouseout", function() { d3.select(this).style("fill-opacity", 0.6); });

    }, [darkMode]);

    // --- 5. Connected Scatterplot (Global Fleet Trajectory) ---
    useEffect(() => {
        if (!connectedScatterRef.current) return;
        const svg = d3.select(connectedScatterRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 250, margin = {top: 20, right: 30, bottom: 40, left: 50};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([800, 1600]).range([0, innerW]); // Latency
        const y = d3.scaleLinear().domain([0.8, 1.6]).range([innerH, 0]);   // Cost Ratio

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6)).style("color", d3Colors.text);
        g.append("g").call(d3.axisLeft(y).ticks(5)).style("color", d3Colors.text);

        g.append("text").attr("x", innerW/2).attr("y", innerH + 35).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Fleet Avg Latency (ms)");
        g.append("text").attr("transform", "rotate(-90)").attr("y", -35).attr("x", -innerH/2).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Cost/Token Ratio");

        const line = d3.line<any>().x(d => x(d.duration)).y(d => y(d.costRatio)).curve(d3.curveCatmullRom);

        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient").attr("id", "trajGrad").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", d3Colors.accent4); // Older (slower/expensive)
        gradient.append("stop").attr("offset", "100%").attr("stop-color", d3Colors.accent3); // Newer (faster/cheaper)

        g.append("path").datum(scatterTrajectory).attr("d", line).attr("fill", "none")
            .attr("stroke", "url(#trajGrad)").attr("stroke-width", 2).attr("opacity", 0.6);

        g.selectAll("circle").data(scatterTrajectory).enter().append("circle")
            .attr("cx", d => x(d.duration)).attr("cy", d => y(d.costRatio))
            .attr("r", 4).attr("fill", d3Colors.bg).attr("stroke", (_, i) => i === scatterTrajectory.length - 1 ? d3Colors.accent3 : d3Colors.accent4).attr("stroke-width", 2)
            .append("title").text(d => `Step ${d.step}: ${d.duration.toFixed(0)}ms / Ratio ${d.costRatio.toFixed(2)}`);

        const lastPoint = scatterTrajectory[scatterTrajectory.length - 1];
        g.append("text").attr("x", x(lastPoint.duration) + 10).attr("y", y(lastPoint.costRatio))
            .text("Current Optimum").style("font-size", "10px").style("fill", d3Colors.accent3).style("font-weight", "bold");

    }, [darkMode]);

    // --- 6. Hierarchical Edge Bundling (Global Artifact Lineage) ---
    useEffect(() => {
        if (!bundlingRef.current) return;
        const svg = d3.select(bundlingRef.current);
        svg.selectAll("*").remove();

        const width = 400, height = 400, radius = width / 2 - 60;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const cluster = d3.cluster<any>().size([2 * Math.PI, radius]);
        const root = d3.hierarchy(artifactHierarchy);
        cluster(root);

        const nodeByName = new Map(root.leaves().map(d => [d.data.name, d]));
        const linkData = artifactLinks.map(l => ({ source: nodeByName.get(l.source), target: nodeByName.get(l.target) }));

        const line = d3.lineRadial<any>().curve(d3.curveBundle.beta(0.85))
            .radius((d: any) => d.y).angle((d: any) => d.x);

        g.append("g").selectAll("path").data(linkData).enter().append("path")
            .attr("d", (d: any) => line(d.source.path(d.target)))
            .style("fill", "none").style("stroke", d3Colors.accent1).style("stroke-width", 2).style("opacity", 0.5)
            .on("mouseover", function() { d3.select(this).style("stroke", d3Colors.accent2).style("opacity", 1).style("stroke-width", 3); })
            .on("mouseout", function() { d3.select(this).style("stroke", d3Colors.accent1).style("opacity", 0.5).style("stroke-width", 2); });

        const node = g.append("g").selectAll("g").data(root.leaves()).enter().append("g")
            .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

        node.append("circle").attr("r", 4).style("fill", (d: any) => d.data.name.includes("Artifact") ? d3Colors.accent3 : d3Colors.accent1);

        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => d.x < Math.PI ? 6 : -6)
            .style("text-anchor", (d: any) => d.x < Math.PI ? "start" : "end")
            .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
            .text((d: any) => d.data.name.split('.')[1].replace('_', ' '))
            .style("font-size", "10px").style("fill", d3Colors.text).style("font-family", "Google Sans Code");

    }, [darkMode]);

    return (
        <div className="system-overview-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* KPI ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="ft-card stat-counter flash-card" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Autonomous Agents</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>1,842</h1>
                    <span className="trend positive"><i className="bx bx-network-chart"></i> Globally Deployed</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Handoff Latency</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code', color: d3Colors.accent3 }}>1.2s</h1>
                    <span className="trend positive"><i className="bx bx-check-shield"></i> Within SLA Bounds</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Artifacts Generated</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>14,320</h1>
                    <span className="trend neutral">Media & Documents (30d)</span>
                </div>
            </div>

            {/* ROW 1: Streamgraph & Network Graph */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Global Workload Evolution</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Streamgraph tracking system-wide token volume by Agent Role (30d).</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={streamRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
                
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Hub & Spoke Topology</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Network graph mapping global profile archetypes to critical infrastructure endpoints.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', backgroundColor: d3Colors.surface, borderRadius: '8px' }}>
                        <svg ref={networkRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
            </div>

            {/* ROW 2: Arc Diagram & Chord Diagram */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Global Execution Sequencing</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Arc diagram tracing the most frequent operational sequences system-wide.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={arcRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Inter-Role Context Exchange</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Chord diagram mapping aggregate token payloads passed between roles globally.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={chordRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
            </div>

            {/* ROW 3: Connected Scatterplot & Edge Bundling */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Fleet Efficiency Trajectory</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Connected scatter tracking latency vs. margin ratio optimization over time.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={connectedScatterRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Global Artifact Lineage</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Hierarchical edge bundling mapping Foundational Models to final artifact generation.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={bundlingRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AgentsTelemetry;