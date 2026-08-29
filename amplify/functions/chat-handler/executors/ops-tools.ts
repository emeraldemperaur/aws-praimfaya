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
        const baseUrl = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
        const { action, ticketId, query, ticketData, commentText, isPublic } = toolInput;

        if (action === 'TRIAGE_TICKETS' || action === 'SEARCH_KB') {
            const endpoint = action === 'TRIAGE_TICKETS' ? 'search.json' : 'help_center/articles/search.json';
            const searchQuery = query || 'type:ticket status:open';
            const res = await axios.get(`${baseUrl}/${endpoint}?query=${encodeURIComponent(searchQuery)}`, { headers });
            return { status: "Success", results: res.data.results?.slice(0, 15) };
        } 
        else if (action === 'CREATE_TICKET') {
            const parsedPayload = safeJsonParse(ticketData);
            if (!parsedPayload) return { error: "Invalid JSON provided in ticketData." };

            const res = await axios.post(`${baseUrl}/tickets.json`, { ticket: parsedPayload }, { headers });
            return { status: "Success", ticket: res.data.ticket };
        }
        else if (action === 'UPDATE_TICKET' && ticketId) {
            const parsedPayload = safeJsonParse(ticketData);
            if (!parsedPayload) return { error: "Invalid JSON provided in ticketData." };

            const res = await axios.put(`${baseUrl}/tickets/${ticketId}.json`, { ticket: parsedPayload }, { headers });
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
            const res = await axios.put(`${baseUrl}/tickets/${ticketId}.json`, payload, { headers });
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
        const baseUrl = `https://${SNOW_INSTANCE}.service-now.com/api/now/table`;
        const { action, incidentId, sysId, resolutionNotes, closeCode, shortDescription, urgency, impact, assignmentGroup, query } = toolInput;

        const resolveSysId = async (identifier: string): Promise<string | null> => {
            if (/^[0-9a-f]{32}$/i.test(identifier)) return identifier;
            const searchRes = await axios.get(`${baseUrl}/incident?sysparm_query=number=${identifier}&sysparm_limit=1`, { headers });
            return searchRes.data?.result?.[0]?.sys_id || null;
        };

        const targetId = incidentId || sysId;

        if (action === 'GET_INCIDENT' && targetId) {
            const resolvedId = await resolveSysId(targetId);
            if (!resolvedId) return { error: `Incident ${targetId} not found in ServiceNow.` };

            const res = await axios.get(`${baseUrl}/incident/${resolvedId}`, { headers });
            return { status: "Success", incident: res.data.result };
        }
        else if (action === 'QUERY_INCIDENTS') {
            const sysparmQuery = query || 'active=true^priorityIN1,2';
            const res = await axios.get(`${baseUrl}/incident?sysparm_query=${encodeURIComponent(sysparmQuery)}&sysparm_limit=10`, { headers });
            return { status: "Success", count: res.data.result?.length, incidents: res.data.result };
        }
        else if (action === 'CREATE_INCIDENT') {
            const payload = {
                short_description: shortDescription,
                urgency: urgency || '3',
                impact: impact || '3',
                assignment_group: assignmentGroup || undefined
            };
            const res = await axios.post(`${baseUrl}/incident`, payload, { headers });
            return { status: "Success", incidentNumber: res.data.result?.number, sysId: res.data.result?.sys_id, incident: res.data.result };
        }
        else if (action === 'RESOLVE_INCIDENT' && targetId) {
            const resolvedId = await resolveSysId(targetId);
            if (!resolvedId) return { error: `Incident ${targetId} not found in ServiceNow.` };

            const payload = { 
                state: '6', 
                close_code: closeCode || 'Solved (Permanently)',
                close_notes: resolutionNotes || 'Resolved via automated assistant workflow.' 
            };
            const res = await axios.put(`${baseUrl}/incident/${resolvedId}`, payload, { headers });
            return { status: "Success", incident: res.data.result };
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
            const res = await axios.get(`${baseUrl}/incidents?statuses[]=triggered&statuses[]=acknowledged&limit=15`, { headers });
            return { status: "Success", incidents: res.data.incidents };
        }
        else if (action === 'GET_ON_CALL') {
            const res = await axios.get(`${baseUrl}/oncalls?include[]=users`, { headers });
            const onCalls = res.data.oncalls?.map((oc: any) => ({
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
            const res = await axios.post(`${baseUrl}/incidents`, payload, { headers });
            return { status: "Success", incident: res.data.incident };
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
            const res = await axios.put(`${baseUrl}/incidents/${incidentId}`, payload, { headers });
            return { status: "Success", incident: res.data.incident };
        }
        else if (action === 'ADD_NOTE' && incidentId && noteText) {
            if (!PD_USER_EMAIL) return { error: "PagerDuty requires 'pagerDutyUserEmail' in ephemeralSecrets to add notes." };

            const payload = { note: { content: noteText } };
            const res = await axios.post(`${baseUrl}/incidents/${incidentId}/notes`, payload, { headers });
            return { status: "Success", note: res.data.note };
        }

        return { error: `Missing required parameters or unsupported PagerDuty action: ${action}` };
    } catch (err: any) {
        return { error: `PagerDuty Error: ${err.response?.data?.error?.message || err.message}` };
    }
};