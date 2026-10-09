import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 15000;
const MAX_RESULTS = 25;

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

const formatAxiosError = (err: any): string => {
    if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') return data.slice(0, 300);
        if (data.issue && Array.isArray(data.issue)) return data.issue[0]?.diagnostics || JSON.stringify(data.issue[0]);
        if (data.detailedmessage) return data.detailedmessage;
        if (data.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }
    return err.message || 'Unknown network error occurred while reaching Healthcare APIs.';
};

const projectRecord = (record: any, depth = 0): any => {
    if (depth > 2) return '[Max Depth]';
    if (!record || typeof record !== 'object') return record;
    if (Array.isArray(record)) return record.slice(0, MAX_RESULTS).map(r => projectRecord(r, depth + 1));

    const projected: Record<string, any> = {};
    const IGNORED_KEYS = new Set(['text', 'meta', 'extension', 'identifier', 'reference', 'fullUrl', '_links']);

    for (const [key, value] of Object.entries(record)) {
        if (IGNORED_KEYS.has(key) || value === null || value === undefined || value === '') continue;
        if (typeof value === 'object') projected[key] = projectRecord(value, depth + 1);
        else projected[key] = value;
    }
    return projected;
};

const slimFhirBundle = (bundle: any, maxItems = MAX_RESULTS) => {
    if (!bundle?.entry || !Array.isArray(bundle.entry)) return [];
    return bundle.entry.slice(0, maxItems).map((e: any) => projectRecord(e.resource || e));
};

export const executeEpicSystems = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const EPIC_BASE_URL = ephemeralSecrets.epicBaseUrl;
    const EPIC_ACCESS_TOKEN = ephemeralSecrets.epicAccessToken;

    if (!EPIC_BASE_URL || !EPIC_ACCESS_TOKEN) {
        return { error: "Missing Epic Systems credentials. Call 'request_secure_credentials' with serviceName 'epic'." };
    }

    try {
        const { action, patientId, dataType, query, payload } = toolInput;
        const headers = {
            'Authorization': `Bearer ${EPIC_ACCESS_TOKEN}`,
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
        };
        const baseCost = { action: `EPIC_${action}`, creditsToDeduct: 15 };

        if (action === 'SEARCH_PATIENTS') {
            const queryParams = new URLSearchParams(query || '');
            queryParams.set('_count', MAX_RESULTS.toString());
            
            const res = await axios.get(`${EPIC_BASE_URL}/Patient`, { params: queryParams, headers, timeout: TIMEOUT_MS });
            return { status: "Success", patients: slimFhirBundle(res.data), billingMetrics: baseCost };
        }
        else if (action === 'GET_CLINICAL_DATA' && patientId && dataType) {
            let endpoint = '';
            switch (dataType) {
                case 'ALLERGIES': endpoint = `/AllergyIntolerance?patient=${patientId}`; break;
                case 'CARE_PLANS': endpoint = `/CarePlan?patient=${patientId}&category=assess-plan`; break;
                case 'CLINICAL_NOTES': endpoint = `/DocumentReference?patient=${patientId}&category=clinical-note`; break;
                case 'CONDITIONS': endpoint = `/Condition?patient=${patientId}`; break;
                case 'MEDICATIONS': endpoint = `/MedicationRequest?patient=${patientId}`; break;
            }
            
            const res = await axios.get(`${EPIC_BASE_URL}${endpoint}`, { params: { _count: MAX_RESULTS }, headers, timeout: TIMEOUT_MS });
            return { status: "Success", dataType, clinicalData: slimFhirBundle(res.data), billingMetrics: baseCost };
        }
        else if (action === 'MANAGE_APPOINTMENT' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${EPIC_BASE_URL}/Appointment`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", appointmentStatus: projectRecord(res.data), billingMetrics: baseCost };
        }
        else if (action === 'SUBMIT_PRIOR_AUTH' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${EPIC_BASE_URL}/Claim/$submit`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", authResponse: projectRecord(res.data), billingMetrics: baseCost };
        }

        return { error: `Missing required parameters or unsupported Epic action: ${action}` };
    } catch (err: any) {
        const safeError = formatAxiosError(err);
        return { error: `Epic Systems API Error: ${safeError}` };
    }
};

