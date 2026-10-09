import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { ToolExecutionContext } from './types';

const s3Client = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const MAX_PAYLOAD_SIZE = 10485760;

export const executeD3Visualization = async (ctx: ToolExecutionContext) => {
    const { toolInput, cognitoUserId } = ctx;
    
    const BUCKET_NAME = process.env.MEDIA_OUTPUT_BUCKET_NAME;
    const ARTIFACTS_TABLE = process.env.RAG_ARTIFACTS_TABLE_NAME;

    if (!BUCKET_NAME || !ARTIFACTS_TABLE) {
        return { error: "Storage infrastructure not configured in environment variables." };
    }

    try {
        const { action, outputFormat = 'HTML_DASHBOARD', dashboardTitle, dashboardDescription, charts } = toolInput;

        if (action === 'GENERATE_DASHBOARD') {
            const isPdfMode = outputFormat === 'PDF_REPORT';
            const baseCost = { action: isPdfMode ? 'D3_PDF_REPORT' : 'D3_HTML_DASHBOARD', creditsToDeduct: 30 };

            const resolvedCharts = await Promise.all(charts.map(async (chart: any, index: number) => {
                let finalData = chart.rawData || [];
                
                if (chart.dataUrl) {
                    try {
                        const res = await axios.get(chart.dataUrl, { 
                            timeout: 10000,
                            maxContentLength: MAX_PAYLOAD_SIZE,
                            maxBodyLength: MAX_PAYLOAD_SIZE 
                        });
                        if (typeof res.data === 'string' && chart.dataUrl.endsWith('.csv')) {
                            const lines = res.data.split('\n').filter(l => l.trim());
                            const headers = lines[0].split(',');
                            finalData = lines.slice(1).map(line => {
                                const values = line.split(',');
                                return headers.reduce((obj: any, header, i) => {
                                    const val = values[i]?.trim();
                                    obj[header.trim()] = isNaN(Number(val)) ? val : Number(val);
                                    return obj;
                                }, {});
                            });
                        } else {
                            finalData = res.data;
                        }
                    } catch (e: any) {
                        console.warn(`[Data Visualization] Failed to fetch remote dataset ${chart.dataUrl}:`, e.message);
                        finalData = [];
                    }
                }
                
                return {
                    id: `chart-container-${index}`,
                    title: chart.title,
                    type: chart.chartType,
                    data: finalData,
                    script: chart.d3Script
                };
            }));

            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${dashboardTitle} - Vanguard ${isPdfMode ? 'Executive Report' : 'Analytics'}</title>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;600&family=Montserrat:wght@300;400;600&display=swap" rel="stylesheet">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3-hexbin@0.2.2/build/d3-hexbin.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    
    <style>
        :root {
            --reho-bg: ${isPdfMode ? '#ffffff' : '#050508'};
            --reho-card: ${isPdfMode ? '#ffffff' : 'rgba(15, 15, 20, 0.85)'};
            --reho-danger: #D32F2F;
            --reho-cyan: ${isPdfMode ? '#0284c7' : '#00E5FF'};
            --reho-text: ${isPdfMode ? '#0f172a' : '#E0E0E0'};
            --reho-text-muted: ${isPdfMode ? '#475569' : '#888899'};
            --reho-grid: ${isPdfMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)'};
            --font-mono: 'Google Sans Code', monospace;
            --font-sans: 'Montserrat', sans-serif;
        }
        
        body { background: var(--reho-bg); color: var(--reho-text); font-family: var(--font-sans); margin: 0; padding: 2rem; }
        .action-bar { position: fixed; top: 1rem; right: 1rem; display: flex; gap: 0.5rem; z-index: 1000; }
        .btn-export { background: #0B0B45; color: #ffffff; border: 1px solid var(--reho-cyan); padding: 0.5rem 1rem; border-radius: 6px; font-family: var(--font-mono); font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .dashboard-header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid var(--reho-grid); padding-bottom: 1.5rem; }
        .dashboard-header h1 { font-weight: 400; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 0.5rem 0; }
        .chart-grid { display: grid; grid-template-columns: ${isPdfMode ? '1fr' : 'repeat(auto-fit, minmax(600px, 1fr))'}; gap: 2rem; max-width: 1400px; margin: 0 auto; }
        .chart-card { background: var(--reho-card); border: 1px solid var(--reho-grid); border-radius: 8px; padding: 1.5rem; ${isPdfMode ? 'page-break-inside: avoid; break-inside: avoid;' : ''} }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--reho-grid); padding-bottom: 0.5rem; }
        .chart-title { font-size: 1.1rem; font-weight: 600; color: var(--reho-cyan); text-transform: uppercase; }
        .d3-container { width: 100%; min-height: 400px; }
        @media print { .action-bar { display: none !important; } body { padding: 0; background: white; color: black; } .chart-card { border: 1px solid #ddd; break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="action-bar">
        <button className="btn-export" onclick="downloadPdf()">Export PDF</button>
    </div>
    <div id="pdf-report-root">
        <header class="dashboard-header">
            <h1>${dashboardTitle}</h1>
            ${dashboardDescription ? `<p>${dashboardDescription}</p>` : ''}
        </header>
        <div class="chart-grid">
            ${resolvedCharts.map(c => `
                <div class="chart-card">
                    <div class="chart-header">
                        <div class="chart-title">${c.title}</div>
                        <div style="font-family:var(--font-mono); font-size:0.8rem; color:var(--reho-danger);">${c.type}</div>
                    </div>
                    <div id="${c.id}" class="d3-container"></div>
                </div>
            `).join('')}
        </div>
    </div>
    <script>
        function downloadPdf() {
            const element = document.getElementById('pdf-report-root');
            const opt = { margin: [0.5, 0.5, 0.5, 0.5], filename: '${dashboardTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
            html2pdf().set(opt).from(element).save();
        }
        ${resolvedCharts.map(c => `
            try {
                (function() {
                    const containerId = "#${c.id}";
                    const chartData = ${JSON.stringify(c.data)};${c.script}
                })();
            } catch (err) { console.error("D3 Render Error in ${c.id}:", err); }
        `).join('\n')}
        ${isPdfMode ? 'window.addEventListener("load", () => setTimeout(downloadPdf, 1200));' : ''}
    </script>
</body>
</html>`;

            const artifactId = randomUUID();
            const extension = isPdfMode ? 'pdf.html' : 'html';
            const objectKey = `visualizations/${cognitoUserId || 'system'}/${artifactId}/report.${extension}`;

            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: objectKey,
                Body: htmlContent,
                ContentType: 'text/html',
                ContentDisposition: 'inline'
            }));

            const artifactUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${objectKey}`;

            await docClient.send(new PutCommand({
                TableName: ARTIFACTS_TABLE,
                Item: {
                    id: artifactId,
                    cognitoUserId: cognitoUserId || 'system',
                    type: isPdfMode ? 'D3_PDF_REPORT' : 'D3_DASHBOARD',
                    title: dashboardTitle,
                    sourceUrl: artifactUrl,
                    createdAt: new Date().toISOString(),
                    metadata: { outputFormat, chartsRendered: charts.length }
                }
            }));

            return { 
                status: "Success", 
                message: isPdfMode ? "PDF Report synthesized with vector print rules." : "Interactive HTML Dashboard synthesized.",
                outputFormat,
                artifactUrl,
                artifactId,
                billingMetrics: baseCost
            };
        }

        return { error: `Unsupported visualization action: ${action}` };
    } catch (err: any) {
        return { error: `Visualization Error: ${err.message || "Failed to generate report"}` };
    }
};