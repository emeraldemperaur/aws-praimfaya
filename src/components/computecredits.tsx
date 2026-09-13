import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import '../styles/computecredits.scss';

interface ComputeCreditsProps {
    searchQuery: string;
    darkMode: boolean;
}

const ComputeCredits: React.FC<ComputeCreditsProps> = ({ searchQuery, darkMode }) => {
    // --- Mock Data ---
    const burnrateData = [
        { date: new Date("2026-09-01"), credits: 1200 }, { date: new Date("2026-09-02"), credits: 1500 },
        { date: new Date("2026-09-03"), credits: 3400 }, { date: new Date("2026-09-04"), credits: 2100 },
        { date: new Date("2026-09-05"), credits: 4500 }, { date: new Date("2026-09-06"), credits: 3100 },
        { date: new Date("2026-09-07"), credits: 5200 }
    ];

    const allScatterData = [
        { session: "Data Extract", model: "amazon.nova-pro", in: 120000, out: 400 },
        { session: "Code Gen", model: "anthropic.claude-3", in: 15000, out: 4500 },
        { session: "Log Triage", model: "amazon.nova-lite", in: 85000, out: 150 },
        { session: "Creative Doc", model: "anthropic.claude-3", in: 5000, out: 3000 },
        { session: "Agent Loop", model: "amazon.nova-pro", in: 45000, out: 800 }
    ];

    const allBubbleData = [
        { name: "Shopify Agent", invocations: 145, avgCost: 350, totalTokens: 500000 },
        { name: "Luma Video Gen", invocations: 12, avgCost: 4500, totalTokens: 54000 },
        { name: "Zendesk Triage", invocations: 890, avgCost: 45, totalTokens: 40000 },
        { name: "PowerPoint Architect", invocations: 34, avgCost: 1200, totalTokens: 40800 },
        { name: "Datadog SRE", invocations: 210, avgCost: 150, totalTokens: 31500 }
    ];

    const scatterData = allScatterData.filter(d => d.session.toLowerCase().includes(searchQuery.toLowerCase()) || d.model.toLowerCase().includes(searchQuery.toLowerCase()));
    const bubbleData = allBubbleData.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // --- D3 Refs ---
    const lineRef = useRef<SVGSVGElement>(null);
    const radialRef = useRef<SVGSVGElement>(null);
    const scatterRef = useRef<SVGSVGElement>(null);
    const bubbleRef = useRef<SVGSVGElement>(null);
    const packRef = useRef<SVGSVGElement>(null);
    const sunburstRef = useRef<SVGSVGElement>(null);
    const chordRef = useRef<SVGSVGElement>(null);

    // 1. Burnrate Line Chart
    useEffect(() => {
        if (!lineRef.current) return;
        d3.select(lineRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 30, left: 40 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        const svg = d3.select(lineRef.current)
            .attr("viewBox", `0 0 400 200`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleTime().domain(d3.extent(burnrateData, (d: any) => d.date) as [Date, Date]).range([0, width]);
        const y = d3.scaleLinear().domain([0, d3.max(burnrateData, (d: any) => d.credits) as number * 1.2]).range([height, 0]);

        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d") as any))
            .attr("color", darkMode ? "#9ca3af" : "#6b7280");

        svg.append("g").call(d3.axisLeft(y).ticks(5))
            .attr("color", darkMode ? "#9ca3af" : "#6b7280");

        const line = d3.line<any>().x(d => x(d.date)).y(d => y(d.credits)).curve(d3.curveMonotoneX);

        const path = svg.append("path")
            .datum(burnrateData)
            .attr("fill", "none")
            .attr("stroke", "#0891b2")
            .attr("stroke-width", 3)
            .attr("d", line);

        const totalLength = path.node()?.getTotalLength() || 0;

        path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
            .attr("stroke-dashoffset", totalLength)
            .transition().duration(2000).ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0);
    }, [darkMode, searchQuery]);

    // 2. Highest Compute Session
    useEffect(() => {
        if (!radialRef.current) return;
        d3.select(radialRef.current).selectAll("*").remove();

        const data = [
            { session: "S-892", LLM: 1200, Tool: 3000 },
            { session: "S-893", LLM: 2500, Tool: 500 },
            { session: "S-894", LLM: 800, Tool: 1500 },
            { session: "S-895", LLM: 4000, Tool: 200 }
        ];

        const width = 250, height = 250, innerRadius = 40, outerRadius = Math.min(width, height) / 2;
        const svg = d3.select(radialRef.current).attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const keys = ["LLM", "Tool"];
        const x = d3.scaleBand().range([0, 2 * Math.PI]).align(0).domain(data.map(d => d.session));
        const y = d3.scaleRadial().range([innerRadius, outerRadius]).domain([0, 5000]);
        const color = d3.scaleOrdinal().domain(keys).range(["#0891b2", "#800020"]);

        const arc = d3.arc<any>()
            .innerRadius(d => y(d[0])).outerRadius(d => y(d[1]))
            .startAngle((d: any) => x(d.data.session) as number)
            .endAngle((d: any) => (x(d.data.session) as number) + x.bandwidth())
            .padAngle(0.05).padRadius(innerRadius);

        svg.append("g").selectAll("g").data(d3.stack().keys(keys)(data as any)).enter().append("g")
            .attr("fill", d => color(d.key) as string)
            .selectAll("path").data(d => d).enter().append("path")
            .attr("d", arc);
    }, [darkMode]);

    // 3. Efficiency Scatter Plot
    useEffect(() => {
        if (!scatterRef.current) return;
        d3.select(scatterRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        const svg = d3.select(scatterRef.current).attr("viewBox", `0 0 400 200`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([0, 150000]).range([0, width]);
        const y = d3.scaleLinear().domain([0, 6000]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(["amazon.nova-pro", "anthropic.claude-3", "amazon.nova-lite"]).range(["#0891b2", "#800020", "#10b981"]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(4)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("g").call(d3.axisLeft(y).ticks(4)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        svg.append("line").attr("x1", x(0)).attr("y1", y(0)).attr("x2", x(150000)).attr("y2", y(6000))
            .attr("stroke", darkMode ? "#4b5563" : "#d1d5db").attr("stroke-dasharray", "4");

        svg.append("g").selectAll("circle").data(scatterData).enter().append("circle")
            .attr("cx", d => x(d.in)).attr("cy", d => y(d.out)).attr("r", 6)
            .style("fill", d => color(d.model) as string).style("opacity", 0.8)
            .append("title").text(d => `${d.session}: In ${d.in}, Out ${d.out}`);
    }, [darkMode, scatterData]);

    // 4. Agent Utilization Matrix
    useEffect(() => {
        if (!bubbleRef.current) return;
        d3.select(bubbleRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        const svg = d3.select(bubbleRef.current).attr("viewBox", `0 0 400 200`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([0, 1000]).range([0, width]);
        const y = d3.scaleLinear().domain([0, 5000]).range([height, 0]);
        const z = d3.scaleSqrt().domain([10000, 600000]).range([4, 25]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("g").call(d3.axisLeft(y).ticks(4)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        svg.append("g").selectAll("circle").data(bubbleData).enter().append("circle")
            .attr("cx", d => x(d.invocations)).attr("cy", d => y(d.avgCost)).attr("r", d => z(d.totalTokens))
            .style("fill", "#0891b2").style("opacity", 0.6).style("stroke", darkMode ? "#fff" : "#000")
            .append("title").text(d => d.name);
    }, [darkMode, bubbleData]);

    // 5. Tool Expenditure Breakdown 
    useEffect(() => {
        if (!packRef.current) return;
        d3.select(packRef.current).selectAll("*").remove();

        const data = {
            name: "Platform", children: [
                { name: "SaaS Ops", children: [{ name: "Salesforce", value: 4500 }, { name: "Zendesk", value: 1200 }] },
                { name: "Media", children: [{ name: "Luma", value: 8500 }, { name: "Titan", value: 3200 }] },
                { name: "Data", children: [{ name: "Snowflake", value: 5000 }, { name: "Datadog", value: 2100 }] }
            ]
        };

        const width = 250, height = 250;
        const svg = d3.select(packRef.current).attr("viewBox", `0 0 ${width} ${height}`);

        const color = d3.scaleSequential([8, 0], d3.interpolateGnBu);
        const pack = d3.pack<any>().size([width, height]).padding(3);
        const root = pack(d3.hierarchy<any>(data).sum((d: any) => d.value).sort((a: any, b: any) => b.value - a.value));

        const node = svg.selectAll("g").data(root.descendants()).enter().append("g")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

        node.append("circle")
            .attr("r", (d: any) => d.r)
            .style("fill", (d: any) => d.children ? color(d.depth) : "#800020")
            .style("stroke", darkMode ? "#374151" : "#e5e7eb");

        node.filter((d: any) => !d.children).append("text")
            .attr("dy", "0.3em").style("text-anchor", "middle").style("font-size", "10px")
            .style("fill", "#fff").text((d: any) => d.data.name.substring(0, d.r / 3));
    }, [darkMode]);

    // 6. Compute Value Flow 
    useEffect(() => {
        if (!sunburstRef.current) return;
        d3.select(sunburstRef.current).selectAll("*").remove();

        const data = {
            name: "Credits", children: [
                { name: "Inference", children: [{ name: "Nova", value: 6000 }, { name: "Claude", value: 4000 }] },
                { name: "Tools", children: [{ name: "APIs", value: 3000 }, { name: "Media", value: 7000 }] }
            ]
        };

        const width = 250, radius = width / 2;
        const svg = d3.select(sunburstRef.current).attr("viewBox", `0 0 ${width} ${width}`).append("g").attr("transform", `translate(${radius},${radius})`);

        const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));
        const partition = d3.partition<any>().size([2 * Math.PI, radius]);
        const root = partition(d3.hierarchy<any>(data).sum((d: any) => d.value));

        const arc = d3.arc<any>()
            .startAngle((d: any) => d.x0).endAngle((d: any) => d.x1)
            .innerRadius((d: any) => d.y0).outerRadius((d: any) => d.y1);

        svg.selectAll("path").data(root.descendants().filter((d: any) => d.depth)).enter().append("path")
            .attr("d", arc)
            .style("fill", (d: any) => { while (d.depth > 1) d = d.parent!; return color(d.data.name) as string; })
            .style("stroke", darkMode ? "#1f2937" : "#fff");
    }, [darkMode]);

    // 7. Agent/Tool Interconnectivity 
    useEffect(() => {
        if (!chordRef.current) return;
        d3.select(chordRef.current).selectAll("*").remove();

        const matrix = [
            [0, 50,  30, 20],
            [10, 0,  40, 60],
            [5,  15, 0,  80],
            [20, 20, 10, 0 ] 
        ];

        const width = 250, height = 250, outerRadius = Math.min(width, height) * 0.5 - 10, innerRadius = outerRadius - 15;
        const svg = d3.select(chordRef.current).attr("viewBox", `0 0 ${width} ${height}`).append("g").attr("transform", `translate(${width/2},${height/2})`);

        const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
        const arc = d3.arc<any, any>().innerRadius(innerRadius).outerRadius(outerRadius);
        const ribbon = d3.ribbon<any, any>().radius(innerRadius);
        const color = d3.scaleOrdinal().domain(d3.range(4).map(String)).range(["#0891b2", "#800020", "#10b981", "#f59e0b"]);

        const group = svg.append("g").selectAll("g").data(chord.groups).enter().append("g");
        
        group.append("path")
            .style("fill", (d: any) => color(d.index.toString()) as string)
            .style("stroke", darkMode ? "#374151" : "#fff")
            .attr("d", (d: any) => (arc as any)(d)); 

        svg.append("g").attr("fill-opacity", 0.67).selectAll("path").data(chord).enter().append("path")
            .attr("d", (d: any) => (ribbon as any)(d)) 
            .style("fill", (d: any) => color(d.target.index.toString()) as string)
            .style("stroke", darkMode ? "#374151" : "#fff");
    }, [darkMode]);

    return (
        <div className="compute-credits-grid">

            {/* LINE 1 */}
            <div className="cc-row cc-line-1">
                <div className="ft-card">
                    <div className="cc-card-header">
                        <h3>Compute Credits Burnrate</h3>
                    </div>
                    <div className="cc-d3-container cc-line-chart-container">
                        <svg ref={lineRef}></svg>
                    </div>
                </div>
                
                <div className="ft-card cc-d3-card">
                    <span className="cc-label">Highest Compute Sessions</span>
                    <svg ref={radialRef}></svg>
                </div>
            </div>

            {/* LINE 3 */}
            <div className="cc-row cc-line-3">
                <div className="ft-card cc-d3-card">
                    <span className="cc-label">Tool Expenditure Topology</span>
                    <svg ref={packRef}></svg>
                </div>
                <div className="ft-card cc-d3-card">
                    <span className="cc-label">Compute Value Flow</span>
                    <svg ref={sunburstRef}></svg>
                </div>
                <div className="ft-card cc-d3-card">
                    <span className="cc-label">Agent & Tool Synergy</span>
                    <svg ref={chordRef}></svg>
                </div>
            </div>

            {/* LINE 2 */}
            <div className="cc-row cc-line-2">
                <div className="ft-card span-2">
                    <div className="cc-card-header">
                        <h3>Token Input vs. Output Efficiency</h3>
                        <span className="cc-subtitle">Identifies excessive context window stuffing.</span>
                    </div>
                    <div className="cc-d3-container">
                        {scatterData.length === 0 ? <p className="cc-no-data">No data matching search.</p> : <svg ref={scatterRef}></svg>}
                    </div>
                </div>
                <div className="ft-card span-2">
                    <div className="cc-card-header">
                        <h3>Agent Utilization Matrix</h3>
                        <span className="cc-subtitle">High Invocation vs. Compute Cost.</span>
                    </div>
                    <div className="cc-d3-container">
                        {bubbleData.length === 0 ? <p className="cc-no-data">No data matching search.</p> : <svg ref={bubbleRef}></svg>}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ComputeCredits;