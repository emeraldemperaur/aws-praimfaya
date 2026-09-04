import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_DATAPOINTS_PER_SERIES = 30;
const MAX_SERIES_LIMIT = 15;


const safeJsonObject = (data: any, fallback: any = {}): Record<string, any> => {
    if (!data) return fallback;
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const parseToUnixSeconds = (input: any, defaultOffsetSeconds = 3600): { from: number; to: number } => {
    const now = Math.floor(Date.now() / 1000);
    
    let to = now;
    if (typeof input?.to === 'number') {
        to = input.to > 1e11 ? Math.floor(input.to / 1000) : input.to;
    } else if (typeof input?.to === 'string' && !isNaN(Date.parse(input.to))) {
        to = Math.floor(Date.parse(input.to) / 1000);
    }

    let from = to - defaultOffsetSeconds;
    if (typeof input?.from === 'number') {
        from = input.from > 1e11 ? Math.floor(input.from / 1000) : input.from;
    } else if (typeof input?.from === 'string' && !isNaN(Date.parse(input.from))) {
        from = Math.floor(Date.parse(input.from) / 1000);
    }

    return { from, to };
};


const downsamplePoints = (points: any[]): any[] => {
    if (!Array.isArray(points)) return [];
    if (points.length <= MAX_DATAPOINTS_PER_SERIES) return points;
    const step = Math.ceil(points.length / MAX_DATAPOINTS_PER_SERIES);
    return points.filter((_, i) => i % step === 0).slice(0, MAX_DATAPOINTS_PER_SERIES);
};

export const executeGrafana = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const GRAFANA_URL = ephemeralSecrets.grafanaUrl;
    const GRAFANA_TOKEN = ephemeralSecrets.grafanaToken;

    if (!GRAFANA_URL || !GRAFANA_TOKEN) {
        return { error: "Missing Grafana credentials. Call 'request_secure_credentials' with serviceName 'grafana'." };
    }

    try {
        const headers = { 
            Authorization: `Bearer ${GRAFANA_TOKEN}`, 
            Accept: 'application/json',
            'Content-Type': 'application/json' 
        };
        const baseUrl = GRAFANA_URL.replace(/\/$/, "");
        const { action, dataSourceUid, query, dashboardJson, dashboardUid, start, end, step, limit } = toolInput;

        if (action === 'GET_DATA_SOURCES') {
            const res = await axios.get(`${baseUrl}/api/datasources`, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                dataSources: res.data.map((ds: any) => ({ id: ds.id, uid: ds.uid, name: ds.name, type: ds.type, isDefault: ds.isDefault })) 
            };
        }
        else if (action === 'SEARCH_DASHBOARDS') {
            const searchQuery = query ? `?query=${encodeURIComponent(query)}` : '?type=dash-db';
            const res = await axios.get(`${baseUrl}/api/search${searchQuery}`, { headers, timeout: TIMEOUT_MS });
            const dashboards = res.data.slice(0, 15).map((d: any) => ({ uid: d.uid, title: d.title, url: d.url, tags: d.tags }));
            return { status: "Success", dashboards };
        }
        else if (action === 'GET_DASHBOARD' && dashboardUid) {
            const res = await axios.get(`${baseUrl}/api/dashboards/uid/${encodeURIComponent(dashboardUid)}`, { headers, timeout: TIMEOUT_MS });
            const { dashboard } = res.data;
            const panels = dashboard.panels?.slice(0, 20).map((p: any) => ({ id: p.id, title: p.title, type: p.type, targets: p.targets }));
            return { status: "Success", title: dashboard.title, uid: dashboard.uid, panels };
        }
        else if (action === 'QUERY_METRICS' && dataSourceUid && query) {
            const res = await axios.get(`${baseUrl}/api/datasources/proxy/uid/${encodeURIComponent(dataSourceUid)}/api/v1/query?query=${encodeURIComponent(query)}`, { headers, timeout: TIMEOUT_MS });
            const rawMetrics = Array.isArray(res.data.data?.result) ? res.data.data.result : [];
            const metrics = rawMetrics.slice(0, MAX_SERIES_LIMIT);
            return { status: "Success", count: metrics.length, metrics };
        }
        else if (action === 'QUERY_METRICS_RANGE' && dataSourceUid && query) {
            const { from, to } = parseToUnixSeconds({ from: start, to: end });
            const stepVal = step || '15s';
            const url = `${baseUrl}/api/datasources/proxy/uid/${encodeURIComponent(dataSourceUid)}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${from}&end=${to}&step=${encodeURIComponent(stepVal)}`;
            const res = await axios.get(url, { headers, timeout: TIMEOUT_MS });
            
            const rawMetrics = Array.isArray(res.data.data?.result) ? res.data.data.result : [];
            const metrics = rawMetrics.slice(0, MAX_SERIES_LIMIT).map((series: any) => ({
                metric: series.metric,
                values: downsamplePoints(series.values)
            }));

            return { status: "Success", resultType: res.data.data?.resultType, seriesCount: rawMetrics.length, metrics };
        }
        else if (action === 'QUERY_LOKI_LOGS' && dataSourceUid && query) {
            const { from, to } = parseToUnixSeconds({ from: start, to: end });
            const limitVal = Math.min(limit || 50, 100);
            const url = `${baseUrl}/api/datasources/proxy/uid/${encodeURIComponent(dataSourceUid)}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&start=${from * 1e9}&end=${to * 1e9}&limit=${limitVal}`;
            const res = await axios.get(url, { headers, timeout: TIMEOUT_MS });
            
            const rawLogs = Array.isArray(res.data.data?.result) ? res.data.data.result : [];
            const logs = rawLogs.slice(0, MAX_SERIES_LIMIT);

            return { status: "Success", logs };
        }
        else if (action === 'CREATE_DASHBOARD' && dashboardJson) {
            const parsedDashboard = safeJsonObject(dashboardJson);
            if (Object.keys(parsedDashboard).length === 0) return { error: "Invalid JSON provided in dashboardJson." };

            const payload = {
                dashboard: parsedDashboard,
                overwrite: true,
                message: "Provisioned automatically by SRE Agent"
            };
            const res = await axios.post(`${baseUrl}/api/dashboards/db`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", dashboardUrl: `${baseUrl}${res.data.url}`, uid: res.data.uid };
        }
        else if (action === 'GET_ALERT_RULES') {
            const res = await axios.get(`${baseUrl}/api/v1/provisioning/alert-rules`, { headers, timeout: TIMEOUT_MS });
            const rules = res.data?.slice(0, 20).map((r: any) => ({ uid: r.uid, title: r.title, folderUID: r.folderUID, condition: r.condition }));
            return { status: "Success", alertRules: rules };
        }

        return { error: `Missing required parameters or unsupported Grafana action: ${action}` };
    } catch (err: any) {
        return { error: `Grafana Error: ${err.response?.data?.message || err.message}` };
    }
};


export const executeDatadog = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const DD_API_KEY = ephemeralSecrets.datadogApiKey;
    const DD_APP_KEY = ephemeralSecrets.datadogAppKey;
    const DD_SITE = ephemeralSecrets.datadogSite || 'datadoghq.com';

    if (!DD_API_KEY || !DD_APP_KEY) {
        return { error: "Missing Datadog API/App Keys. Call 'request_secure_credentials' with serviceName 'datadog'." };
    }

    try {
        const headers = { 
            'DD-API-KEY': DD_API_KEY, 
            'DD-APPLICATION-KEY': DD_APP_KEY,
            Accept: 'application/json',
            'Content-Type': 'application/json' 
        };
        const cleanSite = encodeURIComponent(DD_SITE.replace(/[^a-zA-Z0-9.-]/g, ''));
        const baseUrl = `https://api.${cleanSite}/api`;
        const { action, query, from, to, dashboardJson, monitorId, muteScope } = toolInput;

        if (action === 'QUERY_LOGS') {
            const { from: fromSec, to: toSec } = parseToUnixSeconds({ from, to });
            const payload = {
                filter: { query: query || "*", from: `${fromSec * 1000}`, to: `${toSec * 1000}` },
                page: { limit: 30 }
            };
            const res = await axios.post(`https://api.${cleanSite}/api/v2/logs/events/search`, payload, { headers, timeout: TIMEOUT_MS });
            const logs = res.data.data?.map((l: any) => ({
                timestamp: l.attributes?.timestamp,
                status: l.attributes?.status,
                service: l.attributes?.service,
                message: l.attributes?.message
            }));
            return { status: "Success", count: logs?.length, logs };
        }
        else if (action === 'QUERY_METRICS' && query) {
            const { from: fromSec, to: toSec } = parseToUnixSeconds({ from, to });
            const res = await axios.get(`${baseUrl}/v1/query?query=${encodeURIComponent(query)}&from=${fromSec}&to=${toSec}`, { headers, timeout: TIMEOUT_MS });
            
            const rawSeries = Array.isArray(res.data.series) ? res.data.series : [];
            const series = rawSeries.slice(0, MAX_SERIES_LIMIT).map((s: any) => ({
                metric: s.metric,
                scope: s.scope,
                display_name: s.display_name,
                pointlist: downsamplePoints(s.pointlist)
            }));

            return { status: "Success", seriesCount: rawSeries.length, series };
        }
        else if (action === 'SEARCH_DASHBOARDS') {
            const res = await axios.get(`${baseUrl}/v1/dashboard`, { headers, timeout: TIMEOUT_MS });
            const dashboards = res.data.dashboards?.slice(0, 20).map((d: any) => ({ id: d.id, title: d.title, author_handle: d.author_handle, layout_type: d.layout_type }));
            return { status: "Success", dashboards };
        }
        else if (action === 'CREATE_DASHBOARD' && dashboardJson) {
            const parsedDashboard = safeJsonObject(dashboardJson);
            if (Object.keys(parsedDashboard).length === 0) return { error: "Invalid JSON provided in dashboardJson." };

            const res = await axios.post(`${baseUrl}/v1/dashboard`, parsedDashboard, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", dashboardUrl: `https://app.${cleanSite}/dashboard/${res.data.id}` };
        }
        else if (action === 'GET_MONITORS') {
            const res = await axios.get(`${baseUrl}/v1/monitor?group_states=alert,warn`, { headers, timeout: TIMEOUT_MS });
            const monitors = res.data?.slice(0, 20).map((m: any) => ({ id: m.id, name: m.name, type: m.type, overall_state: m.overall_state, query: m.query }));
            return { status: "Success", openMonitorsCount: monitors?.length, monitors };
        }
        else if (action === 'MUTE_MONITOR' && monitorId) {
            const payload = muteScope ? { scope: muteScope } : {};
            const res = await axios.post(`${baseUrl}/v1/monitor/${encodeURIComponent(monitorId)}/mute`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Monitor ${monitorId} muted successfully.`, details: res.data };
        }
        else if (action === 'LIST_INCIDENTS') {
            const res = await axios.get(`https://api.${cleanSite}/api/v2/incidents`, { headers, timeout: TIMEOUT_MS });
            const incidents = res.data.data?.slice(0, 15).map((i: any) => ({ id: i.id, title: i.attributes?.title, customer_impacted: i.attributes?.customer_impacted, state: i.attributes?.state }));
            return { status: "Success", incidents };
        }
        else if (action === 'GET_SLOS') {
            const res = await axios.get(`${baseUrl}/v1/slo`, { headers, timeout: TIMEOUT_MS });
            const slos = res.data.data?.slice(0, 15).map((s: any) => ({ id: s.id, name: s.name, type: s.type, target_threshold: s.target_threshold }));
            return { status: "Success", slos };
        }

        return { error: `Missing required parameters or unsupported Datadog action: ${action}` };
    } catch (err: any) {
        return { error: `Datadog Error: ${err.response?.data?.errors?.[0] || err.message}` };
    }
};