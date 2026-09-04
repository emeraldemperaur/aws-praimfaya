import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_RECORD_LIMIT = 25;

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


const simplifyJsonApiArray = (items: any[]): any[] => {
    if (!Array.isArray(items)) return [];
    return items.slice(0, MAX_RECORD_LIMIT).map((item: any) => ({
        id: item.id,
        type: item.type,
        ...(item.attributes || {})
    }));
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
            const res = await axios.get(`${baseUrl}/buildings`, { headers, timeout: TIMEOUT_MS });
            const buildings = simplifyJsonApiArray(res.data?.data);
            return { status: "Success", count: buildings.length, buildings };
        } 
        else if (action === 'GET_TENANTS' && buildingId) {
            const safeBldgId = encodeURIComponent(buildingId);
            const res = await axios.get(`${baseUrl}/buildings/${safeBldgId}/tenants`, { headers, timeout: TIMEOUT_MS });
            const rawTenants = Array.isArray(res.data?.data) ? res.data.data : [];
            const tenants = simplifyJsonApiArray(rawTenants);

            return { status: "Success", totalFound: rawTenants.length, returnedCount: tenants.length, tenants };
        } 
        else if (action === 'GET_DEVICES' && buildingId) {
            const safeBldgId = encodeURIComponent(buildingId);
            const res = await axios.get(`${baseUrl}/buildings/${safeBldgId}/devices`, { headers, timeout: TIMEOUT_MS });
            const devices = simplifyJsonApiArray(res.data?.data);

            return { status: "Success", count: devices.length, devices };
        }
        else if (action === 'GET_ACCESS_LOGS' && buildingId) {
            const safeBldgId = encodeURIComponent(buildingId);
            const res = await axios.get(`${baseUrl}/buildings/${safeBldgId}/access_logs?page[limit]=${MAX_RECORD_LIMIT}`, { headers, timeout: TIMEOUT_MS });
            const logs = simplifyJsonApiArray(res.data?.data);

            return { status: "Success", count: logs.length, logs };
        } 
        else if (action === 'GET_MY_ACCESS_LOGS' && tenantId) {
            const safeTenantId = encodeURIComponent(tenantId);
            const res = await axios.get(`${baseUrl}/tenants/${safeTenantId}/access_logs?page[limit]=10`, { headers, timeout: TIMEOUT_MS });
            const logs = simplifyJsonApiArray(res.data?.data);

            return { status: "Success", count: logs.length, logs };
        }
        else if (action === 'OPEN_DOOR' && deviceId) {
            const safeDeviceId = encodeURIComponent(deviceId);
            const res = await axios.post(`${baseUrl}/devices/${safeDeviceId}/open`, {}, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: "Door release command sent successfully.", data: res.data };
        } 
        else if (action === 'CREATE_VIRTUAL_KEY' && buildingId && virtualKeyData) {
            const safeBldgId = encodeURIComponent(buildingId);
            const parsedData = safeJsonObject(virtualKeyData);
            
            if (Object.keys(parsedData).length === 0) {
                return { error: "Invalid or empty JSON provided in virtualKeyData." };
            }

            const payload = { data: { type: "virtual_keys", attributes: parsedData } };
            const res = await axios.post(`${baseUrl}/buildings/${safeBldgId}/virtual_keys`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", virtualKey: res.data?.data };
        }
        else if (action === 'REVOKE_VIRTUAL_KEY' && buildingId && virtualKeyId) {
            const safeBldgId = encodeURIComponent(buildingId);
            const safeKeyId = encodeURIComponent(virtualKeyId);
            await axios.delete(`${baseUrl}/buildings/${safeBldgId}/virtual_keys/${safeKeyId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Virtual key ${virtualKeyId} revoked successfully.` };
        }
        else if (action === 'UPDATE_TENANT' && tenantId && tenantData) {
            const safeTenantId = encodeURIComponent(tenantId);
            const parsedData = safeJsonObject(tenantData);
            
            if (Object.keys(parsedData).length === 0) {
                return { error: "Invalid or empty JSON provided in tenantData." };
            }

            const payload = { 
                data: { 
                    type: "tenants", 
                    id: tenantId, 
                    attributes: parsedData 
                } 
            };
            const res = await axios.patch(`${baseUrl}/tenants/${safeTenantId}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: "Tenant preferences updated.", tenant: res.data?.data };
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
        const headers: Record<string, string> = { 
            Authorization: `Bearer ${YARDI_TOKEN}`, 
            'Content-Type': 'application/json' 
        };
        if (YARDI_PROPERTY_ID) headers['X-Yardi-Property-Id'] = YARDI_PROPERTY_ID;

        const { action, mcpToolName, mcpArguments } = toolInput;
        
        if (action === 'LIST_YARDI_TOOLS') {
            const res = await axios.get(`${YARDI_MCP_URL}/tools/list`, { headers, timeout: TIMEOUT_MS });
            const rawTools = Array.isArray(res.data?.tools) ? res.data.tools : [];
            const availableTools = rawTools.slice(0, MAX_RECORD_LIMIT);

            return { status: "Success", totalTools: rawTools.length, availableTools };
        }
        else if (action === 'CALL_YARDI_TOOL' && mcpToolName) {
            const parsedArgs = safeJsonObject(mcpArguments);
            
            const res = await axios.post(`${YARDI_MCP_URL}/tools/call`, { 
                name: mcpToolName, 
                arguments: parsedArgs 
            }, { headers, timeout: TIMEOUT_MS });
            
            let data = res.data;
            if (Array.isArray(data) && data.length > MAX_RECORD_LIMIT) {
                data = {
                    totalRecords: data.length,
                    truncated: true,
                    records: data.slice(0, MAX_RECORD_LIMIT)
                };
            }

            return { status: "Success", data };
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