export const executeAthenahealth = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ATHENA_PRACTICE_ID = ephemeralSecrets.athenaPracticeId;
    const ATHENA_ACCESS_TOKEN = ephemeralSecrets.athenaAccessToken;
    const ATHENA_ENV = ephemeralSecrets.athenaEnvironment || 'preview';

    if (!ATHENA_PRACTICE_ID || !ATHENA_ACCESS_TOKEN) {
        return { error: "Missing Athenahealth credentials. Call 'request_secure_credentials' with serviceName 'athenahealth'." };
    }

    const baseUrl = `https://${ATHENA_ENV}.athenahealth.com/v1/${ATHENA_PRACTICE_ID}`;

    try {
        const { action, patientId, appointmentId, departmentId, payload } = toolInput;
        const headers = { 'Authorization': `Bearer ${ATHENA_ACCESS_TOKEN}`, 'Accept': 'application/json' };
        const baseCost = { action: `ATHENA_${action}`, creditsToDeduct: 15 };

        if (action === 'GET_PRACTICE_INFO') {
            const res = await axios.get(`${baseUrl}/departments`, { params: { limit: MAX_RESULTS }, headers, timeout: TIMEOUT_MS });
            return { status: "Success", practiceData: projectRecord(res.data?.departments || []), billingMetrics: baseCost };
        }
        else if (action === 'SEARCH_PATIENTS') {
            const parsedPayload = safeJsonObject(payload);
            const searchParams = { ...parsedPayload, limit: parsedPayload.limit || MAX_RESULTS };
            
            const res = await axios.get(`${baseUrl}/patients`, { params: searchParams, headers, timeout: TIMEOUT_MS });
            return { status: "Success", patients: projectRecord(res.data?.patients || []), billingMetrics: baseCost };
        }
        else if (action === 'GET_PATIENT_CHART' && patientId) {
            const reqConfig = { headers, params: { limit: MAX_RESULTS }, timeout: TIMEOUT_MS };
            
            const [problems, meds, allergies] = await Promise.all([
                axios.get(`${baseUrl}/chart/${patientId}/problems`, reqConfig),
                axios.get(`${baseUrl}/chart/${patientId}/medications`, reqConfig),
                axios.get(`${baseUrl}/chart/${patientId}/allergies`, reqConfig)
            ]);
            
            return { 
                status: "Success", 
                chart: { 
                    problems: projectRecord(problems.data?.problems || []), 
                    medications: projectRecord(meds.data?.medications || []), 
                    allergies: projectRecord(allergies.data?.allergies || []) 
                },
                billingMetrics: { action: "ATHENA_GET_CHART", creditsToDeduct: 25 }
            };
        }
        else if (action === 'MANAGE_APPOINTMENT') {
            const parsedPayload = safeJsonObject(payload);
            if (appointmentId && parsedPayload.cancelReason) {
                const res = await axios.put(`${baseUrl}/appointments/${appointmentId}/cancel`, parsedPayload, { headers, timeout: TIMEOUT_MS });
                return { status: "Success", cancellation: res.data, billingMetrics: baseCost };
            } else if (patientId && departmentId) {
                const res = await axios.post(`${baseUrl}/appointments/${appointmentId || 'book'}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
                return { status: "Success", booking: res.data, billingMetrics: baseCost };
            }
            return { error: "Missing appointmentId or booking parameters for MANAGE_APPOINTMENT." };
        }
        else if (action === 'TRIGGER_CDS_HOOK' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${baseUrl}/cdshooks/cds-services`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", cdsResponse: projectRecord(res.data), billingMetrics: baseCost };
        }

        return { error: `Missing required parameters or unsupported Athenahealth action: ${action}` };
    } catch (err: any) {
        const safeError = formatAxiosError(err);
        return { error: `Athenahealth API Error: ${safeError}` };
    }
};