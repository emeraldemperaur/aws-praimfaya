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

export const executeSalesforceCRM = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SF_URL = ephemeralSecrets.salesforceInstanceUrl;
    const SF_TOKEN = ephemeralSecrets.salesforceAccessToken;
    
    if (!SF_URL || !SF_TOKEN) {
        return { error: "Missing Salesforce credentials. Call 'request_secure_credentials' with serviceName 'salesforce'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${SF_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, query, objectName, recordId, recordData } = toolInput;
        const baseUrl = `${SF_URL.replace(/\/$/, "")}/services/data/v58.0`;

        if (action === 'SOQL_QUERY' && query) {
            const safeQuery = query.toLowerCase().includes('limit') ? query : `${query} LIMIT 15`;
            const res = await axios.get(`${baseUrl}/query/?q=${encodeURIComponent(safeQuery)}`, { headers });
            return { status: "Success", totalSize: res.data.totalSize, records: res.data.records };
        } 
        else if (action === 'GET_RECORD' && objectName && recordId) {
            const res = await axios.get(`${baseUrl}/sobjects/${objectName}/${recordId}`, { headers });
            return { status: "Success", record: res.data };
        } 
        else if (action === 'CREATE_RECORD' && objectName && recordData) {
            const payload = safeJsonParse(recordData);
            const res = await axios.post(`${baseUrl}/sobjects/${objectName}/`, payload, { headers });
            return { status: "Success", result: res.data };
        } 
        else if (action === 'UPDATE_RECORD' && objectName && recordId && recordData) {
            const payload = safeJsonParse(recordData);
            await axios.patch(`${baseUrl}/sobjects/${objectName}/${recordId}`, payload, { headers });
            return { status: "Success", message: `${objectName} record ${recordId} updated successfully.` };
        } 
        else if (action === 'LOG_ACTIVITY' && recordId && recordData) {
            const payload = safeJsonParse(recordData);
            payload.WhoId = recordId;
            const res = await axios.post(`${baseUrl}/sobjects/Task/`, payload, { headers });
            return { status: "Success", message: "Activity logged successfully.", taskId: res.data.id };
        }

        return { error: `Missing required parameters or unsupported Salesforce action: ${action}` };
    } catch (err: any) { 
        return { error: `Salesforce Error: ${err.response?.data?.[0]?.message || err.message}` }; 
    }
};


export const executeSAPERP = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SAP_URL = ephemeralSecrets.sapBaseUrl;
    const SAP_USER = ephemeralSecrets.sapUsername;
    const SAP_PASS = ephemeralSecrets.sapPassword;
    
    if (!SAP_URL || !SAP_USER || !SAP_PASS) {
        return { error: "Missing SAP credentials. Call 'request_secure_credentials' with serviceName 'sap'." };
    } 

    try {
        const authString = Buffer.from(`${SAP_USER}:${SAP_PASS}`).toString('base64');
        const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json', 'Content-Type': 'application/json' };
        const { action, endpoint, payload } = toolInput;
        const baseUrl = SAP_URL.replace(/\/$/, "");

        if (action === 'ODATA_GET' && endpoint) {
            const safeEndpoint = endpoint.includes('$top') ? endpoint : `${endpoint}${endpoint.includes('?') ? '&' : '?'}$top=15`;
            const res = await axios.get(`${baseUrl}${safeEndpoint}`, { headers });
            return { status: "Success", data: res.data.d || res.data };
        } 
        else if (action === 'ODATA_POST' && endpoint) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}${endpoint}`, parsedPayload, { headers });
            return { status: "Success", data: res.data.d || res.data };
        }

        return { error: `Missing required parameters or unsupported SAP action: ${action}` };
    } catch (err: any) { 
        return { error: `SAP Error: ${err.response?.data?.error?.message?.value || err.message}` }; 
    }
};


export const executeDynamic365 = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const D365_URL = ephemeralSecrets.dynamicsInstanceUrl;
    const D365_TOKEN = ephemeralSecrets.dynamicsAccessToken;
    
    if (!D365_URL || !D365_TOKEN) {
        return { error: "Missing Dynamics 365 credentials. Call 'request_secure_credentials' with serviceName 'dynamics'." };
    } 

    try {
        const headers = { 
            Authorization: `Bearer ${D365_TOKEN}`, 
            'Content-Type': 'application/json', 
            'OData-MaxVersion': '4.0', 
            'OData-Version': '4.0',
            'Prefer': 'odata.maxpagesize=15'
        };
        const { action, entityPluralName, queryOptions, recordId, payload } = toolInput;
        const baseUrl = `${D365_URL.replace(/\/$/, "")}/api/data/v9.2`;

        if (action === 'RETRIEVE_RECORDS' && entityPluralName) {
            const q = queryOptions ? `?${queryOptions}` : '';
            const res = await axios.get(`${baseUrl}/${entityPluralName}${q}`, { headers });
            return { status: "Success", records: res.data.value };
        } 
        else if (action === 'CREATE_RECORD' && entityPluralName && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}/${entityPluralName}`, parsedPayload, { headers });
            return { status: "Success", recordId: res.headers['odata-entityid'] };
        } 
        else if (action === 'UPDATE_RECORD' && entityPluralName && recordId && payload) {
            const parsedPayload = safeJsonParse(payload);
            await axios.patch(`${baseUrl}/${entityPluralName}(${recordId})`, parsedPayload, { headers });
            return { status: "Success", message: `${entityPluralName} record updated.` };
        }

        return { error: `Missing required parameters or unsupported Dynamics action: ${action}` };
    } catch (err: any) { 
        return { error: `Dynamics 365 Error: ${err.response?.data?.error?.message || err.message}` }; 
    }
};


