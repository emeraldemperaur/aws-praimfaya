import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ToolExecutionContext } from "./types";

const TIMEOUT_MS = 10000; 
const MAX_RECORD_LIMIT = 50; 

function getMediaBucketName(env: Record<string, string>): string {
    return env.MEDIA_OUTPUT_BUCKET_NAME || env.MEDIA_OUTPUT_BUCKET || "praimfaya-media-outputs";
}

async function recordRAGArtifact(
    profile: any,
    session: { userId: string; id: string; title?: string },
    fileUrl: string,
    fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
    dynamodb: any,
    ragArtifactsTable?: string
) {
    if (!ragArtifactsTable || !dynamodb) return;
    const fileName = fileUrl.split('/').pop() || 'hr_report.json';
    
    try {
        await dynamodb.send(new PutCommand({
            TableName: ragArtifactsTable,
            Item: {
                id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: session.userId,
                terminalId: session.id,
                terminalTitle: session.title || profile?.name || 'Terminal Session',
                modelName: profile?.llmModelId || 'amazon.nova-pro-v1:0',
                contextProfileName: profile?.name || 'Vanguard AI',
                fileUrl: fileUrl,
                fileName: fileName,
                fileType: fileType,
                createdAt: new Date().toISOString()
            }
        }));
    } catch (err) {
        console.error("[HR Vanguard] Failed to record RAG artifact telemetry:", err);
    }
}

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


export const executeRippling = async ({ 
    toolInput, 
    citations, 
    clients, 
    profile, 
    cognitoUserId, 
    sessionId, 
    env, 
    ephemeralSecrets 
}: ToolExecutionContext) => {
    const secrets = ephemeralSecrets || (toolInput as any).ephemeralSecrets || {};
    const RIPPLING_API_KEY = secrets.ripplingApiKey;
    
    if (!RIPPLING_API_KEY) {
        return { 
            error: "Missing Rippling API Key. You MUST call 'request_secure_credentials' with serviceName 'rippling' to proceed.",
            additionalCreditsUsed: -10 
        };
    }

    try {
        const headers = { 
            'Authorization': `Bearer ${RIPPLING_API_KEY}`, 
            'Accept': 'application/json', 
            'Content-Type': 'application/json' 
        };
        
        const { action, employeeId, employeeData } = toolInput;
        const parsedData = safeJsonObject(employeeData);
        const safeEmployeeId = employeeId ? encodeURIComponent(employeeId) : '';

        let url = "";
        let method = "GET";
        let baseCost = 150;

        if (action === 'GET_EMPLOYEE' && safeEmployeeId) {
            url = `https://api.rippling.com/platform/api/employees/${safeEmployeeId}`;
        } else if (action === 'ONBOARD_EMPLOYEE') {
            url = `https://api.rippling.com/platform/api/employees`;
            method = "POST";
            baseCost = 400;
        } else if (action === 'UPDATE_EMPLOYEE' && safeEmployeeId) {
            url = `https://api.rippling.com/platform/api/employees/${safeEmployeeId}`;
            method = "PUT";
            baseCost = 300;
        } else if (action === 'TERMINATE_EMPLOYEE' && safeEmployeeId) {
            url = `https://api.rippling.com/platform/api/employees/${safeEmployeeId}/terminate`;
            method = "POST";
            baseCost = 500;
        } else {
            return { error: `Missing parameters or unsupported Rippling action: ${action}`, additionalCreditsUsed: -10 };
        }

        const fetchOptions: RequestInit = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) };
        if (method !== "GET") fetchOptions.body = JSON.stringify(parsedData);

        const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error(`Rippling HTTP ${response.status}: ${await response.text()}`);
        
        const data = await response.json();

        // Telemetry Logging for reads to avoid context bloat
        if (action === 'GET_EMPLOYEE') {
            const bucketName = getMediaBucketName(env);
            const fileName = `hr-reports/rippling-${safeEmployeeId}-${Date.now()}.json`;
            
            await clients.s3.send(new PutObjectCommand({
                Bucket: bucketName, Key: fileName,
                Body: JSON.stringify(data, null, 2), ContentType: "application/json"
            }));

            const fileUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
            await recordRAGArtifact(profile, { userId: cognitoUserId, id: sessionId }, fileUrl, 'DOCUMENT', clients.dynamodb, env.RAG_ARTIFACTS_TABLE_NAME);
            citations.push({ type: 'asset', uri: fileUrl });

            return { status: "Success", data, reportUrl: fileUrl, additionalCreditsUsed: -baseCost };
        }

        return { status: "Success", action, data, additionalCreditsUsed: -baseCost };

    } catch (err: any) { 
        console.error("[Rippling Vanguard Error]:", err);
        return { error: `Rippling Error: ${err.message}`, additionalCreditsUsed: -50 }; 
    }
};


