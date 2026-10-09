import axios from 'axios';
import { randomUUID } from 'crypto';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 15000;
const MAX_RECORD_LIMIT = 20;

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

const generateIdempotencyKey = () => {
    try { 
        return randomUUID(); 
    } catch { 
        return Math.random().toString(36).substring(2, 15); 
    }
};

const projectRecord = (record: Record<string, any>): Record<string, any> => {
    if (!record || typeof record !== 'object') return record;
    const projected: Record<string, any> = {};
    const IGNORED_KEYS = new Set(['updated_at', 'created_at', 'meta', '_links', 'audit_trail', 'raw_kyc_data']);

    for (const [key, value] of Object.entries(record)) {
        if (IGNORED_KEYS.has(key) || value === null || value === undefined || value === '') continue;
        if (typeof value === 'object' && !Array.isArray(value)) {
            projected[key] = value.name || value.id || value.status || '[Object]';
        } else if (Array.isArray(value)) {
            projected[key] = value.length > 5 
                ? `[Array (${value.length} items)]` 
                : value.map(v => typeof v === 'object' ? v.id || v.type : v);
        } else {
            projected[key] = value;
        }
    }
    return projected;
};

const slimAndProjectRecords = (records: any[], max = MAX_RECORD_LIMIT) => {
    if (!Array.isArray(records)) return [];
    return records.slice(0, max).map(r => (typeof r === 'object' && r !== null ? projectRecord(r) : r));
};

export const executeOneVestAgent = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const ONEVEST_TOKEN = ephemeralSecrets?.onevestToken || env.ONEVEST_API_TOKEN;
    const ONEVEST_FIRM_ID = ephemeralSecrets?.onevestFirmId || env.ONEVEST_FIRM_ID;
    const rawApiUrl = ephemeralSecrets?.onevestApiUrl || env.ONEVEST_API_URL || 'https://api.onevest.com/v1';
    
    if (!ONEVEST_TOKEN || !ONEVEST_FIRM_ID) {
        return { error: "Missing OneVest credentials. Call 'request_secure_credentials' with serviceName 'onevest'." };
    }

    try {
        const headers: Record<string, string> = { 
            Authorization: `Bearer ${ONEVEST_TOKEN}`, 
            'X-Firm-ID': ONEVEST_FIRM_ID,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const { action, clientId, portfolioId, amount, currency, fundType, payload } = toolInput;
        const baseUrl = rawApiUrl.replace(/\/$/, "");
        
        const isWrite = ['ONBOARD_CLIENT', 'PROCESS_FUNDS', 'EXECUTE_WORKFLOW'].includes(action);
        const baseCost = { action: `ONEVEST_${action}`, creditsToDeduct: isWrite ? 50 : 15 };

        if (action === 'GET_CLIENTS') {
            const res = await axios.get(`${baseUrl}/clients`, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                count: res.data?.data?.length || 0, 
                clients: slimAndProjectRecords(res.data?.data || [], MAX_RECORD_LIMIT), 
                billingMetrics: baseCost 
            };
        } 
        else if (action === 'GET_PORTFOLIO' && portfolioId) {
            const res = await axios.get(`${baseUrl}/portfolios/${encodeURIComponent(portfolioId)}?include=holdings,performance`, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                portfolio: projectRecord(res.data?.data), 
                billingMetrics: baseCost 
            };
        } 
        else if (action === 'ONBOARD_CLIENT') {
            const parsedPayload = safeJsonObject(payload);
            if (Object.keys(parsedPayload).length === 0) return { error: "Invalid JSON provided in payload for client onboarding." };

            const res = await axios.post(`${baseUrl}/clients/onboard`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                message: "Automated custodian onboarding initiated.", 
                client: projectRecord(res.data?.data), 
                billingMetrics: baseCost 
            };
        } 
        else if (action === 'PROCESS_FUNDS' && clientId && amount && fundType) {
            const fundingPayload = {
                amount: Number(amount),
                currency: currency || 'USD',
                type: fundType,
                idempotency_key: generateIdempotencyKey(),
                ...safeJsonObject(payload)
            };

            const res = await axios.post(`${baseUrl}/clients/${encodeURIComponent(clientId)}/transactions`, fundingPayload, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                message: `${fundType} processed successfully.`, 
                transaction: projectRecord(res.data?.data), 
                billingMetrics: baseCost 
            };
        }
        else if (action === 'EXECUTE_WORKFLOW') {
            const parsedPayload = safeJsonObject(payload);
            if (!parsedPayload.workflowId) return { error: "workflowId is required in the payload to execute an event-driven workflow." };

            const res = await axios.post(`${baseUrl}/workflows/execute`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                workflowExecution: projectRecord(res.data?.data), 
                billingMetrics: baseCost 
            };
        }

        return { error: `Missing required parameters or unsupported OneVest action: ${action}` };
    } catch (err: any) { 
        const errorDetails = err.response?.data?.errors?.[0]?.detail || err.response?.data?.message || err.message;
        return { error: `OneVest API Error: ${errorDetails}` }; 
    }
};