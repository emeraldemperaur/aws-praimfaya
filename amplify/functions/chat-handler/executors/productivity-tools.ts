import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
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

const getAtlassianBaseUrl = (domain: string) => {
    const cleanDomain = domain.replace('.atlassian.net', '').replace('https://', '');
    return `https://${cleanDomain}.atlassian.net`;
};

const extractGoogleDocText = (content: any[]): string => {
    let text = "";
    content?.forEach((element: any) => {
        if (element.paragraph?.elements) {
            element.paragraph.elements.forEach((el: any) => {
                if (el.textRun?.content) text += el.textRun.content;
            });
        }
    });
    return text.substring(0, 15000); // Cap at ~15k chars to protect LLM context
};

const simplifyGoogleSheetData = (sheets: any[]) => {
    return sheets.map(s => ({
        title: s.properties?.title,
        // Limit to 50 rows, mapping only the raw string values
        rows: s.data?.[0]?.rowData?.slice(0, 50).map((r: any) => 
            r.values?.map((v: any) => v.formattedValue || "").join(" | ")
        ) || []
    }));
};

export const executeJira = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ATLASSIAN_EMAIL = ephemeralSecrets.atlassianEmail;
    const ATLASSIAN_TOKEN = ephemeralSecrets.atlassianToken;
    const ATLASSIAN_DOMAIN = ephemeralSecrets.atlassianDomain; 
    
    if (!ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN || !ATLASSIAN_DOMAIN) {
        return { error: `Missing Atlassian credentials. Call 'request_secure_credentials' with serviceName 'atlassian'.` };
    }

    try {
        const authString = Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_TOKEN}`).toString('base64');
        const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json', 'Content-Type': 'application/json' };
        const { action, issueKey, issueData, jqlQuery, transitionId, commentBody } = toolInput;
        const baseUrl = getAtlassianBaseUrl(ATLASSIAN_DOMAIN);

        if (action === 'SEARCH_ISSUES') {
            const res = await axios.get(`${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jqlQuery || '')}&maxResults=${MAX_RECORD_LIMIT}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", issues: res.data.issues };
        } else if (action === 'CREATE_ISSUE') {
            const payload = safeJsonObject(issueData);
            const res = await axios.post(`${baseUrl}/rest/api/3/issue`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", issue: res.data };
        } else if (action === 'GET_ISSUE' && issueKey) {
            const res = await axios.get(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", issue: res.data };
        } else if (action === 'UPDATE_ISSUE' && issueKey) {
            const payload = safeJsonObject(issueData);
            await axios.put(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Issue ${issueKey} updated.` };
        } else if (action === 'TRANSITION_ISSUE' && issueKey && transitionId) {
            await axios.post(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, { transition: { id: transitionId } }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Issue ${issueKey} transitioned successfully.` };
        } else if (action === 'ADD_COMMENT' && issueKey && commentBody) {
            const payload = { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ text: commentBody, type: "text" }] }] } };
            const res = await axios.post(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", comment: res.data };
        }

        return { error: `Missing required parameters or unsupported Jira action: ${action}` };
    } catch (err: any) { 
        return { error: `Jira Error: ${err.response?.data?.message || JSON.stringify(err.response?.data?.errors) || err.message}` }; 
    }
};


