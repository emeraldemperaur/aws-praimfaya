import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_RECORD_LIMIT = 15;


const safeJsonObject = (data: any): Record<string, any> => {
    if (!data) return {};
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    try {
        const parsed = JSON.parse(data);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
        return {};
    }
};

export const executeZendesk = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ZENDESK_TOKEN = ephemeralSecrets.zendeskToken;
    const ZENDESK_EMAIL = ephemeralSecrets.zendeskEmail;
    const ZENDESK_SUBDOMAIN = ephemeralSecrets.zendeskSubdomain;

    if (!ZENDESK_TOKEN || !ZENDESK_EMAIL || !ZENDESK_SUBDOMAIN) {
        return { error: "Missing Zendesk credentials. You MUST call 'request_secure_credentials' with serviceName 'zendesk'." };
    }

    try {
        const authString = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`).toString('base64');
        const headers = { 
            Authorization: `Basic ${authString}`, 
            Accept: 'application/json',
            'Content-Type': 'application/json' 
        };
        const cleanSubdomain = encodeURIComponent(ZENDESK_SUBDOMAIN.replace(/[^a-zA-Z0-9-]/g, ''));
        const baseUrl = `https://${cleanSubdomain}.zendesk.com/api/v2`;
        const { action, ticketId, query, ticketData, commentText, isPublic } = toolInput;

        if (action === 'TRIAGE_TICKETS' || action === 'SEARCH_KB') {
            const endpoint = action === 'TRIAGE_TICKETS' ? 'search.json' : 'help_center/articles/search.json';
            const searchQuery = query || 'type:ticket status:open';
            const res = await axios.get(`${baseUrl}/${endpoint}?query=${encodeURIComponent(searchQuery)}`, { headers, timeout: TIMEOUT_MS });
            
            const rawResults = Array.isArray(res.data?.results) ? res.data.results : [];
            const results = rawResults.slice(0, MAX_RECORD_LIMIT).map((item: any) => ({
                id: item.id,
                title: item.title || item.subject,
                status: item.status,
                priority: item.priority,
                created_at: item.created_at,
                snippet: item.snippet || (item.body ? item.body.substring(0, 300) : '')
            }));

            return { status: "Success", resultsFound: rawResults.length, returnedCount: results.length, results };
        } 
        else if (action === 'CREATE_TICKET') {
            const parsedPayload = safeJsonObject(ticketData);
            if (Object.keys(parsedPayload).length === 0) {
                return { error: "Invalid or empty JSON provided in ticketData." };
            }

            const res = await axios.post(`${baseUrl}/tickets.json`, { ticket: parsedPayload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", ticket: res.data.ticket };
        }
        else if (action === 'UPDATE_TICKET' && ticketId) {
            const parsedPayload = safeJsonObject(ticketData);
            if (Object.keys(parsedPayload).length === 0) {
                return { error: "Invalid or empty JSON provided in ticketData." };
            }

            const res = await axios.put(`${baseUrl}/tickets/${encodeURIComponent(ticketId)}.json`, { ticket: parsedPayload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", ticket: res.data.ticket };
        }
        else if (action === 'ADD_COMMENT' && ticketId && commentText) {
            const payload = {
                ticket: {
                    comment: {
                        body: commentText,
                        public: isPublic ?? false
                    }
                }
            };
            const res = await axios.put(`${baseUrl}/tickets/${encodeURIComponent(ticketId)}.json`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", ticket: res.data.ticket };
        }

        return { error: `Missing required parameters or unsupported Zendesk action: ${action}` };
    } catch (err: any) {
        return { error: `Zendesk Error: ${err.response?.data?.description || err.response?.data?.error || err.message}` };
    }
};


export const executeServiceNow = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SNOW_USER = ephemeralSecrets.serviceNowUser;
    const SNOW_PASS = ephemeralSecrets.serviceNowPassword;
    const SNOW_INSTANCE = ephemeralSecrets.serviceNowInstance;

    if (!SNOW_USER || !SNOW_PASS || !SNOW_INSTANCE) {
        return { error: "Missing ServiceNow credentials. You MUST call 'request_secure_credentials' with serviceName 'servicenow'." };
    }

    try {
        const authString = Buffer.from(`${SNOW_USER}:${SNOW_PASS}`).toString('base64');
        const headers = { 
            Authorization: `Basic ${authString}`, 
            Accept: 'application/json',
            'Content-Type': 'application/json' 
        };
        const cleanInstance = encodeURIComponent(SNOW_INSTANCE.replace(/[^a-zA-Z0-9-]/g, ''));
        const baseUrl = `https://${cleanInstance}.service-now.com/api/now/table`;
        const { action, incidentId, sysId, resolutionNotes, closeCode, shortDescription, urgency, impact, assignmentGroup, query } = toolInput;

        const resolveSysId = async (identifier: string): Promise<string | null> => {
            if (/^[0-9a-f]{32}$/i.test(identifier)) return identifier;
            try {
                const searchRes = await axios.get(`${baseUrl}/incident?sysparm_query=number=${encodeURIComponent(identifier)}&sysparm_limit=1`, { headers, timeout: TIMEOUT_MS });
                return searchRes.data?.result?.[0]?.sys_id || null;
            } catch {
                return null;
            }
        };

        const targetId = incidentId || sysId;

        if (action === 'GET_INCIDENT' && targetId) {
            const resolvedId = await resolveSysId(targetId);
            if (!resolvedId) return { error: `Incident ${targetId} not found in ServiceNow.` };

            const res = await axios.get(`${baseUrl}/incident/${resolvedId}`, { headers, timeout: TIMEOUT_MS });
            
            const rawIncident = res.data.result || {};
            const trimmedIncident = {
                sys_id: rawIncident.sys_id,
                number: rawIncident.number,
                short_description: rawIncident.short_description,
                description: rawIncident.description,
                state: rawIncident.state,
                urgency: rawIncident.urgency,
                impact: rawIncident.impact,
                priority: rawIncident.priority,
                assignment_group: rawIncident.assignment_group?.display_value || rawIncident.assignment_group,
                assigned_to: rawIncident.assigned_to?.display_value || rawIncident.assigned_to,
                sys_created_on: rawIncident.sys_created_on
            };

            return { status: "Success", incident: trimmedIncident };
        }
        else if (action === 'QUERY_INCIDENTS') {
            const sysparmQuery = query || 'active=true^priorityIN1,2';
            const res = await axios.get(`${baseUrl}/incident?sysparm_query=${encodeURIComponent(sysparmQuery)}&sysparm_limit=${MAX_RECORD_LIMIT}`, { headers, timeout: TIMEOUT_MS });
            
            const rawIncidents = Array.isArray(res.data?.result) ? res.data.result : [];
            const incidents = rawIncidents.map((inc: any) => ({
                sys_id: inc.sys_id,
                number: inc.number,
                short_description: inc.short_description,
                state: inc.state,
                urgency: inc.urgency,
                priority: inc.priority,
                sys_created_on: inc.sys_created_on
            }));

            return { status: "Success", count: incidents.length, incidents };
        }
        else if (action === 'CREATE_INCIDENT') {
            const payload = {
                short_description: shortDescription || 'Automated Incident',
                urgency: urgency || '3',
                impact: impact || '3',
                assignment_group: assignmentGroup || undefined
            };
            const res = await axios.post(`${baseUrl}/incident`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", incidentNumber: res.data.result?.number, sysId: res.data.result?.sys_id };
        }
        else if (action === 'RESOLVE_INCIDENT' && targetId) {
            const resolvedId = await resolveSysId(targetId);
            if (!resolvedId) return { error: `Incident ${targetId} not found in ServiceNow.` };

            const payload = { 
                state: '6', 
                close_code: closeCode || 'Solved (Permanently)',
                close_notes: resolutionNotes || 'Resolved via automated assistant workflow.' 
            };
            const res = await axios.put(`${baseUrl}/incident/${resolvedId}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", incidentNumber: res.data.result?.number, state: res.data.result?.state };
        }

        return { error: `Missing required parameters or unsupported ServiceNow action: ${action}` };
    } catch (err: any) {
        return { error: `ServiceNow Error: ${err.response?.data?.error?.message || err.message}` };
    }
};


export const executePagerDuty = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const PD_API_KEY = ephemeralSecrets.pagerDutyApiKey;
    const PD_USER_EMAIL = ephemeralSecrets.pagerDutyUserEmail;

    if (!PD_API_KEY) {
        return { error: "Missing PagerDuty credentials. You MUST call 'request_secure_credentials' with serviceName 'pagerduty'." };
    }

    try {
        const headers: Record<string, string> = { 
            Authorization: `Token token=${PD_API_KEY}`, 
            Accept: 'application/vnd.pagerduty+json;version=2', 
            'Content-Type': 'application/json' 
        };
        if (PD_USER_EMAIL) headers['From'] = PD_USER_EMAIL;

        const baseUrl = 'https://api.pagerduty.com';
        const { action, incidentId, noteText, serviceId, title, urgency } = toolInput;

        if (action === 'LIST_ALERTS' || action === 'RUN_DIAGNOSTICS') {
            const res = await axios.get(`${baseUrl}/incidents?statuses[]=triggered&statuses[]=acknowledged&limit=${MAX_RECORD_LIMIT}`, { headers, timeout: TIMEOUT_MS });
            
            const rawIncidents = Array.isArray(res.data?.incidents) ? res.data.incidents : [];
            const incidents = rawIncidents.map((inc: any) => ({
                id: inc.id,
                summary: inc.summary || inc.title,
                status: inc.status,
                urgency: inc.urgency,
                created_at: inc.created_at,
                service: inc.service?.summary || inc.service?.id
            }));

            return { status: "Success", count: incidents.length, incidents };
        }
        else if (action === 'GET_ON_CALL') {
            const res = await axios.get(`${baseUrl}/oncalls?include[]=users`, { headers, timeout: TIMEOUT_MS });
            const rawOnCalls = Array.isArray(res.data?.oncalls) ? res.data.oncalls : [];
            const onCalls = rawOnCalls.slice(0, MAX_RECORD_LIMIT).map((oc: any) => ({
                escalationPolicy: oc.escalation_policy?.summary,
                level: oc.escalation_level,
                user: oc.user?.summary,
                email: oc.user?.email
            }));
            return { status: "Success", onCalls };
        }
        else if (action === 'TRIGGER_INCIDENT' && serviceId && title) {
            if (!PD_USER_EMAIL) return { error: "PagerDuty requires 'pagerDutyUserEmail' in ephemeralSecrets to trigger incidents." };

            const payload = {
                incident: {
                    type: 'incident',
                    title: title,
                    service: { id: serviceId, type: 'service_reference' },
                    urgency: urgency || 'high'
                }
            };
            const res = await axios.post(`${baseUrl}/incidents`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", incidentId: res.data.incident?.id, status_state: res.data.incident?.status };
        }
        else if ((action === 'ACKNOWLEDGE_INCIDENT' || action === 'RESOLVE_INCIDENT') && incidentId) {
            if (!PD_USER_EMAIL) return { error: "PagerDuty requires 'pagerDutyUserEmail' in ephemeralSecrets to update incident status." };

            const newStatus = action === 'ACKNOWLEDGE_INCIDENT' ? 'acknowledged' : 'resolved';
            const payload = {
                incident: {
                    type: 'incident_reference',
                    status: newStatus
                }
            };
            const res = await axios.put(`${baseUrl}/incidents/${encodeURIComponent(incidentId)}`, payload, { headers, timeout: TIMEOUT_MS });
            return { 
                status: "Success", 
                incidentId: res.data.incident?.id, 
                incidentStatus: res.data.incident?.status,  };
        }
        else if (action === 'ADD_NOTE' && incidentId && noteText) {
            if (!PD_USER_EMAIL) return { error: "PagerDuty requires 'pagerDutyUserEmail' in ephemeralSecrets to add notes." };

            const payload = { note: { content: noteText } };
            const res = await axios.post(`${baseUrl}/incidents/${encodeURIComponent(incidentId)}/notes`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", noteId: res.data.note?.id };
        }

        return { error: `Missing required parameters or unsupported PagerDuty action: ${action}` };
    } catch (err: any) {
        return { error: `PagerDuty Error: ${err.response?.data?.error?.message || err.message}` };
    }
};