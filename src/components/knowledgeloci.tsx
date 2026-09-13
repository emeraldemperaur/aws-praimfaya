import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import '../styles/knowledgeloci.scss';

interface KnowledgeLociProps {
    searchQuery: string;
    darkMode: boolean;
}

const KnowledgeLoci: React.FC<KnowledgeLociProps> = ({ searchQuery, darkMode }) => {
    // --- D3 Refs ---
    const areaRef = useRef<SVGSVGElement | null>(null);
    const arcRef = useRef<SVGSVGElement | null>(null);
    const bubbleRef = useRef<SVGSVGElement | null>(null);
    const barRef = useRef<SVGSVGElement | null>(null);

    // --- Mock Data ---
    const rawGrowthData = [
        { date: new Date("2026-08-01"), "HR Policies": 10, "API Docs": 5, "Product Specs": 20 },
        { date: new Date("2026-08-15"), "HR Policies": 15, "API Docs": 25, "Product Specs": 40 },
        { date: new Date("2026-09-01"), "HR Policies": 30, "API Docs": 80, "Product Specs": 90 },
        { date: new Date("2026-09-11"), "HR Policies": 45, "API Docs": 150, "Product Specs": 180 },
    ];

    const rawArcData = {
        nodes: [
            { id: "P-HR_Agent", group: "Profile" }, { id: "P-Dev_Bot", group: "Profile" },
            { id: "C-HR_Policies", group: "Collection" }, { id: "C-API_Docs", group: "Collection" },
            { id: "D-Leave_Policy.pdf", group: "Document" }, { id: "D-Auth_v2.md", group: "Document" }, { id: "D-Endpoints.csv", group: "Document" }
        ],
        links: [
            { source: "P-HR_Agent", target: "C-HR_Policies", value: 4 },
            { source: "P-Dev_Bot", target: "C-API_Docs", value: 6 },
            { source: "C-HR_Policies", target: "D-Leave_Policy.pdf", value: 2 },
            { source: "C-API_Docs", target: "D-Auth_v2.md", value: 3 },
            { source: "C-API_Docs", target: "D-Endpoints.csv", value: 3 }
        ]
    };

    const rawCollectionStats = [
        { collection: "HR Policies", vectors: 450, queries: 1200, credits: 3500 },
        { collection: "API Docs", vectors: 1500, queries: 8500, credits: 18000 },
        { collection: "Product Specs", vectors: 800, queries: 4100, credits: 8900 },
        { collection: "Legacy Code", vectors: 3200, queries: 150, credits: 900 }
    ];

    // --- Search Filtering ---
    const collectionsToKeep = ["HR Policies", "API Docs", "Product Specs", "Legacy Code"]
        .filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter Growth Data
    const growthData = rawGrowthData.map(d => {
        const filtered: any = { date: d.date };
        collectionsToKeep.forEach(c => { if (c in d) filtered[c] = (d as any)[c]; });
        return filtered;
    });

    // Filter Arc Data
    const arcData = {
        nodes: rawArcData.nodes.filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === ''),
        links: rawArcData.links
    };

    // Filter Stats Data (Used for Bubble and Bar charts)
    const statsData = rawCollectionStats.filter(d => 
        d.collection.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === ''
    );

    // --- 1. Vector Collection Growth (Stacked Area) ---
    useEffect(() => {
        if (!areaRef.current) return;
        d3.select(areaRef.current).selectAll("*").remove();

        const activeKeys = collectionsToKeep.filter(k => k !== "Legacy Code"); // Legacy code omitted from timeline mock
        if (activeKeys.length === 0) return;

        const margin = { top: 20, right: 30, bottom: 30, left: 40 },
              width = 400 - margin.left - margin.right,
              height = 250 - margin.top - margin.bottom;

        const svg = d3.select(areaRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const stackedData = d3.stack().keys(activeKeys)(growthData as any[]);

        const x = d3.scaleTime().domain(d3.extent(growthData, (d: any) => d.date) as [Date, Date]).range([0, width]);
        const y = d3.scaleLinear().domain([0, d3.max(stackedData, d => d3.max(d, d => d[1])) || 0]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(activeKeys).range(["#0891b2", "#800020", "#f59e0b"]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(4)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("g").call(d3.axisLeft(y).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        const area = d3.area<any>()
            .x(d => x(d.data.date))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]))
            .curve(d3.curveMonotoneX);

        svg.selectAll("mylayers")
            .data(stackedData).enter().append("path")
            .style("fill", (d: any) => color(d.key) as string)
            .style("opacity", 0.8)
            .attr("d", area as any);
    }, [darkMode, searchQuery, collectionsToKeep, growthData]);

    // --- 2. Metadata Connectivity (Arc Diagram) ---
    useEffect(() => {
        if (!arcRef.current) return;
        d3.select(arcRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 30, bottom: 50, left: 30 },
              width = 400 - margin.left - margin.right,
              height = 250 - margin.top - margin.bottom;

        const svg = d3.select(arcRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (arcData.nodes.length === 0) return;

        const allNodeIds = arcData.nodes.map(n => n.id);
        const x = d3.scalePoint().range([0, width]).domain(allNodeIds);
        const color = d3.scaleOrdinal().domain(["Profile", "Collection", "Document"]).range(["#10b981", "#0891b2", "#800020"]);

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
            .style("stroke-width", (d: any) => d.value)
            .style("opacity", 0.6);

        svg.selectAll("circle")
            .data(arcData.nodes)
            .enter().append("circle")
            .attr("cx", (d: any) => x(d.id)!)
            .attr("cy", height - 30)
            .attr("r", 7)
            .style("fill", (d: any) => color(d.group) as string)
            .style("stroke", darkMode ? "#1f2937" : "#fff");

        svg.selectAll("text")
            .data(arcData.nodes)
            .enter().append("text")
            .attr("x", (d: any) => x(d.id)!)
            .attr("y", height - 12)
            .text((d: any) => d.id.replace(/^[PCD]-/, '')) 
            .style("text-anchor", "end")
            .style("font-size", "9px")
            .style("fill", darkMode ? "#9ca3af" : "#4b5563")
            .attr("transform", (d: any) => `rotate(-45, ${x(d.id)}, ${height - 12})`);
    }, [darkMode, arcData]);

    // --- 3. Collection Size vs Credits Burned (Bubble Chart) ---
    useEffect(() => {
        if (!bubbleRef.current) return;
        d3.select(bubbleRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 50 },
              width = 400 - margin.left - margin.right,
              height = 250 - margin.top - margin.bottom;

        const svg = d3.select(bubbleRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (statsData.length === 0) return;

        const x = d3.scaleLinear().domain([0, 4000]).range([0, width]); // Vector Count
        const y = d3.scaleLinear().domain([0, 20000]).range([height, 0]); // Credits Burned
        const z = d3.scaleSqrt().domain([0, 10000]).range([4, 25]); // Queries (Bubble Size)
        const color = d3.scaleOrdinal().domain(statsData.map(d => d.collection)).range(["#0891b2", "#800020", "#f59e0b", "#10b981"]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("text").attr("x", width / 2).attr("y", height + 30).style("text-anchor", "middle").style("font-size", "10px").style("fill", darkMode ? "#9ca3af" : "#6b7280").text("Vector Count (Size)");

        svg.append("g").call(d3.axisLeft(y).ticks(5)).attr("color", darkMode ? "#9ca3af" : "#6b7280");

        svg.append("g").selectAll("circle")
            .data(statsData).enter().append("circle")
            .attr("cx", d => x(d.vectors))
            .attr("cy", d => y(d.credits))
            .attr("r", d => z(d.queries))
            .style("fill", d => color(d.collection) as string)
            .style("opacity", 0.7)
            .style("stroke", darkMode ? "#1f2937" : "#fff");

        svg.append("g").selectAll("text")
            .data(statsData).enter().append("text")
            .attr("x", d => x(d.vectors))
            .attr("y", d => y(d.credits) - z(d.queries) - 2)
            .text(d => d.collection)
            .style("text-anchor", "middle")
            .style("font-size", "9px")
            .style("font-weight", "bold")
            .style("fill", darkMode ? "#d1d5db" : "#374151");

    }, [darkMode, statsData]);

    // --- 4. Most Queried Collections (Horizontal Bar Chart) ---
    useEffect(() => {
        if (!barRef.current) return;
        d3.select(barRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 90 },
              width = 400 - margin.left - margin.right,
              height = 250 - margin.top - margin.bottom;

        const svg = d3.select(barRef.current)
            .attr("viewBox", `0 0 400 250`)
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (statsData.length === 0) return;

        // Sort data descending by queries
        const sortedData = [...statsData].sort((a, b) => b.queries - a.queries);

        const x = d3.scaleLinear().domain([0, 10000]).range([0, width]);
        const y = d3.scaleBand().domain(sortedData.map(d => d.collection)).range([0, height]).padding(0.2);
        const color = d3.scaleOrdinal().domain(sortedData.map(d => d.collection)).range(["#0891b2", "#800020", "#f59e0b", "#10b981"]);

        svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(4)).attr("color", darkMode ? "#9ca3af" : "#6b7280");
        svg.append("text").attr("x", width / 2).attr("y", height + 30).style("text-anchor", "middle").style("font-size", "10px").style("fill", darkMode ? "#9ca3af" : "#6b7280").text("Total Queries");

        svg.append("g").call(d3.axisLeft(y)).attr("color", darkMode ? "#9ca3af" : "#6b7280")
           .selectAll("text").style("font-weight", "bold").style("fill", darkMode ? "#d1d5db" : "#374151");

        svg.selectAll("rect")
            .data(sortedData).enter().append("rect")
            .attr("x", x(0))
            .attr("y", d => y(d.collection)!)
            .attr("width", d => x(d.queries))
            .attr("height", y.bandwidth())
            .attr("fill", d => color(d.collection) as string)
            .attr("rx", 4);

    }, [darkMode, statsData]);

    return (
        <div className="knowledge-loci-grid">
            {/* LINE 1 */}
            <div className="kl-row kl-line-1">
                <div className="ft-card kl-d3-card">
                    <div className="kl-card-header">
                        <h3>Vector Collection Growth</h3>
                        <span className="kl-subtitle">Stacked Area tracking document embeddings over time.</span>
                    </div>
                    {collectionsToKeep.filter(k => k !== "Legacy Code").length === 0 ? <p className="kl-no-data">No data matching search.</p> : <svg ref={areaRef}></svg>}
                </div>

                <div className="ft-card kl-d3-card">
                    <div className="kl-card-header">
                        <h3>Knowledge Connectivity</h3>
                        <span className="kl-subtitle">Arc diagram linking Profiles to Collections to Documents.</span>
                    </div>
                    {arcData.nodes.length === 0 ? <p className="kl-no-data">No data matching search.</p> : <svg ref={arcRef}></svg>}
                </div>
            </div>

            {/* LINE 2 */}
            <div className="kl-row kl-line-2">
                <div className="ft-card kl-d3-card">
                    <div className="kl-card-header">
                        <h3>Collection Cost vs Size</h3>
                        <span className="kl-subtitle">Spot expensive or bloated knowledge bases instantly.</span>
                    </div>
                    {statsData.length === 0 ? <p className="kl-no-data">No data matching search.</p> : <svg ref={bubbleRef}></svg>}
                </div>

                <div className="ft-card kl-d3-card">
                    <div className="kl-card-header">
                        <h3>Most Queried Collections</h3>
                        <span className="kl-subtitle">Ranked by total knowledge retrieval requests.</span>
                    </div>
                    {statsData.length === 0 ? <p className="kl-no-data">No data matching search.</p> : <svg ref={barRef}></svg>}
                </div>
            </div>
        </div>
    );
};

export default KnowledgeLoci;