export const executeConfluence = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ATLASSIAN_EMAIL = ephemeralSecrets.atlassianEmail;
    const ATLASSIAN_TOKEN = ephemeralSecrets.atlassianToken;
    const ATLASSIAN_DOMAIN = ephemeralSecrets.atlassianDomain; 
    
    if (!ATLASSIAN_EMAIL || !ATLASSIAN_TOKEN || !ATLASSIAN_DOMAIN) {
        return { error: `Missing Atlassian credentials. Call 'request_secure_credentials' with serviceName 'atlassian'.` };
    }

    try {
        const authString = Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_TOKEN}`).toString('base64');
        const headers = { Authorization: `Basic ${authString}`, Accept: 'application/json', 'Content-Type': 'application/json' };
        const { action, cqlQuery, pageId, pageData } = toolInput;
        const baseUrl = getAtlassianBaseUrl(ATLASSIAN_DOMAIN);

        if (action === 'SEARCH_PAGES') {
            const res = await axios.get(`${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cqlQuery || '')}&limit=${MAX_RECORD_LIMIT}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", pages: res.data.results };
        } else if (action === 'GET_PAGE' && pageId) {
            const res = await axios.get(`${baseUrl}/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage`, { headers, timeout: TIMEOUT_MS });
            
            if (res.data.body?.storage?.value) {
                res.data.body.storage.value = res.data.body.storage.value.substring(0, 20000);
            }
            return { status: "Success", page: res.data };
        } else if (action === 'CREATE_PAGE') {
            const payload = safeJsonObject(pageData);
            const res = await axios.post(`${baseUrl}/wiki/rest/api/content`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", page: res.data };
        } else if (action === 'UPDATE_PAGE' && pageId) {
            const payload = safeJsonObject(pageData);
            const res = await axios.put(`${baseUrl}/wiki/rest/api/content/${encodeURIComponent(pageId)}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", page: res.data };
        }

        return { error: `Missing required parameters or unsupported Confluence action: ${action}` };
    } catch (err: any) { 
        return { error: `Confluence Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeNotion = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const NOTION_TOKEN = ephemeralSecrets.notionToken;
    if (!NOTION_TOKEN) {
        return { error: "Missing Notion credentials. Call 'request_secure_credentials' with serviceName 'notion'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
        const { action, query, pageId, pageData } = toolInput;
        
        if (action === 'SEARCH_PAGES') {
            const res = await axios.post(`https://api.notion.com/v1/search`, { query, page_size: 10 }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", results: res.data.results };
        } else if (action === 'GET_PAGE' && pageId) {
            const res = await axios.get(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", pageMetadata: res.data };
        } else if (action === 'GET_PAGE_CONTENT' && pageId) {
            const res = await axios.get(`https://api.notion.com/v1/blocks/${encodeURIComponent(pageId)}/children?page_size=50`, { headers, timeout: TIMEOUT_MS });
            
            const simplifiedBlocks = res.data.results?.map((b: any) => ({
                type: b.type,
                text: b[b.type]?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
            })) || [];

            return { status: "Success", contentBlocks: simplifiedBlocks };
        } else if (action === 'CREATE_PAGE') {
            const payload = safeJsonObject(pageData);
            const res = await axios.post(`https://api.notion.com/v1/pages`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", page: res.data };
        } else if (action === 'UPDATE_PAGE' && pageId) {
            const payload = safeJsonObject(pageData);
            const res = await axios.patch(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, payload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", page: res.data };
        }

        return { error: `Missing required parameters or unsupported Notion action: ${action}` };
    } catch (err: any) { 
        return { error: `Notion Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeAsana = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ASANA_TOKEN = ephemeralSecrets.asanaToken;
    if (!ASANA_TOKEN) {
        return { error: "Missing Asana credentials. Call 'request_secure_credentials' with serviceName 'asana'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${ASANA_TOKEN}`, Accept: 'application/json' };
        const { action, workspaceId, taskId, taskData, query } = toolInput;
        
        if (action === 'SEARCH_TASKS' && workspaceId) {
            const res = await axios.get(`https://app.asana.com/api/1.0/workspaces/${encodeURIComponent(workspaceId)}/tasks/search?text=${encodeURIComponent(query || '')}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", tasks: res.data.data };
        } else if (action === 'GET_TASK' && taskId) {
            const res = await axios.get(`https://app.asana.com/api/1.0/tasks/${encodeURIComponent(taskId)}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", task: res.data.data };
        } else if (action === 'CREATE_TASK') {
            const payload = safeJsonObject(taskData);
            const res = await axios.post(`https://app.asana.com/api/1.0/tasks`, { data: payload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", task: res.data.data };
        } else if (action === 'UPDATE_TASK' && taskId) {
            const payload = safeJsonObject(taskData);
            const res = await axios.put(`https://app.asana.com/api/1.0/tasks/${encodeURIComponent(taskId)}`, { data: payload }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", task: res.data.data };
        }

        return { error: `Missing required parameters or unsupported Asana action: ${action}` };
    } catch (err: any) { 
        return { error: `Asana Error: ${err.response?.data?.errors?.[0]?.message || err.message}` }; 
    }
};


export const executeGoogleWorkspace = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const GOOGLE_TOKEN = ephemeralSecrets.googleAccessToken;
    if (!GOOGLE_TOKEN) {
        return { error: "Missing Google OAuth Token. Call 'request_secure_credentials' with serviceName 'google'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${GOOGLE_TOKEN}`, 'Content-Type': 'application/json' };
        const { 
            action, query, documentId, payload, title, 
            startTime, endTime, calendarId, attendees, summary, description 
        } = toolInput;
        
        if (action === 'READ_GMAIL') {
            const res = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query || '')}&maxResults=10`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", messageMetadata: res.data.messages };
        } 
        else if (action === 'SEND_GMAIL') {
            const emailData = safeJsonObject(payload);
            if (!emailData.to || !emailData.subject) {
                return { error: "Missing required 'to' or 'subject' fields in payload." };
            }

            const emailLines = [
                `To: ${emailData.to}`,
                'Content-type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${emailData.subject}`,
                '',
                emailData.body || ""
            ];
            const raw = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const res = await axios.post(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, { raw }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", sent: res.data };
        } 
        
        else if (action === 'SEARCH_DRIVE') {
            const driveQuery = encodeURIComponent(query || "trashed=false");
            const fields = encodeURIComponent("files(id, name, mimeType, modifiedTime)");
            const res = await axios.get(`https://www.googleapis.com/drive/v3/files?q=${driveQuery}&fields=${fields}&pageSize=15`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", files: res.data.files };
        }

        else if (action === 'READ_DOC' && documentId) {
            const res = await axios.get(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, { headers, timeout: TIMEOUT_MS });
            const plainText = extractGoogleDocText(res.data.body?.content);
            return { status: "Success", documentTitle: res.data.title, documentContent: plainText };
        } 
        else if (action === 'CREATE_DOC' && title) {
            const res = await axios.post(`https://docs.googleapis.com/v1/documents`, { title: title }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", documentId: res.data.documentId, documentUrl: `https://docs.google.com/document/d/${res.data.documentId}/edit` };
        }

        else if (action === 'READ_SHEET' && documentId) {
            const res = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(documentId)}?includeGridData=true`, { headers, timeout: TIMEOUT_MS });
            const simplifiedSheets = simplifyGoogleSheetData(res.data.sheets || []);
            return { status: "Success", sheets: simplifiedSheets };
        }

        else if (action === 'READ_SLIDES' && documentId) {
            const res = await axios.get(`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(documentId)}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", presentationTitle: res.data.title, totalSlides: res.data.slides?.length };
        }

        else if (action === 'LIST_CALENDAR_EVENTS') {
            const targetCal = calendarId || 'primary';
            const timeMinParam = startTime ? `&timeMin=${encodeURIComponent(startTime)}` : '';
            const timeMaxParam = endTime ? `&timeMax=${encodeURIComponent(endTime)}` : '';
            const qParam = query ? `&q=${encodeURIComponent(query)}` : '';
            const res = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCal)}/events?singleEvents=true&orderBy=startTime${timeMinParam}${timeMaxParam}${qParam}&maxResults=15`, { headers, timeout: TIMEOUT_MS });
            
            const trimmedEvents = res.data.items?.map((ev: any) => ({
                id: ev.id,
                summary: ev.summary,
                start: ev.start,
                end: ev.end,
                status: ev.status,
                creator: ev.creator?.email
            })) || [];

            return { status: "Success", events: trimmedEvents };
        }
        else if (action === 'CREATE_CALENDAR_EVENT') {
            const targetCal = calendarId || 'primary';
            const eventPayload = safeJsonObject(payload);
            
            const parsedAttendees = attendees 
                ? (typeof attendees === 'string' ? safeJsonObject(attendees, []) : attendees) 
                : eventPayload.attendees;

            const body = {
                summary: summary || eventPayload.summary || "New Meeting",
                description: description || eventPayload.description || "",
                start: { dateTime: startTime || eventPayload.startTime },
                end: { dateTime: endTime || eventPayload.endTime },
                attendees: Array.isArray(parsedAttendees) 
                    ? parsedAttendees.map((a: any) => typeof a === 'string' ? { email: a } : a) 
                    : undefined
            };

            const res = await axios.post(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCal)}/events`, body, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", eventId: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary };
        }
        else if (action === 'GET_FREE_BUSY') {
            const body = {
                timeMin: startTime || new Date().toISOString(),
                timeMax: endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                items: [{ id: calendarId || 'primary' }]
            };
            const res = await axios.post(`https://www.googleapis.com/calendar/v3/freeBusy`, body, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", calendars: res.data.calendars };
        }

        return { error: `Missing required parameters or unsupported Google Workspace action: ${action}` };
    } catch (err: any) { 
        return { error: `Google Workspace Error: ${err.response?.data?.error?.message || err.message}` }; 
    }
};


export const executeSlack = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SLACK_TOKEN = ephemeralSecrets.slackToken;
    if (!SLACK_TOKEN) {
        return { error: "Missing Slack credentials. Call 'request_secure_credentials' with serviceName 'slack'." };
    }

    try {
        const headers = { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' };
        
        const { action, channelId, message, cursor, oldest, latest, limit } = toolInput;
        
        if (action === 'READ_CHANNEL_HISTORY' && channelId) {
            const safeLimit = Math.min(parseInt(limit) || 50, 100);
            
            let queryUrl = `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channelId)}&limit=${safeLimit}`;
            if (cursor) queryUrl += `&cursor=${encodeURIComponent(cursor)}`;
            if (oldest) queryUrl += `&oldest=${encodeURIComponent(oldest)}`;
            if (latest) queryUrl += `&latest=${encodeURIComponent(latest)}`;

            const res = await axios.get(queryUrl, { headers, timeout: TIMEOUT_MS });
            
            if (!res.data.ok) {
                return { error: `Slack API rejected request: ${res.data.error}` };
            }
            
            const simplifiedMessages = res.data.messages?.map((m: any) => ({
                user: m.user,
                text: m.text,
                ts: m.ts,
                thread_ts: m.thread_ts || undefined,
                reactions_count: m.reactions ? m.reactions.reduce((acc: number, r: any) => acc + r.count, 0) : 0
            })) || [];

            return { 
                status: "Success", 
                messageCount: simplifiedMessages.length,
                hasMore: res.data.has_more,
                nextCursor: res.data.response_metadata?.next_cursor || null, 
                messages: simplifiedMessages 
            };
            
        } else if (action === 'POST_MESSAGE' && channelId && message) {
            const res = await axios.post(`https://slack.com/api/chat.postMessage`, { channel: channelId, text: message }, { headers, timeout: TIMEOUT_MS });
            if (!res.data.ok) return { error: `Slack API rejected request: ${res.data.error}` };
            
            return { status: "Success", ts: res.data.ts };
        }

        return { error: `Missing required parameters or unsupported Slack action: ${action}` };
    } catch (err: any) { 
        return { error: `Slack Error: ${err.response?.data?.error || err.message}` }; 
    }
};


export const executeContentful = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const CF_TOKEN = ephemeralSecrets.contentfulToken;
    const CF_SPACE = ephemeralSecrets.contentfulSpaceId;
    const CF_ENV = ephemeralSecrets.contentfulEnvironment || 'master';
    
    if (!CF_TOKEN || !CF_SPACE) {
        return { error: "Missing Contentful credentials. Call 'request_secure_credentials' with serviceName 'contentful'." };
    }

    try {
        const headers = { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, contentType, entryId, entryData } = toolInput;
        const baseUrl = `https://api.contentful.com/spaces/${encodeURIComponent(CF_SPACE)}/environments/${encodeURIComponent(CF_ENV)}/entries`;

        if (action === 'GET_ENTRIES') {
            const res = await axios.get(`${baseUrl}?content_type=${encodeURIComponent(contentType || '')}&limit=10`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", entries: res.data.items };
        } else if (action === 'GET_ENTRY' && entryId) {
            const res = await axios.get(`${baseUrl}/${encodeURIComponent(entryId)}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", entry: res.data };
        } else if (action === 'CREATE_ENTRY' || action === 'UPDATE_ENTRY') {
            const putHeaders = { ...headers, 'X-Contentful-Content-Type': contentType };
            const payload = safeJsonObject(entryData);
            const res = action === 'CREATE_ENTRY'
                ? await axios.post(baseUrl, payload, { headers: putHeaders, timeout: TIMEOUT_MS })
                : await axios.put(`${baseUrl}/${encodeURIComponent(entryId!)}`, payload, { headers: putHeaders, timeout: TIMEOUT_MS });
            return { status: "Success", entry: res.data };
        }

        return { error: `Missing required parameters or unsupported Contentful action: ${action}` };
    } catch (err: any) { 
        return { error: `Contentful Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeSanityIO = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SANITY_TOKEN = ephemeralSecrets.sanityToken;
    const SANITY_PROJECT = ephemeralSecrets.sanityProjectId;
    const SANITY_DATASET = ephemeralSecrets.sanityDataset || 'production';

    if (!SANITY_TOKEN || !SANITY_PROJECT) {
        return { error: "Missing Sanity credentials. Call 'request_secure_credentials' with serviceName 'sanity'." };
    }

    try {
        const headers = { Authorization: `Bearer ${SANITY_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, groqQuery, mutations } = toolInput;

        if (action === 'QUERY_DOCUMENTS') {
            const res = await axios.get(`https://${encodeURIComponent(SANITY_PROJECT)}.api.sanity.io/v2022-03-07/data/query/${encodeURIComponent(SANITY_DATASET)}?query=${encodeURIComponent(groqQuery || '')}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", results: res.data.result };
        } else if (action === 'MUTATE_DOCUMENT') {
            const parsedMutations = safeJsonObject(mutations, []);
            if (!Array.isArray(parsedMutations)) {
                return { error: "Sanity mutations must be an array of objects." };
            }
            const res = await axios.post(`https://${encodeURIComponent(SANITY_PROJECT)}.api.sanity.io/v2022-03-07/data/mutate/${encodeURIComponent(SANITY_DATASET)}`, { mutations: parsedMutations }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", results: res.data };
        }

        return { error: `Missing required parameters or unsupported Sanity action: ${action}` };
    } catch (err: any) { 
        return { error: `Sanity Error: ${err.response?.data?.message || err.message}` }; 
    }
};