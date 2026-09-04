import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 8000; 
const MAX_PAYLOAD_SIZE = 10485760; 
const MAX_ITEMS_LIMIT = 50;


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


const sanitizeMcpResponse = (data: any): any => {
    if (!data) return {};
    if (Array.isArray(data)) {
        return {
            totalItems: data.length,
            truncated: data.length > MAX_ITEMS_LIMIT,
            items: data.slice(0, MAX_ITEMS_LIMIT)
        };
    }
    if (data.tools && Array.isArray(data.tools)) {
        return {
            ...data,
            totalTools: data.tools.length,
            truncated: data.tools.length > MAX_ITEMS_LIMIT,
            tools: data.tools.slice(0, MAX_ITEMS_LIMIT)
        };
    }
    return data;
};

export const executeMitoMCP = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const MITO_URL = env.MITO_MCP_URL;
    const MITO_TOKEN = ephemeralSecrets.mitoToken;
    
    if (!MITO_URL) {
        return { error: "Mito MCP URL is not configured in the backend environment variables." };
    } 

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (MITO_TOKEN) headers['Authorization'] = `Bearer ${MITO_TOKEN}`;

        const reqConfig = {
            headers,
            timeout: TIMEOUT_MS,
            maxContentLength: MAX_PAYLOAD_SIZE,
            maxBodyLength: MAX_PAYLOAD_SIZE
        };

        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = MITO_URL.replace(/\/$/, "");

        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
            return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data) };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            const res = await axios.post(`${baseUrl}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, reqConfig);
            return { status: "Success", data: sanitizeMcpResponse(res.data) };
        }

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) {
            return { error: "Missing or invalid Mito credentials. Call 'request_secure_credentials' with serviceName 'mito'." };
        }
        return { error: `Mito MCP Error: ${err.response?.data?.error || err.message}` }; 
    }
};


export const executeApotheosisMCP = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const APOTHEOSIS_URL = env.APOTHEOSIS_MCP_URL;
    const APOTHEOSIS_TOKEN = ephemeralSecrets.apotheosisToken; 

    if (!APOTHEOSIS_URL) {
        return { error: "Apotheosis MCP URL is not configured in the backend environment variables." };
    } 

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (APOTHEOSIS_TOKEN) headers['Authorization'] = `Bearer ${APOTHEOSIS_TOKEN}`;

        const reqConfig = {
            headers,
            timeout: TIMEOUT_MS,
            maxContentLength: MAX_PAYLOAD_SIZE,
            maxBodyLength: MAX_PAYLOAD_SIZE
        };

        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = APOTHEOSIS_URL.replace(/\/$/, "");

        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
            return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data) };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            const res = await axios.post(`${baseUrl}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, reqConfig);
            return { status: "Success", data: sanitizeMcpResponse(res.data) };
        } 

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) {
            return { error: "Missing or invalid Apotheosis credentials. Call 'request_secure_credentials' with serviceName 'apotheosis'." };
        }
        return { error: `Apotheosis MCP Error: ${err.response?.data?.error || err.message}` }; 
    }
};


export const executeBYOMCP = async ({ toolInput, profile }: ToolExecutionContext) => {
    const CUSTOM_URL = profile?.customMcpUrl;
    
    if (!CUSTOM_URL) {
        return { error: "Custom MCP URL is not configured in your profile. Please configure it in the dashboard settings." };
    } 

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        
        if (profile.mcpRequiresAuth && profile.mcpAuthToken) {
            headers['Authorization'] = `Bearer ${profile.mcpAuthToken}`;
            headers['x-api-key'] = profile.mcpAuthToken;
        }

        const reqConfig = {
            headers,
            timeout: TIMEOUT_MS,
            maxContentLength: MAX_PAYLOAD_SIZE,
            maxBodyLength: MAX_PAYLOAD_SIZE
        };

        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = CUSTOM_URL.replace(/\/$/, "");

        if (action === 'LIST_TOOLS') {
            try {
                const res = await axios.post(`${baseUrl}/tools/list`, {}, reqConfig);
                return { status: "Success", tools: sanitizeMcpResponse(res.data.tools || res.data) };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { 
                        jsonrpc: "2.0", 
                        id: 1, 
                        method: "tools/list" 
                    }, reqConfig);
                    return { status: "Success", tools: sanitizeMcpResponse(rpcRes.data.result?.tools || rpcRes.data) };
                }
                throw err;
            }
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            
            try {
                const res = await axios.post(`${baseUrl}/tools/call`, { 
                    name: mcpToolName, 
                    arguments: parsedArgs 
                }, reqConfig);
                return { status: "Success", data: sanitizeMcpResponse(res.data) };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { 
                        jsonrpc: "2.0", 
                        id: 2, 
                        method: "tools/call", 
                        params: { name: mcpToolName, arguments: parsedArgs } 
                    }, reqConfig);
                    return { status: "Success", data: sanitizeMcpResponse(rpcRes.data.result || rpcRes.data) };
                }
                throw err;
            }
        } 

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) {
            return { error: "Authentication failed for the Custom MCP. Please verify your token in the dashboard." };
        }
        return { error: `Custom MCP Error: ${err.response?.data?.error?.message || err.response?.data?.error || err.message}` }; 
    }
};