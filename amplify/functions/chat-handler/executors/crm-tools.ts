import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_RECORDS = 50;

const safeJsonParse = (data: any) => {
    if (!data) return {};
    if (typeof data === 'object' && !Array.isArray(data)) return data; 
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch { 
        return {}; 
    }
};

const projectRecord = (record: Record<string, any>): Record<string, any> => {
    if (!record || typeof record !== 'object') return record;
    
    const projected: Record<string, any> = {};
    const IGNORED_KEYS = new Set([
        'attributes', 'SystemModstamp', 'CreatedById', 'LastModifiedById', 
        'IsDeleted', 'MayEdit', 'IsLocked', 'LastViewedDate', 'LastReferencedDate',
        'PhotoUrl', '_links', 'archived'
    ]);

    for (const [key, value] of Object.entries(record)) {
        if (IGNORED_KEYS.has(key) || value === null || value === undefined || value === '') {
            continue;
        }
        
        if (typeof value === 'object' && !Array.isArray(value)) {
            projected[key] = value.Name || value.name || value.id || '[Object]';
        } else if (Array.isArray(value)) {
            projected[key] = `[Array (${value.length} items)]`;
        } else {
            projected[key] = value;
        }
    }

    return projected;
};

const slimAndProjectRecords = (records: any[], max = MAX_RECORDS) => {
    if (!Array.isArray(records)) return [];
    return records.slice(0, max).map(r => (typeof r === 'object' && r !== null ? projectRecord(r) : r));
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
        const baseCost = { action: `SALESFORCE_${action}`, creditsToDeduct: 5 };

        if (action === 'SOQL_QUERY' && query) {
            const safeQuery = query.toLowerCase().includes('limit') ? query : `${query} LIMIT ${MAX_RECORDS}`;
            const res = await axios.get(`${baseUrl}/query/?q=${encodeURIComponent(safeQuery)}`, { headers, timeout: TIMEOUT_MS });
            const cleanRecords = slimAndProjectRecords(res.data.records, MAX_RECORDS);
            return { status: "Success", totalSize: res.data.totalSize, count: cleanRecords.length, records: cleanRecords, billingMetrics: baseCost };
        } 
        else if (action === 'GET_RECORD' && objectName && recordId) {
            const res = await axios.get(`${baseUrl}/sobjects/${objectName}/${recordId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", record: projectRecord(res.data), billingMetrics: baseCost };
        } 
        else if (action === 'CREATE_RECORD' && objectName && recordData) {
            const payload = safeJsonParse(recordData);
            const res = await axios.post(`${baseUrl}/sobjects/${objectName}/`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", result: res.data, billingMetrics: baseCost };
        } 
        else if (action === 'UPDATE_RECORD' && objectName && recordId && recordData) {
            const payload = safeJsonParse(recordData);
            await axios.patch(`${baseUrl}/sobjects/${objectName}/${recordId}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `${objectName} record ${recordId} updated.`, billingMetrics: baseCost };
        } 
        else if (action === 'LOG_ACTIVITY' && recordId && recordData) {
            const payload = safeJsonParse(recordData);
            payload.WhoId = recordId; 
            const res = await axios.post(`${baseUrl}/sobjects/Task/`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: "Activity logged.", taskId: res.data.id, billingMetrics: baseCost };
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
        const baseCost = { action: `SAP_${action}`, creditsToDeduct: 8 };

        if (action === 'ODATA_GET' && endpoint) {
            const safeEndpoint = endpoint.includes('$top') ? endpoint : `${endpoint}${endpoint.includes('?') ? '&' : '?'}$top=${MAX_RECORDS}`;
            const res = await axios.get(`${baseUrl}${safeEndpoint}`, { headers, timeout: TIMEOUT_MS });
            const dataArr = res.data.d?.results || res.data.d || res.data.value || res.data;
            const cleanData = slimAndProjectRecords(Array.isArray(dataArr) ? dataArr : [dataArr], MAX_RECORDS);
            return { status: "Success", count: cleanData.length, data: cleanData, billingMetrics: baseCost };
        } 
        else if (action === 'ODATA_POST' && endpoint) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}${endpoint}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", data: res.data.d || res.data, billingMetrics: baseCost };
        }

        return { error: `Missing parameters or unsupported SAP action: ${action}` };
    } catch (err: any) { 
        return { error: `SAP Error: ${err.response?.data?.error?.message?.value || err.message}` }; 
    }
};

