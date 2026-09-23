import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface AdminOverviewProps {
    searchQuery: string;
    darkMode: boolean;
}

const AdminSystemOverview: React.FC<AdminOverviewProps> = ({ searchQuery, darkMode }) => {
    
    const [stats] = useState({
        totalBurn: 8450200,
        topUpRevenue: 12500000,
        activeTerminals: 342,
        failedWorkflows: 12
    });

    const circularToolData = [
        { name: "Luma Video", value: 450000 },
        { name: "Shopify API", value: 320000 },
        { name: "Salesforce", value: 280000 },
        { name: "Titan Image", value: 210000 },
        { name: "Zendesk", value: 150000 },
        { name: "PostgreSQL", value: 120000 },
        { name: "Jira Agile", value: 95000 },
        { name: "Formstack", value: 65000 }
    ];

    const filteredToolData = circularToolData.filter(tool => 
        tool.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const d3Colors = darkMode ? 
        { text: "#9ca3af", title: "#f9fafb", grid: "#374151", accent1: "#800020", accent2: "#0891b2", accent3: "#10b981", accent4: "#f59e0b" } : 
        { text: "#6b7280", title: "#111827", grid: "#e5e7eb", accent1: "#800020", accent2: "#0ea5e9", accent3: "#059669", accent4: "#d97706" };

    const sankeyRef = useRef<SVGSVGElement>(null);
    const circularRef = useRef<SVGSVGElement>(null);
    const areaRef = useRef<SVGSVGElement>(null);
    const donutRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!sankeyRef.current) return;
        d3.select(sankeyRef.current).selectAll("*").remove();

        const width = 500, height = 250;
        const svg = d3.select(sankeyRef.current).attr("viewBox", `0 0 ${width} ${height}`);

        const nodes = [
            { id: "Burn", x: 20, y: height/2, w: 10, h: 100, color: d3Colors.accent1, label: "Total Burn" },
            { id: "LLM", x: width/2, y: 70, w: 10, h: 40, color: d3Colors.accent2, label: "LLM Inference" },
            { id: "Tools", x: width/2, y: 180, w: 10, h: 60, color: d3Colors.accent3, label: "Tool Execution" },
            { id: "Nova", x: width-80, y: 50, w: 10, h: 25, color: d3Colors.text, label: "Nova Pro" },
            { id: "Claude", x: width-80, y: 100, w: 10, h: 15, color: d3Colors.text, label: "Claude 3.5" },
            { id: "Luma", x: width-80, y: 160, w: 10, h: 30, color: d3Colors.text, label: "Luma API" },
            { id: "RPA", x: width-80, y: 210, w: 10, h: 20, color: d3Colors.text, label: "RPA Webhooks" }
        ];

        const links = [
            { s: nodes[0], t: nodes[1], width: 40 },
            { s: nodes[0], t: nodes[2], width: 60 },
            { s: nodes[1], t: nodes[3], width: 25 },
            { s: nodes[1], t: nodes[4], width: 15 },
            { s: nodes[2], t: nodes[5], width: 30 },
            { s: nodes[2], t: nodes[6], width: 20 }
        ];

        const linkGen = d3.linkHorizontal<any, any>()
            .source(d => [d.s.x + d.s.w, d.s.y])
            .target(d => [d.t.x, d.t.y]);

        svg.selectAll(".flow-link").data(links).enter().append("path")
            .attr("d", linkGen)
            .attr("fill", "none")
            .attr("stroke", d => d.t.color)
            .attr("stroke-width", d => d.width)
            .attr("stroke-opacity", 0.3)
            .style("transition", "all 0.3s")
            .on("mouseover", (event) => d3.select(event.currentTarget).attr("stroke-opacity", 0.6))
            .on("mouseout", (event) => d3.select(event.currentTarget).attr("stroke-opacity", 0.3));

        svg.selectAll(".flow-node").data(nodes).enter().append("rect")
            .attr("x", d => d.x).attr("y", d => d.y - d.h/2)
            .attr("width", d => d.w).attr("height", d => d.h)
            .attr("fill", d => d.color).attr("rx", 2);

        svg.selectAll(".flow-label").data(nodes).enter().append("text")
            .attr("x", d => d.id === "Burn" ? d.x + 15 : (d.id === "LLM" || d.id === "Tools" ? d.x + 15 : d.x - 10))
            .attr("y", d => d.y + 4)
            .text(d => d.label)
            .attr("text-anchor", d => (d.id === "Nova" || d.id === "Claude" || d.id === "Luma" || d.id === "RPA") ? "end" : "start")
            .style("fill", d3Colors.title).style("font-size", "10px").style("font-family", "Google Sans Code")
            .style("font-weight", "bold");

    }, [darkMode]);

    useEffect(() => {
        if (!circularRef.current) return;
        d3.select(circularRef.current).selectAll("*").remove();

        if (filteredToolData.length === 0) {
            d3.select(circularRef.current)
              .attr("viewBox", `0 0 350 350`)
              .append("text")
              .attr("x", 175).attr("y", 175)
              .attr("text-anchor", "middle")
              .style("fill", d3Colors.text)
              .style("font-family", "Google Sans Code")
              .text("No matching tools found");
            return;
        }

        const width = 350, height = 350, innerRadius = 50, outerRadius = Math.min(width, height) / 2 - 20;
        const svg = d3.select(circularRef.current).attr("viewBox", `0 0 ${width} ${height}`)
                      .append("g").attr("transform", `translate(${width/2},${height/2})`);

        const x = d3.scaleBand().range([0, 2 * Math.PI]).domain(filteredToolData.map(d => d.name));
        const y = d3.scaleRadial().range([innerRadius, outerRadius]).domain([0, 500000]);

        const arc = d3.arc<any>()
            .innerRadius(innerRadius)
            .outerRadius((d: any) => y(d.value))
            .startAngle((d: any) => x(d.name) as number)
            .endAngle((d: any) => (x(d.name) as number) + x.bandwidth())
            .padAngle(0.05).padRadius(innerRadius);

        svg.append("g").selectAll("path").data(filteredToolData).enter().append("path")
            .attr("fill", d3Colors.accent1)
            .attr("d", arc as any)
            .style("transition", "all 0.3s")
            .on("mouseover", (event: any) => { d3.select(event.currentTarget).attr("fill", d3Colors.accent2); })
            .on("mouseout", (event: any) => { d3.select(event.currentTarget).attr("fill", d3Colors.accent1); });
            
        svg.append("g").selectAll("g").data(filteredToolData).enter().append("g")
            .attr("text-anchor", (d: any) => ((x(d.name) as number) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "end" : "start")
            .attr("transform", (d: any) => `rotate(${(((x(d.name) as number) + x.bandwidth() / 2) * 180 / Math.PI - 90)}) translate(${y(d.value) + 10},0)`)
            .append("text")
            .text((d: any) => d.name)
            .attr("transform", (d: any) => ((x(d.name) as number) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "rotate(180)" : "rotate(0)")
            .style("font-size", "10px").style("fill", d3Colors.text).style("font-family", "Google Sans Code")
            .attr("alignment-baseline", "middle");
            
    }, [darkMode, searchQuery, filteredToolData.length]);

    useEffect(() => {
        if (!areaRef.current) return;
        d3.select(areaRef.current).selectAll("*").remove();

        const width = 450, height = 200;
        const svg = d3.select(areaRef.current).attr("viewBox", `0 0 ${width} ${height}`);

        const mockTimeSeries = Array.from({length: 30}, (_, i) => ({
            day: i,
            burn: 10000 + Math.random() * 5000 + (i * 200),
            revenue: 12000 + Math.random() * 4000 + (i * 300)
        }));

        const x = d3.scaleLinear().domain([0, 29]).range([0, width]);
        const y = d3.scaleLinear().domain([0, 30000]).range([height - 20, 20]);

        // Burn Area (Red)
        const areaBurn = d3.area<any>().x(d => x(d.day)).y0(height - 20).y1(d => y(d.burn)).curve(d3.curveMonotoneX);
        svg.append("path").datum(mockTimeSeries).attr("fill", d3Colors.accent1).attr("fill-opacity", 0.3).attr("d", areaBurn);
        
        // Revenue Area (Green)
        const areaRev = d3.area<any>().x(d => x(d.day)).y0(height - 20).y1(d => y(d.revenue)).curve(d3.curveMonotoneX);
        svg.append("path").datum(mockTimeSeries).attr("fill", d3Colors.accent3).attr("fill-opacity", 0.3).attr("d", areaRev);
        
        // Lines
        const lineBurn = d3.line<any>().x(d => x(d.day)).y(d => y(d.burn)).curve(d3.curveMonotoneX);
        const lineRev = d3.line<any>().x(d => x(d.day)).y(d => y(d.revenue)).curve(d3.curveMonotoneX);
        
        svg.append("path").datum(mockTimeSeries).attr("fill", "none").attr("stroke", d3Colors.accent1).attr("stroke-width", 2).attr("d", lineBurn);
        svg.append("path").datum(mockTimeSeries).attr("fill", "none").attr("stroke", d3Colors.accent3).attr("stroke-width", 2).attr("d", lineRev);

    }, [darkMode]);

    useEffect(() => {
        if (!donutRef.current) return;
        d3.select(donutRef.current).selectAll("*").remove();

        const width = 200, height = 200, radius = Math.min(width, height) / 2;
        const svg = d3.select(donutRef.current).attr("viewBox", `0 0 ${width} ${height}`)
                      .append("g").attr("transform", `translate(${width/2},${height/2})`);

        const data = { inference: 35, tools: 55, storage: 10 };
        const color = d3.scaleOrdinal().domain(Object.keys(data)).range([d3Colors.accent2, d3Colors.accent1, d3Colors.accent4]);
        
        const pie = d3.pie<any>().value(d => d[1]);
        const data_ready = pie(Object.entries(data) as any);

        const arcGen = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);

        svg.selectAll("allSlices").data(data_ready).enter().append("path")
            .attr("d", arcGen as any)
            .attr("fill", d => color(d.data[0]) as string)
            .attr("stroke", darkMode ? "#1f2937" : "#ffffff")
            .style("stroke-width", "2px")
            .style("opacity", 0.9)
            .style("transition", "opacity 0.2s")
            .on("mouseover", (event) => d3.select(event.currentTarget).style("opacity", 1))
            .on("mouseout", (event) => d3.select(event.currentTarget).style("opacity", 0.9));

    }, [darkMode]);

    return (
        <div className="system-overview-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="ft-card stat-counter flash-card" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Burn (30d)</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>{stats.totalBurn.toLocaleString()}</h1>
                    <span className="trend negative"><i className="bx bx-trending-up"></i> +12.4% MoM</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top-Up Revenue (30d)</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code', color: '#10b981' }}>{stats.topUpRevenue.toLocaleString()}</h1>
                    <span className="trend positive"><i className="bx bx-trending-up"></i> +28.1% MoM</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Terminals</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>{stats.activeTerminals}</h1>
                    <span className="trend neutral">Currently Subscribed</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Compute Value Flow</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Mapping token expenditure to engine execution.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={sankeyRef} style={{ width: '100%', height: 'auto', maxHeight: '250px' }}></svg>
                    </div>
                </div>
                
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Profit Margin Delta</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Revenue (<span style={{color: d3Colors.accent3}}>Green</span>) vs Burn (<span style={{color: d3Colors.accent1}}>Red</span>)</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={areaRef} style={{ width: '100%', height: 'auto', maxHeight: '250px' }}></svg>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Global Tool Affinity</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Distribution of native tool execution across the platform.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={circularRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Credit Allocation</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Where platform compute is being spent.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>
                        <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                            <svg ref={donutRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></svg>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: d3Colors.title }}>100%</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}><span style={{ color: d3Colors.accent2 }}>●</span> Inference</span>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}><span style={{ color: d3Colors.accent1 }}>●</span> Tools</span>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}><span style={{ color: d3Colors.accent4 }}>●</span> Storage</span>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AdminSystemOverview;