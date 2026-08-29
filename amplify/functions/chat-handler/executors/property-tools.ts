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


export const executeButterflyMX = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const BMX_TOKEN = ephemeralSecrets.butterflyMxToken;
    
    if (!BMX_TOKEN) {
        return { error: "Missing ButterflyMX Access Token. Call 'request_secure_credentials' with serviceName 'butterflymx'." };
    } 

    try {
        const headers = { 
            Authorization: `Bearer ${BMX_TOKEN}`, 
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json' 
        };
        const { action, buildingId, tenantId, deviceId, virtualKeyId, virtualKeyData, tenantData } = toolInput;
        const baseUrl = `https://api.butterflymx.com/v3`;

        if (action === 'GET_BUILDINGS') {
            const res = await axios.get(`${baseUrl}/buildings`, { headers });
            return { status: "Success", buildings: res.data.data };
        } 
        else if (action === 'GET_TENANTS' && buildingId) {
            const res = await axios.get(`${baseUrl}/buildings/${buildingId}/tenants`, { headers });
            return { status: "Success", tenants: res.data.data };
        } 
        else if (action === 'GET_DEVICES' && buildingId) {
            const res = await axios.get(`${baseUrl}/buildings/${buildingId}/devices`, { headers });
            return { status: "Success", devices: res.data.data };
        }
        else if (action === 'GET_ACCESS_LOGS' && buildingId) {
            const res = await axios.get(`${baseUrl}/buildings/${buildingId}/access_logs?page[limit]=20`, { headers });
            return { status: "Success", logs: res.data.data };
        } 
        else if (action === 'GET_MY_ACCESS_LOGS' && tenantId) {
            const res = await axios.get(`${baseUrl}/tenants/${tenantId}/access_logs?page[limit]=10`, { headers });
            return { status: "Success", logs: res.data.data };
        }
        else if (action === 'OPEN_DOOR' && deviceId) {
            const res = await axios.post(`${baseUrl}/devices/${deviceId}/open`, {}, { headers });
            return { status: "Success", message: "Door release command sent successfully.", data: res.data };
        } 
        else if (action === 'CREATE_VIRTUAL_KEY' && buildingId && virtualKeyData) {
            const parsedData = safeJsonParse(virtualKeyData);
            if (!parsedData) return { error: "Invalid JSON provided in virtualKeyData." };

            const payload = { data: { type: "virtual_keys", attributes: parsedData } };
            const res = await axios.post(`${baseUrl}/buildings/${buildingId}/virtual_keys`, payload, { headers });
            return { status: "Success", virtualKey: res.data.data };
        }
        else if (action === 'REVOKE_VIRTUAL_KEY' && buildingId && virtualKeyId) {
            await axios.delete(`${baseUrl}/buildings/${buildingId}/virtual_keys/${virtualKeyId}`, { headers });
            return { status: "Success", message: `Virtual key ${virtualKeyId} revoked successfully.` };
        }
        else if (action === 'UPDATE_TENANT' && tenantId && tenantData) {
            const parsedData = safeJsonParse(tenantData);
            if (!parsedData) return { error: "Invalid JSON provided in tenantData." };

            const payload = { 
                data: { 
                    type: "tenants", 
                    id: tenantId, 
                    attributes: parsedData 
                } 
            };
            const res = await axios.patch(`${baseUrl}/tenants/${tenantId}`, payload, { headers });
            return { status: "Success", message: "Tenant preferences updated.", tenant: res.data.data };
        }

        return { error: `Missing required parameters or unsupported ButterflyMX action: ${action}` };
    } catch (err: any) { 
        return { error: `ButterflyMX Error: ${err.response?.data?.errors?.[0]?.detail || err.message}` }; 
    }
};

export const executeYardi = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    const YARDI_TOKEN = ephemeralSecrets.yardiToken;
    const YARDI_PROPERTY_ID = ephemeralSecrets.yardiPropertyId;
    
    const YARDI_MCP_URL = env.YARDI_MCP_URL || 'https://virtuoso.yardi.com/mcp'; 
    
    if (!YARDI_TOKEN) {
        return { error: "Missing Yardi Virtuoso credentials. Call 'request_secure_credentials' with serviceName 'yardi'." };
    } 

    try {
        const headers: any = { 
            Authorization: `Bearer ${YARDI_TOKEN}`, 
            'Content-Type': 'application/json' 
        };
        if (YARDI_PROPERTY_ID) headers['X-Yardi-Property-Id'] = YARDI_PROPERTY_ID;

        const { action, mcpToolName, mcpArguments } = toolInput;
        
        if (action === 'LIST_YARDI_TOOLS') {
            const res = await axios.get(`${YARDI_MCP_URL}/tools/list`, { headers, timeout: 15000 });
            return { status: "Success", availableTools: res.data.tools };
        }
        else if (action === 'CALL_YARDI_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonParse(mcpArguments) || {};
            
            const res = await axios.post(`${YARDI_MCP_URL}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, { headers, timeout: 25000 });
            
            return { status: "Success", data: res.data };
        }

        return { error: `Missing required parameters or unsupported Yardi action: ${action}` };
    } catch (err: any) { 
        if (err.response?.status === 401 || err.response?.status === 403) {
            return { error: "Yardi Virtuoso credentials expired or invalid. Call 'request_secure_credentials' with serviceName 'yardi'." };
        } else {
            return { error: `Yardi MCP Error: ${err.response?.data?.error || err.message}` }; 
        }
    }
};