export const executeDynamic365 = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const D365_URL = ephemeralSecrets.dynamicsInstanceUrl;
    const D365_TOKEN = ephemeralSecrets.dynamicsAccessToken;
    if (!D365_URL || !D365_TOKEN) return { error: "Missing Dynamics 365 credentials." };

    try {
        const headers = { 
            Authorization: `Bearer ${D365_TOKEN}`, 
            'Content-Type': 'application/json', 
            'OData-MaxVersion': '4.0', 
            'OData-Version': '4.0',
            'Prefer': `odata.maxpagesize=${MAX_RECORDS}`
        };
        const { action, entityPluralName, queryOptions, recordId, payload } = toolInput;
        const baseUrl = `${D365_URL.replace(/\/$/, "")}/api/data/v9.2`;
        const baseCost = { action: `DYNAMICS_${action}`, creditsToDeduct: 5 };

        if (action === 'RETRIEVE_RECORDS' && entityPluralName) {
            const q = queryOptions ? `?${queryOptions}` : '';
            const res = await axios.get(`${baseUrl}/${entityPluralName}${q}`, { headers, timeout: TIMEOUT_MS });
            const cleanRecords = slimAndProjectRecords(res.data.value, MAX_RECORDS);
            return { status: "Success", count: cleanRecords.length, records: cleanRecords, billingMetrics: baseCost };
        } 
        else if (action === 'CREATE_RECORD' && entityPluralName && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}/${entityPluralName}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", recordId: res.headers['odata-entityid'], billingMetrics: baseCost };
        } 
        else if (action === 'UPDATE_RECORD' && entityPluralName && recordId && payload) {
            const parsedPayload = safeJsonParse(payload);
            await axios.patch(`${baseUrl}/${entityPluralName}(${recordId})`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `${entityPluralName} record updated.`, billingMetrics: baseCost };
        }
        return { error: `Unsupported Dynamics action: ${action}` };
    } catch (err: any) { 
        return { error: `Dynamics 365 Error: ${err.response?.data?.error?.message || err.message}` }; 
    }
};

export const executeHubSpotCRM = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const HS_TOKEN = ephemeralSecrets.hubspotAccessToken;
    if (!HS_TOKEN) return { error: "Missing HubSpot credentials." };

    try {
        const headers = { Authorization: `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, objectType, objectId, searchQuery, payload } = toolInput;
        const baseUrl = `https://api.hubapi.com/crm/v3/objects/${objectType}`;
        const baseCost = { action: `HUBSPOT_${action}`, creditsToDeduct: 5 };

        if (action === 'SEARCH_OBJECTS' && objectType) {
            const parsedQuery = safeJsonParse(searchQuery) || {};
            if (!parsedQuery.limit) parsedQuery.limit = MAX_RECORDS; 
            
            const res = await axios.post(`${baseUrl}/search`, parsedQuery, { headers, timeout: TIMEOUT_MS });
            const cleanResults = slimAndProjectRecords(res.data.results, MAX_RECORDS);
            return { status: "Success", total: res.data.total, count: cleanResults.length, results: cleanResults, billingMetrics: baseCost };
        } 
        else if (action === 'GET_OBJECT' && objectType && objectId) {
            const res = await axios.get(`${baseUrl}/${objectId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", result: projectRecord(res.data), billingMetrics: baseCost };
        } 
        else if (action === 'CREATE_OBJECT' && objectType && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(baseUrl, { properties: parsedPayload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", result: res.data, billingMetrics: baseCost };
        } 
        else if (action === 'UPDATE_OBJECT' && objectType && objectId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.patch(`${baseUrl}/${objectId}`, { properties: parsedPayload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", result: res.data, billingMetrics: baseCost };
        } 
        else if (action === 'LOG_ENGAGEMENT' && objectType && objectId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const engagementData = {
                properties: parsedPayload,
                associations: [{ to: { id: objectId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: objectType === 'contacts' ? 202 : 206 }] }]
            };
            const res = await axios.post(`https://api.hubapi.com/crm/v3/objects/notes`, engagementData, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", noteId: res.data.id, billingMetrics: baseCost };
        }
        return { error: `Missing parameters for HubSpot action: ${action}` };
    } catch (err: any) { 
        return { error: `HubSpot Error: ${err.response?.data?.message || err.message}` }; 
    }
};

export const executeLinkedInSalesNavigator = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const LI_TOKEN = ephemeralSecrets.linkedInAccessToken;
    if (!LI_TOKEN) return { error: "Missing LinkedIn credentials." };

    try {
        const headers = { Authorization: `Bearer ${LI_TOKEN}`, 'X-Restli-Protocol-Version': '2.0.0' };
        const { action, query, accountId } = toolInput;
        const baseCost = { action: `LINKEDIN_${action}`, creditsToDeduct: 10 };
        
        if (action === 'SEARCH_LEADS') {
            const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorLeads?q=${encodeURIComponent(query || '')}&count=${MAX_RECORDS}`, { headers, timeout: TIMEOUT_MS });
            const cleanLeads = slimAndProjectRecords(res.data.elements, MAX_RECORDS);
            return { status: "Success", count: cleanLeads.length, leads: cleanLeads, billingMetrics: baseCost };
        } 
        else if (action === 'GET_ACCOUNT' && accountId) {
            const res = await axios.get(`https://api.linkedin.com/v2/salesNavigatorAccounts/${accountId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", account: projectRecord(res.data), billingMetrics: baseCost };
        }
        return { error: `Missing parameters for LinkedIn action: ${action}` };
    } catch (err: any) { 
        return { error: `LinkedIn Error: ${err.response?.data?.message || err.message}` }; 
    }
};