export const executeHubSpotCRM = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const HS_TOKEN = ephemeralSecrets.hubspotAccessToken;
    
    if (!HS_TOKEN) {
        return { error: "Missing HubSpot credentials. Call 'request_secure_credentials' with serviceName 'hubspot'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, objectType, objectId, searchQuery, payload } = toolInput;
        const baseUrl = `https://api.hubapi.com/crm/v3/objects/${objectType}`;

        if (action === 'SEARCH_OBJECTS' && objectType) {
            const parsedQuery = safeJsonParse(searchQuery) || {};
            if (!parsedQuery.limit) parsedQuery.limit = 15; // Enforce limits
            
            const res = await axios.post(`${baseUrl}/search`, parsedQuery, { headers });
            return { status: "Success", total: res.data.total, results: res.data.results };
        } 
        else if (action === 'GET_OBJECT' && objectType && objectId) {
            const res = await axios.get(`${baseUrl}/${objectId}`, { headers });
            return { status: "Success", result: res.data };
        } 
        else if (action === 'CREATE_OBJECT' && objectType && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(baseUrl, { properties: parsedPayload }, { headers });
            return { status: "Success", result: res.data };
        } 
        else if (action === 'UPDATE_OBJECT' && objectType && objectId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.patch(`${baseUrl}/${objectId}`, { properties: parsedPayload }, { headers });
            return { status: "Success", result: res.data };
        } 
        else if (action === 'LOG_ENGAGEMENT' && objectType && objectId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const engagementData = {
                properties: parsedPayload,
                associations: [
                    { to: { id: objectId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: objectType === 'contacts' ? 202 : 206 }] }
                ]
            };
            const res = await axios.post(`https://api.hubapi.com/crm/v3/objects/notes`, engagementData, { headers });
            return { status: "Success", noteId: res.data.id };
        }

        return { error: `Missing required parameters for HubSpot action: ${action}` };
    } catch (err: any) { 
        return { error: `HubSpot Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeLinkedInSalesNavigator = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const LI_TOKEN = ephemeralSecrets.linkedInAccessToken;
    
    if (!LI_TOKEN) {
        return { error: "Missing LinkedIn credentials. Call 'request_secure_credentials' with serviceName 'linkedin'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${LI_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0' };
        const { action, query, accountId } = toolInput;
        
        if (action === 'SEARCH_LEADS') {
            const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorLeads?q=${encodeURIComponent(query || '')}&count=15`, { headers });
            return { status: "Success", leads: res.data.elements };
        } 
        else if (action === 'GET_ACCOUNT' && accountId) {
            const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorAccounts/${accountId}`, { headers });
            return { status: "Success", account: res.data };
        }

        return { error: `Missing required parameters for LinkedIn action: ${action}` };
    } catch (err: any) { 
        return { error: `LinkedIn Error: ${err.response?.data?.message || err.message}` }; 
    }
};