export const executeBambooHR = async ({ 
    toolInput, 
    citations, 
    clients, 
    profile, 
    cognitoUserId, 
    sessionId, 
    env, 
    ephemeralSecrets 
}: ToolExecutionContext) => {
    const secrets = ephemeralSecrets || (toolInput as any).ephemeralSecrets || {};
    const BAMBOO_API_KEY = secrets.bambooApiKey;
    const BAMBOO_SUBDOMAIN = secrets.bambooSubdomain;
    
    if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
        return { 
            error: "Missing BambooHR credentials. You MUST call 'request_secure_credentials' with serviceName 'bamboohr'.",
            additionalCreditsUsed: -10 
        };
    } 

    try {
        const authHeader = `Basic ${Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64')}`;
        const headers = { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' };
        
        const { action, startDate, endDate, searchName, requestId, status } = toolInput;
        const cleanSubdomain = encodeURIComponent(BAMBOO_SUBDOMAIN.replace(/[^a-zA-Z0-9-]/g, ''));
        const baseUrl = `https://api.bamboohr.com/api/gateway.php/${cleanSubdomain}/v1`;

        if (action === 'GET_DIRECTORY') {
            const response = await fetch(`${baseUrl}/employees/directory`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!response.ok) throw new Error(`BambooHR HTTP ${response.status}`);
            
            const data = await response.json();
            const rawEmployees = Array.isArray(data?.employees) ? data.employees : [];
            
            let employees = rawEmployees.map((emp: any) => ({
                id: emp.id,
                displayName: emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
                jobTitle: emp.jobTitle || 'N/A',
                department: emp.department || 'N/A',
                workEmail: emp.workEmail || 'N/A'
            }));
            
            if (searchName) {
                const term = searchName.toLowerCase();
                employees = employees.filter((emp: any) => 
                    emp.displayName.toLowerCase().includes(term) ||
                    emp.workEmail.toLowerCase().includes(term) ||
                    emp.department.toLowerCase().includes(term) ||
                    emp.jobTitle.toLowerCase().includes(term)
                );
            }

            const finalDirectory = employees.slice(0, MAX_RECORD_LIMIT);
            const resultSummary = { 
                status: "Success", 
                resultsFound: employees.length, 
                returnedCount: finalDirectory.length,
                truncated: employees.length > MAX_RECORD_LIMIT,
                directory: finalDirectory 
            };

            // Telemetry & RAG
            const bucketName = getMediaBucketName(env);
            const fileName = `hr-reports/bamboo-dir-${Date.now()}.json`;
            await clients.s3.send(new PutObjectCommand({
                Bucket: bucketName, Key: fileName,
                Body: JSON.stringify(resultSummary, null, 2), ContentType: "application/json"
            }));

            const fileUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
            await recordRAGArtifact(profile, { userId: cognitoUserId, id: sessionId }, fileUrl, 'DOCUMENT', clients.dynamodb, env.RAG_ARTIFACTS_TABLE_NAME);
            citations.push({ type: 'asset', uri: fileUrl });

            return { ...resultSummary, reportUrl: fileUrl, additionalCreditsUsed: -150 };
        } 
        
        else if (action === 'GET_TIME_OFF') {
            const start = startDate || new Date().toISOString().split('T')[0];
            const end = endDate || start; 
            
            const response = await fetch(`${baseUrl}/time_off/requests?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!response.ok) throw new Error(`BambooHR HTTP ${response.status}`);
            
            const rawRequests = await response.json();
            const requests = (Array.isArray(rawRequests) ? rawRequests : []).slice(0, MAX_RECORD_LIMIT);

            return { 
                status: "Success", totalFound: rawRequests.length, returnedCount: requests.length, requests, additionalCreditsUsed: -100 
            };
        }
        
        else if (action === 'APPROVE_TIME_OFF' && requestId && status) {
            const safeRequestId = encodeURIComponent(requestId);
            const response = await fetch(`${baseUrl}/time_off/requests/${safeRequestId}/status`, { 
                method: "PUT", headers, body: JSON.stringify({ status }), signal: AbortSignal.timeout(TIMEOUT_MS) 
            });
            if (!response.ok) throw new Error(`BambooHR HTTP ${response.status}`);

            return { status: "Success", message: `Time off request ${requestId} marked as ${status}.`, additionalCreditsUsed: -250 };
        }

        return { error: `Missing parameters or unsupported BambooHR action: ${action}`, additionalCreditsUsed: -10 };

    } catch (err: any) { 
        console.error("[BambooHR Vanguard Error]:", err);
        return { error: `BambooHR Error: ${err.message}`, additionalCreditsUsed: -50 }; 
    }
};