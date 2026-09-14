import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import '../styles/agentnodes.scss';

interface AgentNodesProps {
    searchQuery: string;
    darkMode: boolean;
}

const AgentNodes: React.FC<AgentNodesProps> = ({ searchQuery, darkMode }) => {
    
    // --- Refs (Fixed TS null assignment) ---
    const violinRef = useRef<SVGSVGElement | null>(null);
    const ridgeRef = useRef<SVGSVGElement | null>(null);
    const arcRef = useRef<SVGSVGElement | null>(null);
    const edgeRef1 = useRef<SVGSVGElement | null>(null);
    const edgeRef2 = useRef<SVGSVGElement | null>(null);

    // --- Mock Data ---
    const rawViolinData = [
        { model: "Nova Pro", tokens: [120, 150, 180, 220, 250, 220, 180, 150, 120] },
        { model: "Claude 3", tokens: [80, 100, 300, 400, 300, 100, 80] },
        { model: "Luma Video", tokens: [400, 450, 500, 450, 400] }
    ];

    const rawRidgeData = [
        { profile: "Support Agent", values: [10, 20, 50, 80, 50, 20, 10] },
        { profile: "Code Copilot", values: [5, 10, 20, 60, 90, 60, 20, 10, 5] },
        { profile: "Data Analyst", values: [30, 40, 70, 40, 30] }
    ];

    const rawArcData = {
        nodes: [
            { id: "P-Support", group: 1 }, { id: "P-Code", group: 1 }, { id: "P-Data", group: 1 },
            { id: "W-Jira", group: 2 }, { id: "W-GitHub", group: 2 }, { id: "W-Snowflake", group: 2 },
            { id: "T-Session A", group: 3 }, { id: "T-Session B", group: 3 }
        ],
        links: [
            { source: "P-Support", target: "W-Jira", value: 10 },
            { source: "P-Code", target: "W-GitHub", value: 20 },
            { source: "P-Data", target: "W-Snowflake", value: 15 },
            { source: "P-Support", target: "T-Session A", value: 5 },
            { source: "P-Data", target: "T-Session B", value: 8 }
        ]
    };

    // --- Data Filters ---
    const violinData = rawViolinData.filter(d => d.model.toLowerCase().includes(searchQuery.toLowerCase()));
    const ridgeData = rawRidgeData.filter(d => d.profile.toLowerCase().includes(searchQuery.toLowerCase()));
    const arcData = {
        nodes: rawArcData.nodes.filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === ''),
        links: rawArcData.links
    };

    // --- Hierarchical Edge Bundling Data Builder (With Active Search Filtering) ---
    const buildHierarchy = (filter: string) => {
        const query = filter.toLowerCase();
        
        const rawData = [
            { name: "Models", children: [{ name: "Nova Pro", imports: ["P-Support", "P-Data"] }, { name: "Claude 3", imports: ["P-Code"] }] },
            { name: "Profiles", children: [{ name: "P-Support", imports: ["W-Jira", "V-Docs"] }, { name: "P-Code", imports: ["W-GitHub"] }, { name: "P-Data", imports: ["W-Snowflake"] }] },
            { name: "Workflows", children: [{ name: "W-Jira", imports: [] }, { name: "W-GitHub", imports: [] }, { name: "W-Snowflake", imports: [] }] },
            { name: "Vectors", children: [{ name: "V-Docs", imports: [] }] }
        ];

        if (!query) return { name: "root", children: rawData };

        const filteredChildren = rawData.map(category => ({
            ...category,
            children: category.children.filter(node => 
                node.name.toLowerCase().includes(query) || 
                node.imports.some((imp: string) => imp.toLowerCase().includes(query))
            )
        })).filter(category => category.children.length > 0);

        return {
            name: "root",
            children: filteredChildren.length > 0 ? filteredChildren : [{ name: "No Results", children: [] }]
        };
    };

    // --- 1. Violin Chart (Foundation Models vs Usage) ---
    useEffect(() => {
        if (!violinRef.current) return;
        d3.select(violinRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 30, left: 40 };
        const width = 400 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        const svg = d3.select(violinRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (violinData.length === 0) return;

        const y = d3.scaleBand().range([0, height]).domain(violinData.map(d => d.model)).padding(0.1);
        const x = d3.scaleLinear().domain([0, 500]).range([0, width]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("g").call(d3.axisLeft(y)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        const color = d3.scaleOrdinal().domain(violinData.map(d => d.model)).range(["#0891b2", "#800020", "#10b981"]);

        violinData.forEach(d => {
            const area = d3.area<number>()
                .x((_, i) => x(i * 60))
                .y0(y(d.model)! + y.bandwidth() / 2)
                .y1((val) => y(d.model)! + y.bandwidth() / 2 - val / 10)
                .curve(d3.curveCatmullRom);

            const areaBottom = d3.area<number>()
                .x((_, i) => x(i * 60))
                .y0(y(d.model)! + y.bandwidth() / 2)
                .y1((val) => y(d.model)! + y.bandwidth() / 2 + val / 10)
                .curve(d3.curveCatmullRom);

            svg.append("path").datum(d.tokens).style("stroke", "none").style("fill", color(d.model) as string).style("opacity", 0.7).attr("d", area);
            svg.append("path").datum(d.tokens).style("stroke", "none").style("fill", color(d.model) as string).style("opacity", 0.7).attr("d", areaBottom);
        });
    }, [darkMode, violinData]);

    // --- 2. Ridgeline Chart (Density over Time) ---
    useEffect(() => {
        if (!ridgeRef.current) return;
        d3.select(ridgeRef.current).selectAll("*").remove();

        const margin = { top: 30, right: 20, bottom: 30, left: 80 };
        const width = 400 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        const svg = d3.select(ridgeRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (ridgeData.length === 0) return;

        const x = d3.scaleLinear().domain([0, 8]).range([0, width]);
        const yName = d3.scaleBand().domain(ridgeData.map(d => d.profile)).range([0, height]).paddingInner(1);
        const y = d3.scaleLinear().domain([0, 100]).range([height / 2, 0]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("g").call(d3.axisLeft(yName)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        const color = d3.scaleOrdinal().domain(ridgeData.map(d => d.profile)).range(["#800020", "#0891b2", "#f59e0b"]);

        ridgeData.forEach(d => {
            const area = d3.area<number>()
                .x((_, i) => x(i))
                .y0(y(0))
                .y1((val) => y(val))
                .curve(d3.curveBasis);

            svg.append("g")
                .attr("transform", `translate(0, ${(yName(d.profile) || 0) - height / 4})`)
                .append("path")
                .datum(d.values)
                .attr("fill", color(d.profile) as string)
                .attr("stroke", darkMode ? "#fff" : "#000")
                .attr("stroke-width", 1)
                .style("opacity", 0.8)
                .attr("d", area);
        });
    }, [darkMode, ridgeData]);

    // --- 3. Arc Diagram (Profiles, Workflows, Sessions) ---
    useEffect(() => {
        if (!arcRef.current) return;
        d3.select(arcRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 30, bottom: 50, left: 30 };
        const width = 800 - margin.left - margin.right;
        const height = 250 - margin.top - margin.bottom;

        const svg = d3.select(arcRef.current)
            .attr("viewBox", `0 0 800 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (arcData.nodes.length === 0) return;

        const allNodeIds = arcData.nodes.map(n => n.id);
        const x = d3.scalePoint().range([0, width]).domain(allNodeIds);
        const color = d3.scaleOrdinal().domain(["1", "2", "3"]).range(["#0891b2", "#800020", "#10b981"]);

        // Draw Links (Arcs)
        svg.selectAll("path")
            .data(arcData.links.filter(l => allNodeIds.includes(l.source) && allNodeIds.includes(l.target)))
            .enter().append("path")
            .attr("d", (d: any) => {
                const start = x(d.source)!;
                const end = x(d.target)!;
                const r = Math.abs(end - start) / 2;
                return `M ${start},${height - 30} A ${r},${r} 0 0,${start < end ? 1 : 0} ${end},${height - 30}`;
            })
            .style("fill", "none")
            .style("stroke", darkMode ? "#4b5563" : "#d1d5db")
            .style("stroke-width", (d: any) => d.value / 3)
            .style("opacity", 0.6);

        // Draw Nodes
        svg.selectAll("circle")
            .data(arcData.nodes)
            .enter().append("circle")
            .attr("cx", (d: any) => x(d.id)!)
            .attr("cy", height - 30)
            .attr("r", 8)
            .style("fill", (d: any) => color(d.group.toString()) as string)
            .style("stroke", darkMode ? "#1f2937" : "#fff");

        // Draw Labels
        svg.selectAll("text")
            .data(arcData.nodes)
            .enter().append("text")
            .attr("x", (d: any) => x(d.id)!)
            .attr("y", height - 10)
            .text((d: any) => d.id)
            .style("text-anchor", "end")
            .style("font-size", "10px")
            .style("fill", darkMode ? "#9ca3af" : "#4b5563")
            .attr("transform", (d: any) => `rotate(-45, ${x(d.id)}, ${height - 10})`);
    }, [darkMode, arcData]);

    // --- 4 & 5. Hierarchical Edge Bundling (Simulated via Radial Cluster) ---
    const drawRadialCluster = (ref: React.RefObject<SVGSVGElement | null>, size: number) => {
        if (!ref.current) return;
        d3.select(ref.current).selectAll("*").remove();

        const radius = size / 2 - 60;
        const svg = d3.select(ref.current)
            .attr("viewBox", `0 0 ${size} ${size}`)
            .append("g").attr("transform", `translate(${size / 2},${size / 2})`);

        const rootData = buildHierarchy(searchQuery);
        
        // Safety catch if search yields no results
        if (!rootData.children || rootData.children[0].name === "No Results") {
            svg.append("text")
                .attr("text-anchor", "middle")
                .style("fill", "#9ca3af")
                .style("font-family", "monospace")
                .text("No data matching search.");
            return;
        }

        const root = d3.hierarchy<any>(rootData);
        const cluster = d3.cluster<any>().size([2 * Math.PI, radius]);
        cluster(root);

        const line = d3.lineRadial<any>()
            .angle((d: any) => d.x)
            .radius((d: any) => d.y)
            .curve(d3.curveBundle.beta(0.85));

        const links = root.links();
        svg.selectAll("path")
            .data(links)
            .enter().append("path")
            .attr("d", (d: any) => line([d.source, {x: d.source.x, y: 0}, d.target]) as string)
            .style("fill", "none")
            .style("stroke", darkMode ? "#374151" : "#e5e7eb")
            .style("stroke-width", 1.5)
            .style("opacity", 0.6);

        const node = svg.selectAll("g")
            .data(root.descendants().filter(d => d.depth > 0))
            .enter().append("g")
            .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

        node.append("circle")
            .attr("r", 4)
            .style("fill", (d: any) => d.children ? "#800020" : "#0891b2");

        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => d.x < Math.PI === !d.children ? 6 : -6)
            .style("text-anchor", (d: any) => d.x < Math.PI === !d.children ? "start" : "end")
            .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
            .text((d: any) => d.data.name)
            .style("font-size", "10px")
            .style("fill", darkMode ? "#d1d5db" : "#374151");
    };

    useEffect(() => {
        drawRadialCluster(edgeRef1, 300);
        drawRadialCluster(edgeRef2, 500); // Larger scale for Line 3
    }, [darkMode, searchQuery]);

    return (
        <div className="agent-nodes-grid">
            
            {/* LINE 1 */}
            <div className="an-row an-line-1">
                <div className="ft-card an-d3-card">
                    <div className="an-card-header">
                        <h3>Model Telemetry Distribution</h3>
                        <span className="an-subtitle">Violin chart rendering API latency/tokens.</span>
                    </div>
                    {violinData.length === 0 ? <p className="an-no-data">No data matching search.</p> : <svg ref={violinRef}></svg>}
                </div>

                <div className="ft-card an-d3-card">
                    <div className="an-card-header">
                        <h3>Context Profile Density</h3>
                        <span className="an-subtitle">Ridgeline chart of temporal invocations.</span>
                    </div>
                    {ridgeData.length === 0 ? <p className="an-no-data">No data matching search.</p> : <svg ref={ridgeRef}></svg>}
                </div>
            </div>

            {/* LINE 2 */}
            <div className="an-row an-line-2">
                <div className="ft-card an-d3-card">
                    <div className="an-card-header">
                        <h3>Workflow & Session Topography</h3>
                        <span className="an-subtitle">Arc diagram linking Profiles to execution environments.</span>
                    </div>
                    {arcData.nodes.length === 0 ? <p className="an-no-data">No data matching search.</p> : <svg ref={arcRef}></svg>}
                </div>

                <div className="ft-card an-d3-card">
                    <div className="an-card-header">
                        <h3>Ecosystem Edge Bundling</h3>
                        <span className="an-subtitle">Hierarchical links mapped across Models and Workflows.</span>
                    </div>
                    <svg ref={edgeRef1}></svg>
                </div>
            </div>

            {/* LINE 3 */}
            <div className="an-row an-line-3">
                <div className="ft-card an-d3-card an-span-full">
                    <div className="an-card-header" style={{ textAlign: 'center' }}>
                        <h3>Macro System Topography</h3>
                        <span className="an-subtitle">Full-spectrum Edge Bundling: Models → Profiles → Workflows → Artifacts.</span>
                    </div>
                    <svg ref={edgeRef2} style={{ maxHeight: '400px' }}></svg>
                </div>
            </div>

        </div>
    );
};

export default AgentNodes;