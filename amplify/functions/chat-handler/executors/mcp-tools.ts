import axios from 'axios';
import { ToolExecutionContext } from './types';

const safeJsonParse = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
};


export const executeMitoMCP = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const MITO_URL = env.MITO_MCP_URL;
    const MITO_TOKEN = ephemeralSecrets.mitoToken;
    
    if (!MITO_URL) {
        return { error: "Mito MCP URL is not configured in the backend environment variables." };
    } 

    try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (MITO_TOKEN) headers['Authorization'] = `Bearer ${MITO_TOKEN}`;

        const { action, mcpToolName, mcpArguments } = toolInput;
        
        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${MITO_URL}/tools/list`, {}, { headers, timeout: 10000 });
            return { status: "Success", tools: res.data.tools };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonParse(mcpArguments) || {};
            const res = await axios.post(`${MITO_URL}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, { headers, timeout: 25000 });
            return { status: "Success", data: res.data };
        }

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401) {
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
        const headers: any = { 'Content-Type': 'application/json' };
        if (APOTHEOSIS_TOKEN) headers['Authorization'] = `Bearer ${APOTHEOSIS_TOKEN}`;

        const { action, mcpToolName, mcpArguments } = toolInput;
        
        if (action === 'LIST_TOOLS') {
            const res = await axios.post(`${APOTHEOSIS_URL}/tools/list`, {}, { headers, timeout: 10000 });
            return { status: "Success", tools: res.data.tools };
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonParse(mcpArguments) || {};
            const res = await axios.post(`${APOTHEOSIS_URL}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, { headers, timeout: 25000 });
            return { status: "Success", data: res.data };
        } 

        return { error: "Missing mcpToolName for CALL_TOOL action." };
    } catch (err: any) { 
        if (err.response?.status === 401) {
            return { error: "Missing or invalid Apotheosis credentials. Call 'request_secure_credentials' with serviceName 'apotheosis'." };
        }
        return { error: `Apotheosis MCP Error: ${err.response?.data?.error || err.message}` }; 
    }
};


export const executeBYOMCP = async ({ toolInput, profile }: ToolExecutionContext) => {
    const CUSTOM_URL = profile.customMcpUrl;
    
    if (!CUSTOM_URL) {
        return { error: "Custom MCP URL is not configured in your profile. Please configure it in the dashboard settings." };
    } 

    try {
        const headers: any = { 'Content-Type': 'application/json' };
        
        if (profile.mcpRequiresAuth && profile.mcpAuthToken) {
            headers['Authorization'] = `Bearer ${profile.mcpAuthToken}`;
            headers['x-api-key'] = profile.mcpAuthToken;
        }

        const { action, mcpToolName, mcpArguments } = toolInput;
        const baseUrl = CUSTOM_URL.replace(/\/$/, "");

        if (action === 'LIST_TOOLS') {
            try {
                const res = await axios.post(`${baseUrl}/tools/list`, {}, { headers, timeout: 10000 });
                return { status: "Success", tools: res.data.tools || res.data };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { jsonrpc: "2.0", id: 1, method: "tools/list" }, { headers, timeout: 10000 });
                    return { status: "Success", tools: rpcRes.data.result?.tools || rpcRes.data };
                }
                throw err;
            }
        } 
        else if (action === 'CALL_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonParse(mcpArguments) || {};
            
            try {
                const res = await axios.post(`${baseUrl}/tools/call`, { 
                    name: mcpToolName, 
                    arguments: parsedArgs 
                }, { headers, timeout: 25000 });
                return { status: "Success", data: res.data };
            } catch (err: any) {
                if (err.response?.status === 404) {
                    const rpcRes = await axios.post(`${baseUrl}/message`, { 
                        jsonrpc: "2.0", 
                        id: 2, 
                        method: "tools/call", 
                        params: { name: mcpToolName, arguments: parsedArgs } 
                    }, { headers, timeout: 25000 });
                    return { status: "Success", data: rpcRes.data.result || rpcRes.data };
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