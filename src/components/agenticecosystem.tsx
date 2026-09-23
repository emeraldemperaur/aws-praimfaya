import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import '../styles/systemoverview.scss';

interface AgenticEcosystemProps {
    searchQuery: string;
    darkMode: boolean;
}

const AgenticEcosystem: React.FC<AgenticEcosystemProps> = ({ searchQuery, darkMode }) => {
    // --- Enterprise D3 Color Palette ---
    const d3Colors = darkMode ? 
        { text: "#9ca3af", title: "#f9fafb", grid: "#374151", accent1: "#8b5cf6", accent2: "#3b82f6", accent3: "#10b981", accent4: "#f43f5e", bg: "#1f2937", surface: "#111827" } : 
        { text: "#6b7280", title: "#111827", grid: "#e5e7eb", accent1: "#7c3aed", accent2: "#2563eb", accent3: "#059669", accent4: "#e11d48", bg: "#ffffff", surface: "#f9fafb" };

    // --- D3 Refs ---
    const networkRef = useRef<SVGSVGElement>(null);
    const bundlingRef = useRef<SVGSVGElement>(null);
    const chordRef = useRef<SVGSVGElement>(null);
    const boxplotRef = useRef<SVGSVGElement>(null);
    const correlogramRef = useRef<SVGSVGElement>(null);
    const connectedScatterRef = useRef<SVGSVGElement>(null);

    // --- Mock Schema-Aligned Data ---

    // 1. Boxplot Data (durationMs distributions by ModelCaliber)
    const boxplotRawData = [
        { model: "Nova Pro", data: Array.from({length: 100}, () => Math.random() * 1200 + 300) },
        { model: "Claude 3.5", data: Array.from({length: 100}, () => Math.random() * 1500 + 400) },
        { model: "Titan Embed", data: Array.from({length: 100}, () => Math.random() * 200 + 50) },
        { model: "Llama 3", data: Array.from({length: 100}, () => Math.random() * 800 + 200) }
    ];

    // 2. Correlation Matrix Data (Input, Output, Latency, Cost)
    const metrics = ["Input", "Output", "Latency", "Cost"];
    const correlationMatrix = [
        [1, 0.4, 0.8, 0.9],
        [0.4, 1, 0.6, 0.7],
        [0.8, 0.6, 1, 0.85],
        [0.9, 0.7, 0.85, 1]
    ];

    // 3. Connected Scatterplot (Token Yield vs Cost over sequential time)
    const trajectoryData = Array.from({length: 20}, (_, i) => ({
        step: i,
        cost: 100 + (i * 15) + (Math.random() * 20 - 10),
        tokens: 500 + (i * 40) + (Math.random() * 100 - 50)
    }));

    // 4. Chord Diagram Data (Token Flow between Agent Roles)
    const chordMatrix = [
        [0,  50, 30, 20], // From Supervisor
        [10, 0,  60, 15], // From Collaborator A
        [5,  20, 0,  40], // From Collaborator B
        [50, 10, 10, 0 ]  // From Standard
    ];
    const roleNames = ["Supervisor", "Collab A", "Collab B", "Standard"];

    // 5. Network Graph Data (Profiles & Tools)
    const networkNodes = [
        { id: "Sup_Main", group: 1, label: "Chief Exec Agent" },
        { id: "Collab_Dev", group: 2, label: "DevOps Agent" },
        { id: "Collab_Data", group: 2, label: "Data Analyst" },
        { id: "Tool_Luma", group: 3, label: "Luma Video" },
        { id: "Tool_DB", group: 3, label: "Postgres MCP" },
        { id: "Tool_Git", group: 3, label: "GitHub Webhook" }
    ];
    const networkLinks = [
        { source: "Sup_Main", target: "Collab_Dev", value: 5 },
        { source: "Sup_Main", target: "Collab_Data", value: 3 },
        { source: "Collab_Dev", target: "Tool_Git", value: 8 },
        { source: "Collab_Data", target: "Tool_DB", value: 10 },
        { source: "Collab_Data", target: "Tool_Luma", value: 2 }
    ];

    // 6. Hierarchical Edge Bundling (Tool Routing)
    const bundleHierarchy = {
        name: "root",
        children: [
            { name: "Agents", children: [{ name: "Agents.Supervisor" }, { name: "Agents.Analyst" }, { name: "Agents.Writer" }] },
            { name: "APIs", children: [{ name: "APIs.Anthropic" }, { name: "APIs.Nova" }] },
            { name: "Tools", children: [{ name: "Tools.Postgres" }, { name: "Tools.Salesforce" }, { name: "Tools.Luma" }] }
        ]
    };
    const bundleLinks = [
        { source: "Agents.Supervisor", target: "APIs.Nova" },
        { source: "Agents.Supervisor", target: "Agents.Analyst" },
        { source: "Agents.Analyst", target: "Tools.Postgres" },
        { source: "Agents.Writer", target: "APIs.Anthropic" },
        { source: "Agents.Writer", target: "Tools.Luma" },
        { source: "APIs.Anthropic", target: "Tools.Salesforce" }
    ];

    // Filter network nodes based on search
    const filteredNodes = useMemo(() => 
        networkNodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase())), 
    [searchQuery]);

    // --- 1. Network Graph (Force Directed Topology) ---
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
            g.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").style("fill", d3Colors.text).text("No matching ecosystem nodes");
            return;
        }

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = g.append("g").selectAll("line").data(links).enter().append("line")
            .attr("stroke", d3Colors.grid).attr("stroke-opacity", 0.6).attr("stroke-width", (d: any) => Math.sqrt(d.value));

        const node = g.append("g").selectAll("circle").data(nodes).enter().append("circle")
            .attr("r", 8)
            .attr("fill", (d: any) => d.group === 1 ? d3Colors.accent1 : d.group === 2 ? d3Colors.accent2 : d3Colors.accent3)
            .attr("stroke", d3Colors.bg).attr("stroke-width", 1.5);

        const labels = g.append("g").selectAll("text").data(nodes).enter().append("text")
            .text((d: any) => d.label)
            .attr("x", 12).attr("y", 3)
            .style("fill", d3Colors.title).style("font-size", "10px").style("font-family", "Google Sans Code");

        simulation.on("tick", () => {
            link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
            node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
            labels.attr("x", (d: any) => d.x + 12).attr("y", (d: any) => d.y + 3);
        });
    }, [darkMode, filteredNodes]);

    // --- 2. Hierarchical Edge Bundling (Execution Routing) ---
    useEffect(() => {
        if (!bundlingRef.current) return;
        const svg = d3.select(bundlingRef.current);
        svg.selectAll("*").remove();

        const width = 400, height = 400, radius = width / 2 - 60;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const cluster = d3.cluster<any>().size([2 * Math.PI, radius]);
        const root = d3.hierarchy(bundleHierarchy);
        cluster(root);

        const nodeByName = new Map(root.leaves().map(d => [d.data.name, d]));
        const linkData = bundleLinks.map(l => ({ source: nodeByName.get(l.source), target: nodeByName.get(l.target) }));

        const line = d3.lineRadial<any>().curve(d3.curveBundle.beta(0.85))
            .radius((d: any) => d.y).angle((d: any) => d.x);

        g.append("g").selectAll("path").data(linkData).enter().append("path")
            .attr("d", (d: any) => line(d.source.path(d.target)))
            .style("fill", "none").style("stroke", d3Colors.accent2).style("stroke-width", 2).style("opacity", 0.4)
            .on("mouseover", function() { d3.select(this).style("stroke", d3Colors.accent4).style("opacity", 1).style("stroke-width", 3); })
            .on("mouseout", function() { d3.select(this).style("stroke", d3Colors.accent2).style("opacity", 0.4).style("stroke-width", 2); });

        const node = g.append("g").selectAll("g").data(root.leaves()).enter().append("g")
            .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

        node.append("circle").attr("r", 4).style("fill", d3Colors.accent1);

        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => d.x < Math.PI ? 6 : -6)
            .style("text-anchor", (d: any) => d.x < Math.PI ? "start" : "end")
            .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
            .text((d: any) => d.data.name.split('.')[1])
            .style("font-size", "10px").style("fill", d3Colors.text).style("font-family", "Google Sans Code");

    }, [darkMode]);

    // --- 3. Chord Diagram (Context Flow) ---
    useEffect(() => {
        if (!chordRef.current) return;
        const svg = d3.select(chordRef.current);
        svg.selectAll("*").remove();

        const width = 350, height = 350, innerRadius = 100, outerRadius = 110;
        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(chordMatrix);
        const color = d3.scaleOrdinal<number, string>().domain(d3.range(4)).range([d3Colors.accent1, d3Colors.accent2, d3Colors.accent3, d3Colors.accent4]);

        const group = g.append("g").selectAll("g").data(chord.groups).enter().append("g");
        
        group.append("path")
            .style("fill", d => color(d.index)).style("stroke", d3Colors.bg)
            .attr("d", d3.arc<any>().innerRadius(innerRadius).outerRadius(outerRadius));

        group.append("text")
            .each(d => { (d as any).angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", (d: any) => `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + 10}) ${d.angle > Math.PI ? "rotate(180)" : ""}`)
            .style("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
            .text((d: any) => roleNames[d.index])
            .style("font-size", "10px").style("fill", d3Colors.title).style("font-family", "Google Sans Code");

        g.append("g").attr("fill-opacity", 0.6).selectAll("path").data(chord).enter().append("path")
            // FIX: Explicitly cast the d3.ribbon as any to prevent strict type mismatch with d3.chord
            .attr("d", d3.ribbon<any, any>().radius(innerRadius) as any)
            .style("fill", (d: any) => color(d.source.index)).style("stroke", d3Colors.bg)
            .on("mouseover", function() { d3.select(this).style("fill-opacity", 1); })
            .on("mouseout", function() { d3.select(this).style("fill-opacity", 0.6); });

    }, [darkMode]);

    // --- 4. Boxplot (Latency Distribution) ---
    useEffect(() => {
        if (!boxplotRef.current) return;
        const svg = d3.select(boxplotRef.current);
        svg.selectAll("*").remove();

        const width = 400, height = 250, margin = {top: 10, right: 30, bottom: 30, left: 80};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const y = d3.scaleBand().range([innerH, 0]).domain(boxplotRawData.map(d => d.model)).paddingInner(1).paddingOuter(0.5);
        const x = d3.scaleLinear().domain([0, 2000]).range([0, innerW]);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5)).style("color", d3Colors.text);
        g.append("g").call(d3.axisLeft(y)).style("color", d3Colors.title).style("font-family", "Google Sans Code").style("font-weight", "bold").selectAll(".domain, .tick line").remove();

        const boxData = boxplotRawData.map(d => {
            const sorted = d.data.sort(d3.ascending);
            return {
                model: d.model, q1: d3.quantile(sorted, 0.25)!, median: d3.quantile(sorted, 0.5)!, q3: d3.quantile(sorted, 0.75)!,
                min: d3.min(sorted)!, max: d3.max(sorted)!
            };
        });

        g.selectAll("vertLines").data(boxData).enter().append("line")
            .attr("x1", d => x(d.min)).attr("x2", d => x(d.max))
            .attr("y1", d => y(d.model) as number).attr("y2", d => y(d.model) as number)
            .attr("stroke", d3Colors.grid).attr("stroke-width", 1.5);

        const boxWidth = 20;
        g.selectAll("boxes").data(boxData).enter().append("rect")
            .attr("x", d => x(d.q1)).attr("y", d => (y(d.model) as number) - boxWidth/2)
            .attr("width", d => x(d.q3) - x(d.q1)).attr("height", boxWidth)
            .attr("stroke", d3Colors.bg).attr("fill", d3Colors.accent2).attr("fill-opacity", 0.6);

        g.selectAll("medianLines").data(boxData).enter().append("line")
            .attr("x1", d => x(d.median)).attr("x2", d => x(d.median))
            .attr("y1", d => (y(d.model) as number) - boxWidth/2).attr("y2", d => (y(d.model) as number) + boxWidth/2)
            .attr("stroke", d3Colors.bg).attr("stroke-width", 2);

    }, [darkMode]);

    // --- 5. Correlogram (Metric Matrix) ---
    useEffect(() => {
        if (!correlogramRef.current) return;
        const svg = d3.select(correlogramRef.current);
        svg.selectAll("*").remove();

        const width = 300, height = 300, margin = {top: 30, right: 30, bottom: 30, left: 50};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand().range([0, innerW]).domain(metrics).padding(0.05);
        const y = d3.scaleBand().range([innerH, 0]).domain(metrics.slice().reverse()).padding(0.05);

        const color = d3.scaleLinear<string>().domain([0, 0.5, 1]).range([darkMode ? "#1f2937" : "#f3f4f6", d3Colors.accent2, d3Colors.accent4]);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x)).style("color", d3Colors.title).style("font-family", "Google Sans Code").selectAll(".domain, .tick line").remove();
        g.append("g").call(d3.axisLeft(y)).style("color", d3Colors.title).style("font-family", "Google Sans Code").selectAll(".domain, .tick line").remove();

        const rectData: any[] = [];
        metrics.forEach((m1, i) => {
            metrics.forEach((m2, j) => {
                rectData.push({ x: m1, y: m2, value: correlationMatrix[i][j] });
            });
        });

        g.selectAll("rect").data(rectData).enter().append("rect")
            .attr("x", (d: any) => x(d.x) as number).attr("y", (d: any) => y(d.y) as number)
            .attr("width", x.bandwidth()).attr("height", y.bandwidth())
            .style("fill", (d: any) => color(d.value)).attr("rx", 4)
            .on("mouseover", function() { d3.select(this).style("stroke", d3Colors.title).style("stroke-width", 2); })
            .on("mouseout", function() { d3.select(this).style("stroke", "none"); })
            .append("title").text((d: any) => `Correlation: ${d.value.toFixed(2)}`);

        g.selectAll(".val").data(rectData).enter().append("text")
            .attr("x", (d: any) => (x(d.x) as number) + x.bandwidth()/2)
            .attr("y", (d: any) => (y(d.y) as number) + y.bandwidth()/2)
            .text((d: any) => d.value.toFixed(2))
            .style("text-anchor", "middle").style("alignment-baseline", "central")
            .style("font-size", "10px").style("fill", (d: any) => d.value > 0.6 ? "#ffffff" : d3Colors.text).style("font-family", "Google Sans Code");

    }, [darkMode]);

    // --- 6. Connected Scatterplot (Efficiency Trajectory) ---
    useEffect(() => {
        if (!connectedScatterRef.current) return;
        const svg = d3.select(connectedScatterRef.current);
        svg.selectAll("*").remove();

        const width = 450, height = 250, margin = {top: 20, right: 30, bottom: 40, left: 50};
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg.attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([0, 1500]).range([0, innerW]);
        const y = d3.scaleLinear().domain([0, 500]).range([innerH, 0]);

        g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6)).style("color", d3Colors.text);
        g.append("g").call(d3.axisLeft(y).ticks(5)).style("color", d3Colors.text);

        g.append("text").attr("x", innerW/2).attr("y", innerH + 35).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Tokens Yielded (Output)");
        g.append("text").attr("transform", "rotate(-90)").attr("y", -35).attr("x", -innerH/2).style("text-anchor", "middle").style("font-size", "10px").style("fill", d3Colors.text).text("Execution Cost (Credits)");

        const line = d3.line<any>().x(d => x(d.tokens)).y(d => y(d.cost)).curve(d3.curveCatmullRom);

        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient").attr("id", "trajGrad").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", d3Colors.accent2);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", d3Colors.accent4);

        g.append("path").datum(trajectoryData)
            .attr("d", line).attr("fill", "none")
            .attr("stroke", "url(#trajGrad)").attr("stroke-width", 2).attr("opacity", 0.6);

        g.selectAll("circle").data(trajectoryData).enter().append("circle")
            .attr("cx", d => x(d.tokens)).attr("cy", d => y(d.cost))
            .attr("r", 4).attr("fill", d3Colors.bg).attr("stroke", (_, i) => i === trajectoryData.length - 1 ? d3Colors.accent4 : d3Colors.accent2).attr("stroke-width", 2)
            .append("title").text(d => `Step ${d.step}: ${d.tokens.toFixed(0)} tokens / ${d.cost.toFixed(0)} crd`);

        const lastPoint = trajectoryData[trajectoryData.length - 1];
        g.append("text").attr("x", x(lastPoint.tokens) - 10).attr("y", y(lastPoint.cost) - 10)
            .text("Current Trajectory").style("font-size", "10px").style("fill", d3Colors.accent4).style("font-weight", "bold");

    }, [darkMode]);

    return (
        <div className="system-overview-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* KPI ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="ft-card stat-counter flash-card" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Autonomy Ratio</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>76.4%</h1>
                    <span className="trend positive"><i className="bx bx-bot"></i> Zero-Touch Execution</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Network Handoff Latency</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code', color: d3Colors.accent4 }}>840ms</h1>
                    <span className="trend negative"><i className="bx bx-error"></i> Supervisor Bottleneck</span>
                </div>
                <div className="ft-card stat-counter" style={{ padding: '1.5rem' }}>
                    <span className="label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost-to-Yield Ratio</span>
                    <h1 className="metric" style={{ margin: '0.5rem 0', fontFamily: 'Google Sans Code' }}>0.41</h1>
                    <span className="trend neutral">Optimal Correlation</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Agentic Ecosystem Topology</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Force-directed network mapping of Profile ↔ Tool invocation clusters.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', backgroundColor: d3Colors.surface, borderRadius: '8px' }}>
                        <svg ref={networkRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>
                
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Execution Routing Bundles</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Hierarchical edge bundling of cross-component agent workflow dependencies.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={bundlingRef} style={{ width: '100%', height: 'auto', maxHeight: '350px' }}></svg>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Context Token Exchange</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Chord diagram mapping I/O token flow volume between specialized agent roles.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={chordRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Metric Correlation Matrix</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Correlogram heatmap isolating dependencies between Cost, Time, and Yield.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={correlogramRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Efficiency Trajectory Vector</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Connected scatterplot tracking chronologically how token yield scales against compute cost.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={connectedScatterRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>

                <div className="ft-card d3-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: `1px solid ${d3Colors.grid}`, paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Latency Distributions</h3>
                        <span style={{ fontSize: '0.75rem', color: d3Colors.text }}>Boxplot revealing Q1/Q3 variance and median bounds per foundational model.</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <svg ref={boxplotRef} style={{ width: '100%', height: 'auto', maxHeight: '300px' }}></svg>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default AgenticEcosystem;