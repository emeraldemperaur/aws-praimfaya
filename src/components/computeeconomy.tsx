import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import '../styles/systemoverview.scss';

interface ComputeEconomyProps {
    searchQuery: string;
    darkMode: boolean;
}

const ComputeEconomy: React.FC<ComputeEconomyProps> = ({ searchQuery, darkMode }) => {
    const d3Colors = darkMode ? 
        { text: "#9ca3af", title: "#f9fafb", grid: "#374151", accent1: "#800020", accent2: "#0891b2", accent3: "#10b981", accent4: "#f59e0b", bg: "#1f2937" } : 
        { text: "#6b7280", title: "#111827", grid: "#e5e7eb", accent1: "#800020", accent2: "#0ea5e9", accent3: "#059669", accent4: "#d97706", bg: "#ffffff" };

    const lollipopRef = useRef<SVGSVGElement>(null);
    const hexbinRef = useRef<SVGSVGElement>(null);
    const parallelRef = useRef<SVGSVGElement>(null);
    const radarRef = useRef<SVGSVGElement>(null);
    const dendrogramRef = useRef<SVGSVGElement>(null);
    const choroplethRef = useRef<SVGSVGElement>(null);

    const toolCosts = [
        { tool: "Luma Video", cost: 450000 }, { tool: "Edit Image", cost: 180000 },
        { tool: "Enterprise Voice", cost: 125000 }, { tool: "Jotform Agent", cost: 95000 },
        { tool: "Salesforce Sync", cost: 85000 }, { tool: "Document Agent", cost: 45000 }
    ];

    const tokenDensity = Array.from({length: 300}, () => ({
        x: Math.random() * 4000 + 100,
        y: Math.random() * 1500 + 50 
    }));

    const executionPaths = Array.from({length: 100}, () => ({
        role: ["STANDARD", "SUPERVISOR", "COLLABORATOR"][Math.floor(Math.random() * 3)],
        modality: ["TEXT", "MULTIMODAL", "IMAGE"][Math.floor(Math.random() * 3)],
        caliber: ["FAST", "MODERATE", "HIGH", "ULTRA"][Math.floor(Math.random() * 4)],
        costTier: ["LOW", "MEDIUM", "HIGH", "PREMIUM"][Math.floor(Math.random() * 4)]
    }));

    const radarData = [
        { provider: "Amazon Nova", axes: [{axis: "Speed", value: 0.9}, {axis: "Cost Efficiency", value: 0.8}, {axis: "Reasoning", value: 0.8}, {axis: "Multimodal", value: 0.9}] },
        { provider: "Anthropic", axes: [{axis: "Speed", value: 0.7}, {axis: "Cost Efficiency", value: 0.6}, {axis: "Reasoning", value: 0.95}, {axis: "Multimodal", value: 0.7}] },
        { provider: "Meta Llama", axes: [{axis: "Speed", value: 0.85}, {axis: "Cost Efficiency", value: 0.9}, {axis: "Reasoning", value: 0.7}, {axis: "Multimodal", value: 0.4}] }
    ];

    const hierarchyData = {
        name: "Vanguard Platform",
        children: [
            { name: "Supervisors", children: [{ name: "Nova Pro", value: 100 }, { name: "Claude 3.5", value: 80 }] },
            { name: "Standard Agents", children: [{ name: "Titan Embed", value: 60 }, { name: "Llama 3", value: 50 }] },
            { name: "Tool Executors", children: [{ name: "Luma API", value: 90 }, { name: "Jotform", value: 40 }] }
        ]
    };

    const regionData = [
        { region: "US", lat: 38, lon: -97, cost: 5400000 },
        { region: "EU", lat: 50, lon: 10, cost: 2100000 },
        { region: "APAC", lat: 35, lon: 105, cost: 3800000 }
    ];

    useEffect(() => {
        if (!lollipopRef.current) return;
        const svg = d3.select(lollipopRef.current);
        svg.selectAll("*").remove();

        const width = 400, height = 250, margin = {top: 20, right: 30, bottom: 40, left: 100};
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const filteredTools = toolCosts.filter(t => t.tool.toLowerCase().includes(searchQuery.toLowerCase()));

        const x = d3.scaleLinear().domain([0, 500000]).range([0, innerWidth]);
        const y = d3.scaleBand().range([0, innerHeight]).domain(filteredTools.map(d => d.tool)).padding(1);

        g.selectAll("lines").data(filteredTools).enter().append("line")
            .attr("x1", 0).attr("x2", d => x(d.cost))
            .attr("y1", d => y(d.tool) as number).attr("y2", d => y(d.tool) as number)
            .attr("stroke", d3Colors.grid).attr("stroke-width", "2px");

        g.selectAll("circles").data(filteredTools).enter().append("circle")
            .attr("cx", d => x(d.cost)).attr("cy", d => y(d.tool) as number)
            .attr("r", "6").style("fill", d3Colors.accent1).attr("stroke", d3Colors.bg).attr("stroke-width", "2px")
            .style("transition", "all 0.2s").on("mouseover", function() { d3.select(this).attr("r", 9); }).on("mouseout", function() { d3.select(this).attr("r", 6); });

        g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => `${(d as number)/1000}k`)).style("color", d3Colors.text).style("font-family", "Google Sans Code");
        g.append("g").call(d3.axisLeft(y)).style("color", d3Colors.title).style("font-family", "Google Sans Code").style("font-weight", "bold").selectAll(".domain, .tick line").remove();

    }, [darkMode, searchQuery]);

    useEffect(() => {
        if (!hexbinRef.current) return;
        const svg = d3.select(hexbinRef.current);
        svg.selectAll("*").remove();

        const width = 400, height = 250, margin = {top: 20, right: 20, bottom: 40, left: 50};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([0, 4500]).range([0, innerW]);
        const y = d3.scaleLinear().domain([0, 1600]).range([innerH, 0]);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5)).style("color", d3Colors.text);
        g.append("g").call(d3.axisLeft(y).ticks(4)).style("color", d3Colors.text);

        const densityData = d3.contourDensity<{x: number, y: number}>()
            .x(d => x(d.x)).y(d => y(d.y))
            .size([innerW, innerH]).bandwidth(20)(tokenDensity);

        const color = d3.scaleLinear<string>().domain([0, d3.max(densityData, d => d.value) || 0.1])
            .range([darkMode ? "#1f2937" : "#e5e7eb", d3Colors.accent2]);

        g.selectAll("path").data(densityData).enter().append("path")
            .attr("d", d3.geoPath())
            .attr("fill", d => color(d.value))
            .attr("opacity", 0.8)
            .attr("stroke", d3Colors.bg).attr("stroke-width", 0.5);

        g.append("text").attr("x", innerW/2).attr("y", innerH + 35).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Input Tokens (Context Window)");
        g.append("text").attr("transform", "rotate(-90)").attr("y", -35).attr("x", -innerH/2).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Output Tokens");

    }, [darkMode]);

    useEffect(() => {
        if (!parallelRef.current) return;
        const svg = d3.select(parallelRef.current);
        svg.selectAll("*").remove();

        const width = 800, height = 250, margin = {top: 30, right: 50, bottom: 20, left: 50};
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const dimensions = ["role", "modality", "caliber", "costTier"] as const;
        const y: any = {};
        
        dimensions.forEach(name => {
            const uniqueVals = Array.from(new Set(executionPaths.map(d => d[name])));
            y[name] = d3.scalePoint().domain(uniqueVals).range([height - margin.top - margin.bottom, 0]).padding(0.5);
        });

        const x = d3.scalePoint().range([0, width - margin.left - margin.right]).domain(dimensions).padding(0.5);

        function path(d: any) { return d3.line()(dimensions.map(p => [x(p) as number, y[p](d[p])])); }

        g.selectAll("myPath").data(executionPaths).enter().append("path")
            .attr("d", path)
            .style("fill", "none").style("stroke", d => d.costTier === "PREMIUM" ? d3Colors.accent1 : d3Colors.accent2)
            .style("opacity", 0.15).style("stroke-width", "2px")
            .on("mouseover", function() { d3.select(this).style("opacity", 0.8).style("stroke-width", "4px"); })
            .on("mouseout", function() { d3.select(this).style("opacity", 0.15).style("stroke-width", "2px"); });

        g.selectAll("myAxis").data(dimensions).enter().append("g")
            .attr("transform", d => `translate(${x(d)},0)`)
            .each(function(d) { d3.select(this).call(d3.axisLeft(y[d])); })
            .style("color", d3Colors.text).style("font-family", "Google Sans Code")
            .append("text")
            .style("text-anchor", "middle").attr("y", -15).text(d => d.toUpperCase()).style("fill", d3Colors.title).style("font-weight", "bold");

    }, [darkMode]);

    useEffect(() => {
        if (!radarRef.current) return;
        const svg = d3.select(radarRef.current);
        svg.selectAll("*").remove();

        const width = 350, height = 300, radius = Math.min(width, height) / 2 - 40;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const features = radarData[0].axes.map(a => a.axis);
        const angleSlice = (Math.PI * 2) / features.length;
        const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);

        g.selectAll(".gridCircle").data([0.25, 0.5, 0.75, 1]).enter().append("circle")
            .attr("r", d => rScale(d)).style("fill", "none").style("stroke", d3Colors.grid).style("stroke-dasharray", "3,3");

        const axis = g.selectAll(".axis").data(features).enter().append("g");
        
        axis.append("line").attr("x1", 0).attr("y1", 0)
            .attr("x2", (_, i) => rScale(1.1) * Math.cos(angleSlice * i - Math.PI/2))
            .attr("y2", (_, i) => rScale(1.1) * Math.sin(angleSlice * i - Math.PI/2))
            .style("stroke", d3Colors.grid).style("stroke-width", "1px");
            
        axis.append("text")
            .attr("x", (_, i) => rScale(1.2) * Math.cos(angleSlice * i - Math.PI/2))
            .attr("y", (_, i) => rScale(1.2) * Math.sin(angleSlice * i - Math.PI/2))
            .text(d => d).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).style("font-family", "Google Sans Code");

        const radarLine = d3.lineRadial<any>().angle((_, i) => i * angleSlice).radius(d => rScale(d.value)).curve(d3.curveLinearClosed);
        const colors = [d3Colors.accent2, d3Colors.accent3, d3Colors.accent4];

        g.selectAll(".radarWrapper").data(radarData).enter().append("path")
            .attr("d", d => radarLine(d.axes))
            .style("fill", (_, i) => colors[i]).style("fill-opacity", 0.2)
            .style("stroke", (_, i) => colors[i]).style("stroke-width", 2)
            .on("mouseover", function() { d3.select(this).style("fill-opacity", 0.6); })
            .on("mouseout", function() { d3.select(this).style("fill-opacity", 0.2); });

    }, [darkMode]);

    useEffect(() => {
        if (!dendrogramRef.current) return;
        const svg = d3.select(dendrogramRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 300;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", "translate(40,0)");

        const cluster = d3.cluster().size([height - 40, width - 150]);
        const root = d3.hierarchy(hierarchyData);
        cluster(root as any);

        g.selectAll('path').data(root.descendants().slice(1)).enter().append('path')
            .attr("d", (d: any) => `M${d.y},${d.x}C${d.parent.y + 50},${d.x} ${d.parent.y + 100},${d.parent.x} ${d.parent.y},${d.parent.x}`)
            .style("fill", "none").style("stroke", d3Colors.grid).style("stroke-width", "1.5px");

        const node = g.selectAll("g").data(root.descendants()).enter().append("g")
            .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

        node.append("circle").attr("r", 5).style("fill", d => d.children ? d3Colors.accent1 : d3Colors.accent3).attr("stroke", d3Colors.bg).style("stroke-width", 2);

        node.append("text").attr("dy", "0.31em").attr("x", d => d.children ? -8 : 8)
            .style("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name).style("fill", d3Colors.title).style("font-size", "11px").style("font-family", "Google Sans Code");

    }, [darkMode]);

    useEffect(() => {
        if (!choroplethRef.current) return;
        const svg = d3.select(choroplethRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 300;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`);

        for (let i = 0; i < height; i += 20) { g.append("line").attr("x1", 0).attr("x2", width).attr("y1", i).attr("y2", i).attr("stroke", d3Colors.grid).attr("stroke-opacity", 0.3); }
        for (let j = 0; j < width; j += 20) { g.append("line").attr("x1", j).attr("x2", j).attr("y1", 0).attr("y2", height).attr("stroke", d3Colors.grid).attr("stroke-opacity", 0.3); }

        const projection = d3.geoMercator().scale(70).translate([width / 2, height / 1.5]);
        const rScale = d3.scaleSqrt().domain([0, 6000000]).range([5, 30]);

        g.selectAll("circle").data(regionData).enter().append("circle")
            .attr("cx", d => projection([d.lon, d.lat])?.[0] || 0)
            .attr("cy", d => projection([d.lon, d.lat])?.[1] || 0)
            .attr("r", d => rScale(d.cost))
            .style("fill", d3Colors.accent1).style("opacity", 0.6).style("stroke", d3Colors.bg).style("stroke-width", 2)
            .append("title").text(d => `${d.region}: ${d.cost.toLocaleString()} credits`);

        g.selectAll("text").data(regionData).enter().append("text")
            .attr("x", d => projection([d.lon, d.lat])?.[0] || 0)
            .attr("y", d => (projection([d.lon, d.lat])?.[1] || 0) - rScale(d.cost) - 5)
            .text(d => d.region).style("text-anchor", "middle").style("fill", d3Colors.title).style("font-size", "12px").style("font-weight", "bold").style("font-family", "Bodoni Moda Variable");

    }, [darkMode]);

    return (
        <div className="system-overview-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="ft-card stat-counter flash-card" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Credit Expenditure</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>12,854,900</h1>
                    <span className="trend negative"><i className="bx bx-trending-up"></i> Usage Escalating</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token Economy Efficiency</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code', color: '#0891b2' }}>84.2%</h1>
                    <span className="trend positive"><i className="bx bx-check-shield"></i> High RAG Utility</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Automation Tools</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>24</h1>
                    <span className="trend neutral">Enterprise Integrations</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Compute Utility Density (Tokens)</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Hexbin mapping of Input Context vs Response Generation.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={hexbinRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
                
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Top Tool Expenditure</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Lollipop chart ranking credit burn across native tools.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={lollipopRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
            </div>

            <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Agentic Execution Pathing</h3>
                    <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Parallel coordinates tracing agent roles to their corresponding model costs.</span>
                </div>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                    <svg ref={parallelRef} style={{ minWidth: '700px', width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Ecosystem Taxonomy</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Dendrogram mapping Platform architecture to Models.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={dendrogramRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Model Caliber Efficiency</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Radar comparative analysis of foundation models.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={radarRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>
            </div>

            <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Global Compute Origin</h3>
                    <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Choropleth node mapping of geographic model region execution limits.</span>
                </div>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', backgroundColor: d3Colors.bg, borderRadius: '8px', padding: '1rem' }}>
                    <svg ref={choroplethRef} style={{ width: '100%', maxWidth: '600px', height: 'auto', maxHeight: '400px' }}></svg>
                </div>
            </div>

        </div>
    );
};

export default ComputeEconomy;