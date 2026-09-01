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


const escapeODataString = (str: string): string => {
    return str.replace(/'/g, "''");
};

export const executeUiPathOrchestrator = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const UI_URL = ephemeralSecrets.uipathOrchestratorUrl;
    const UI_ORG = ephemeralSecrets.uipathOrganizationName;
    const UI_TENANT = ephemeralSecrets.uipathTenantName;
    const UI_TOKEN = ephemeralSecrets.uipathAccessToken;
    const UI_FOLDER = ephemeralSecrets.uipathFolderId || '1'; 
    
    if (!UI_URL || !UI_ORG || !UI_TENANT || !UI_TOKEN) {
        return { error: "Missing UiPath credentials. Call 'request_secure_credentials' with serviceName 'uipath'." };
    } 

    try {
        const headers = { 
            Authorization: `Bearer ${UI_TOKEN}`, 
            'Content-Type': 'application/json',
            'X-UIPATH-OrganizationUnitId': UI_FOLDER 
        };
        const { action, releaseKey, jobId, queueName, payload, statusFilter } = toolInput;
        
        const cleanUrl = UI_URL.replace(/\/$/, "");
        const cleanOrg = encodeURIComponent(UI_ORG);
        const cleanTenant = encodeURIComponent(UI_TENANT);
        const baseUrl = `${cleanUrl}/${cleanOrg}/${cleanTenant}/orchestrator_/odata`;

        if (action === 'GET_RELEASES') {
            const res = await axios.get(`${baseUrl}/Releases?$top=30`, { headers, timeout: TIMEOUT_MS });
            const rawReleases = Array.isArray(res.data?.value) ? res.data.value : [];
            const releases = rawReleases.map((r: any) => ({
                Key: r.Key,
                Name: r.Name,
                Description: r.Description ? r.Description.substring(0, 200) : '',
                ProcessKey: r.ProcessKey
            }));

            return { status: "Success", count: releases.length, releases };
        } 
        else if (action === 'GET_JOBS') {
            const res = await axios.get(`${baseUrl}/Jobs?$top=${MAX_RECORD_LIMIT}&$orderby=CreationTime desc`, { headers, timeout: TIMEOUT_MS });
            const rawJobs = Array.isArray(res.data?.value) ? res.data.value : [];
            const jobs = rawJobs.map((j: any) => ({
                Id: j.Id,
                Key: j.Key,
                ReleaseName: j.ReleaseName,
                State: j.State,
                StartTime: j.StartTime,
                EndTime: j.EndTime
            }));

            return { status: "Success", count: jobs.length, jobs };
        } 
        else if (action === 'GET_JOB_LOGS' && jobId) {
            const safeJobId = encodeURIComponent(jobId);
            const res = await axios.get(`${baseUrl}/RobotLogs?$filter=JobId eq ${safeJobId}&$top=${MAX_RECORD_LIMIT}&$orderby=TimeStamp desc`, { headers, timeout: TIMEOUT_MS });
            const rawLogs = Array.isArray(res.data?.value) ? res.data.value : [];
            const logs = rawLogs.map((l: any) => ({
                Level: l.Level,
                Message: l.Message ? l.Message.substring(0, 300) : '',
                TimeStamp: l.TimeStamp
            }));

            return { status: "Success", count: logs.length, logs };
        }
        else if (action === 'START_JOB' && releaseKey) {
            const parsedArgs = safeJsonObject(payload);
            const body = { 
                startInfo: { 
                    ReleaseKey: releaseKey, 
                    Strategy: "JobsCount", 
                    JobsCount: 1, 
                    InputArguments: JSON.stringify(parsedArgs) 
                } 
            };
            const res = await axios.post(`${baseUrl}/Jobs/UiPath.Server.Configuration.OData.StartJobs`, body, { headers, timeout: TIMEOUT_MS });
            const jobsStarted = Array.isArray(res.data?.value) ? res.data.value.map((j: any) => ({ Id: j.Id, Key: j.Key, State: j.State })) : res.data?.value;

            return { status: "Success", jobsStarted };
        } 
        else if (action === 'STOP_JOB' && jobId) {
            const safeJobId = encodeURIComponent(jobId);
            await axios.post(`${baseUrl}/Jobs(${safeJobId})/UiPath.Server.Configuration.OData.StopJob`, { strategy: "Kill" }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Job ${jobId} termination requested.` };
        } 
        else if (action === 'GET_QUEUE_ITEMS' && queueName) {
            const safeQueueName = escapeODataString(queueName);
            let filter = `QueueName eq '${safeQueueName}'`;
            
            if (statusFilter) {
                const safeStatus = escapeODataString(statusFilter);
                filter += ` and Status eq '${safeStatus}'`;
            }

            const res = await axios.get(`${baseUrl}/QueueItems?$filter=${encodeURIComponent(filter)}&$top=${MAX_RECORD_LIMIT}&$orderby=CreationTime desc`, { headers, timeout: TIMEOUT_MS });
            const rawItems = Array.isArray(res.data?.value) ? res.data.value : [];
            
            const items = rawItems.map((q: any) => ({
                Id: q.Id,
                Status: q.Status,
                Reference: q.Reference,
                SpecificContent: q.SpecificContent,
                ProcessingException: q.ProcessingException?.Reason ? q.ProcessingException.Reason.substring(0, 300) : undefined
            }));

            return { status: "Success", count: items.length, items };
        } 
        else if (action === 'ADD_QUEUE_ITEM' && queueName) {
            const parsedContent = safeJsonObject(payload);
            const body = { itemData: { Name: queueName, SpecificContent: parsedContent } };
            const res = await axios.post(`${baseUrl}/Queues/UiPathODataSvc.AddQueueItem`, body, { headers, timeout: TIMEOUT_MS });
            
            return { status: "Success", itemId: res.data?.Id, itemStatus: res.data?.Status };
        }

        return { error: `Missing required parameters or unsupported UiPath action: ${action}` };
    } catch (err: any) { 
        return { error: `UiPath Orchestrator Error: ${err.response?.data?.message || err.message}` }; 
    }
};