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

export const executeUiPathOrchestrator = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const UI_URL = ephemeralSecrets.uipathOrchestratorUrl;
    const UI_ORG = ephemeralSecrets.uipathOrganizationName;
    const UI_TENANT = ephemeralSecrets.uipathTenantName;
    const UI_TOKEN = ephemeralSecrets.uipathAccessToken;
    const UI_FOLDER = ephemeralSecrets.uipathFolderId || '1'; // Default folder ID
    
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
        const baseUrl = `${UI_URL.replace(/\/$/, "")}/${UI_ORG}/${UI_TENANT}/orchestrator_/odata`;

        if (action === 'GET_RELEASES') {
            const res = await axios.get(`${baseUrl}/Releases?$top=50`, { headers });
            const releases = res.data.value?.map((r: any) => ({ Key: r.Key, Name: r.Name, Description: r.Description, ProcessKey: r.ProcessKey }));
            return { status: "Success", releases };
        } 
        else if (action === 'GET_JOBS') {
            const res = await axios.get(`${baseUrl}/Jobs?$top=20&$orderby=CreationTime desc`, { headers });
            const jobs = res.data.value?.map((j: any) => ({ Id: j.Id, Key: j.Key, ReleaseName: j.ReleaseName, State: j.State, StartTime: j.StartTime, EndTime: j.EndTime }));
            return { status: "Success", jobs };
        } 
        else if (action === 'GET_JOB_LOGS' && jobId) {
            const res = await axios.get(`${baseUrl}/RobotLogs?$filter=JobId eq ${jobId}&$top=50&$orderby=TimeStamp desc`, { headers });
            const logs = res.data.value?.map((l: any) => ({ Level: l.Level, Message: l.Message, TimeStamp: l.TimeStamp }));
            return { status: "Success", logs };
        }
        else if (action === 'START_JOB' && releaseKey) {
            const parsedArgs = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
            const body = { 
                startInfo: { 
                    ReleaseKey: releaseKey, 
                    Strategy: "JobsCount", 
                    JobsCount: 1, 
                    InputArguments: parsedArgs 
                } 
            };
            const res = await axios.post(`${baseUrl}/Jobs/UiPath.Server.Configuration.OData.StartJobs`, body, { headers });
            return { status: "Success", jobsStarted: res.data.value };
        } 
        else if (action === 'STOP_JOB' && jobId) {
            await axios.post(`${baseUrl}/Jobs(${jobId})/UiPath.Server.Configuration.OData.StopJob`, { strategy: "Kill" }, { headers });
            return { status: "Success", message: `Job ${jobId} termination requested.` };
        } 
        else if (action === 'GET_QUEUE_ITEMS' && queueName) {
            let filter = `QueueName eq '${queueName}'`;
            if (statusFilter) {
                filter += ` and Status eq '${statusFilter}'`; // e.g., 'Failed', 'New', 'Successful'
            }
            const res = await axios.get(`${baseUrl}/QueueItems?$filter=${encodeURIComponent(filter)}&$top=20&$orderby=CreationTime desc`, { headers });
            const items = res.data.value?.map((q: any) => ({ Id: q.Id, Status: q.Status, Reference: q.Reference, SpecificContent: q.SpecificContent, ProcessingException: q.ProcessingException }));
            return { status: "Success", items };
        } 
        else if (action === 'ADD_QUEUE_ITEM' && queueName) {
            const parsedContent = safeJsonParse(payload);
            const body = { itemData: { Name: queueName, SpecificContent: parsedContent } };
            const res = await axios.post(`${baseUrl}/Queues/UiPathODataSvc.AddQueueItem`, body, { headers });
            
            return { status: "Success", itemId: res.data?.Id, itemStatus: res.data?.Status };
        }

        return { error: `Missing required parameters or unsupported UiPath action: ${action}` };
    } catch (err: any) { 
        return { error: `UiPath Orchestrator Error: ${err.response?.data?.message || err.message}` }; 
    }
};