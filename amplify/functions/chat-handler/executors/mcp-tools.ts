import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 8000; 
const MAX_PAYLOAD_SIZE = 10485760; 
const MAX_ITEMS_LIMIT = 50;
const MAX_STRING_LENGTH = 5000;

const safeJsonObject = (input: any): Record<string, any> => {
    if (!input) return {};
    if (typeof input === 'object' && !Array.isArray(input)) return input;
    try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const sanitizeMcpResponse = (data: any, depth = 0): any => {
    if (depth > 5) return '[Max Depth Reached]';
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
        return data.length > MAX_STRING_LENGTH ? data.substring(0, MAX_STRING_LENGTH) + `... [TRUNCATED]` : data;
    }
    
    if (Array.isArray(data)) {
        return data.slice(0, MAX_ITEMS_LIMIT).map(item => sanitizeMcpResponse(item, depth + 1));
    }
    
    if (typeof data === 'object') {
        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined || value === '') continue;
            sanitized[key] = sanitizeMcpResponse(value, depth + 1);
        }
        return sanitized;
    }
    
    return data;
};

export const executeMitoMCP = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const MITO_URL = env.MITO_MCP_URL;
    const MITO_TOKEN = ephemeralSecrets.mitoToken;
    if (!MITO_URL) return { error: "Mito MCP URL is not configured in the backend environment variables." };

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (MITO_TOKEN) headers['Authorization'] = `Bearer ${MITO_TOKEN}`;

        const reqConfig = { headers, timeout: TIMEOUT_MS, maxContentLength: MAX_PAYLOAD_SIZE, maxBodyLength: MAX_PAYLOAD_SIZE };
        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = MITO_URL.replace(/\/$/, "");
        const baseCost = { action: `MITO_MCP_${action}`, creditsToDeduct: action === 'LIST_TOOLS' ? 5 : 15 };

        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
            return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data), billingMetrics: baseCost };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            const res = await axios.post(`${baseUrl}/tools/call`, { name: mcpToolName, arguments: parsedArgs }, reqConfig);
            return { status: "Success", data: sanitizeMcpResponse(res.data), billingMetrics: baseCost };
        }

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) return { error: "Missing or invalid Mito credentials." };
        return { error: `Mito MCP Error: ${err.response?.data?.error || err.message}` }; 
    }
};

export const executeApotheosisMCP = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const APOTHEOSIS_URL = env.APOTHEOSIS_MCP_URL;
    const APOTHEOSIS_TOKEN = ephemeralSecrets.apotheosisToken; 
    if (!APOTHEOSIS_URL) return { error: "Apotheosis MCP URL is not configured in the backend environment variables." };

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (APOTHEOSIS_TOKEN) headers['Authorization'] = `Bearer ${APOTHEOSIS_TOKEN}`;

        const reqConfig = { headers, timeout: TIMEOUT_MS, maxContentLength: MAX_PAYLOAD_SIZE, maxBodyLength: MAX_PAYLOAD_SIZE };
        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = APOTHEOSIS_URL.replace(/\/$/, "");
        const baseCost = { action: `APOTHEOSIS_MCP_${action}`, creditsToDeduct: action === 'LIST_TOOLS' ? 5 : 15 };

        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
            return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data), billingMetrics: baseCost };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            const res = await axios.post(`${baseUrl}/tools/call`, { name: mcpToolName, arguments: parsedArgs }, reqConfig);
            return { status: "Success", data: sanitizeMcpResponse(res.data), billingMetrics: baseCost };
        } 

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) return { error: "Missing or invalid Apotheosis credentials." };
        return { error: `Apotheosis MCP Error: ${err.response?.data?.error || err.message}` }; 
    }
};

export const executeBYOMCP = async ({ toolInput, profile, ephemeralSecrets }: ToolExecutionContext) => {
    const CUSTOM_URL = profile?.customMcpUrl;
    if (!CUSTOM_URL) return { error: "Custom MCP URL is not configured in your profile. Please configure it in the dashboard settings." };

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let hasAppliedAuth = false;
        const isOneVest = CUSTOM_URL.toLowerCase().includes('onevest');
        if (isOneVest && ephemeralSecrets?.onevestToken) {
            headers['Authorization'] = `Bearer ${ephemeralSecrets.onevestToken}`;
            if (ephemeralSecrets.onevestFirmId) headers['X-Firm-ID'] = ephemeralSecrets.onevestFirmId;
            hasAppliedAuth = true;
        }
        else if (ephemeralSecrets?.customMcpHeaders) {
            try {
                const dynamicHeaders = typeof ephemeralSecrets.customMcpHeaders === 'string' 
                    ? JSON.parse(ephemeralSecrets.customMcpHeaders) 
                    : ephemeralSecrets.customMcpHeaders;
                Object.assign(headers, dynamicHeaders);
                hasAppliedAuth = true;
            } catch (err) {
                return { error: "Provided custom MCP headers must be valid JSON format." };
            }
        } 
        else if (profile.mcpAuthToken) {
            headers['Authorization'] = `Bearer ${profile.mcpAuthToken}`;
            headers['x-api-key'] = profile.mcpAuthToken;
            hasAppliedAuth = true;
        }

        if (!hasAppliedAuth && (profile.mcpRequiresAuth || isOneVest)) {
            if (isOneVest) {
                return { 
                    error: "Missing OneVest credentials. Call 'request_secure_credentials' with serviceName 'onevest' to securely prompt the user for their Authentication tokens and Firm ID." 
                };
            }
            return { 
                error: "Missing credentials. Call 'request_secure_credentials' with serviceName 'custom_mcp' to prompt the user to input their required headers in JSON format." 
            };
        }

        const reqConfig = { headers, timeout: TIMEOUT_MS, maxContentLength: MAX_PAYLOAD_SIZE, maxBodyLength: MAX_PAYLOAD_SIZE };
        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = CUSTOM_URL.replace(/\/$/, "");
        const baseCost = { action: `CUSTOM_MCP_${action}`, creditsToDeduct: action === 'LIST_TOOLS' ? 5 : 15 };

        if (action === 'LIST_TOOLS') {
            try {
                const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
                return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data), billingMetrics: baseCost };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { jsonrpc: "2.0", id: 1, method: "tools/list" }, reqConfig);
                    return { status: "Success", tools: sanitizeMcpResponse(rpcRes.data.result?.tools || rpcRes.data), billingMetrics: baseCost };
                }
                throw err;
            }
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            try {
                const res = await axios.post(`${baseUrl}/tools/call`, { name: mcpToolName, arguments: parsedArgs }, reqConfig);
                return { status: "Success", data: sanitizeMcpResponse(res.data), billingMetrics: baseCost };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: mcpToolName, arguments: parsedArgs } }, reqConfig);
                    return { status: "Success", data: sanitizeMcpResponse(rpcRes.data.result || rpcRes.data), billingMetrics: baseCost };
                }
                throw err;
            }
        } 

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) return { error: "Authentication failed for the Custom MCP. Please verify your tokens and headers." };
        return { error: `Custom MCP Error: ${err.response?.data?.error?.message || err.response?.data?.error || err.message}` }; 
    }
};