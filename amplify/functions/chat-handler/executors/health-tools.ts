import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 15000;
const MAX_RESULTS = 20;

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

const slimFhirBundle = (bundle: any, maxItems = MAX_RESULTS) => {
    if (!bundle?.entry || !Array.isArray(bundle.entry)) return [];
    
    return bundle.entry.slice(0, maxItems).map((e: any) => {
        const res = e.resource || {};
        delete res.text;
        delete res.meta;
        return res;
    });
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

        if (action === 'SEARCH_PATIENTS') {
            const queryParams = new URLSearchParams(query || '');
            queryParams.set('_count', MAX_RESULTS.toString());
            
            const res = await axios.get(`${EPIC_BASE_URL}/Patient`, { 
                params: queryParams, 
                headers, 
                timeout: TIMEOUT_MS 
            });
            return { status: "Success", patients: slimFhirBundle(res.data) };
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
            
            const res = await axios.get(`${EPIC_BASE_URL}${endpoint}`, { 
                params: { _count: MAX_RESULTS },
                headers, 
                timeout: TIMEOUT_MS 
            });
            
            return { status: "Success", dataType, clinicalData: slimFhirBundle(res.data) };
        }
        else if (action === 'MANAGE_APPOINTMENT' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${EPIC_BASE_URL}/Appointment`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", appointmentStatus: res.data };
        }
        else if (action === 'SUBMIT_PRIOR_AUTH' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${EPIC_BASE_URL}/Claim/$submit`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", authResponse: res.data };
        }

        return { error: `Missing required parameters or unsupported Epic action: ${action}` };
    } catch (err: any) {
        const safeError = formatAxiosError(err);
        console.error(`[executeEpicSystems] Error: ${safeError}`);
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
        const headers = {
            'Authorization': `Bearer ${ATHENA_ACCESS_TOKEN}`,
            'Accept': 'application/json'
        };

        if (action === 'GET_PRACTICE_INFO') {
            const res = await axios.get(`${baseUrl}/departments`, { 
                params: { limit: MAX_RESULTS },
                headers, 
                timeout: TIMEOUT_MS 
            });
            return { status: "Success", practiceData: res.data?.departments || [] };
        }
        else if (action === 'SEARCH_PATIENTS') {
            const parsedPayload = safeJsonObject(payload);
            const searchParams = { ...parsedPayload, limit: parsedPayload.limit || MAX_RESULTS };
            
            const res = await axios.get(`${baseUrl}/patients`, { params: searchParams, headers, timeout: TIMEOUT_MS });
            return { status: "Success", patients: res.data?.patients || [] };
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
                    problems: problems.data?.problems || [], 
                    medications: meds.data?.medications || [], 
                    allergies: allergies.data?.allergies || [] 
                }
            };
        }
        else if (action === 'MANAGE_APPOINTMENT') {
            const parsedPayload = safeJsonObject(payload);
            if (appointmentId && parsedPayload.cancelReason) {
                const res = await axios.put(`${baseUrl}/appointments/${appointmentId}/cancel`, parsedPayload, { headers, timeout: TIMEOUT_MS });
                return { status: "Success", cancellation: res.data };
            } else if (patientId && departmentId) {
                const res = await axios.post(`${baseUrl}/appointments/${appointmentId || 'book'}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
                return { status: "Success", booking: res.data };
            }
            return { error: "Missing appointmentId or booking parameters for MANAGE_APPOINTMENT." };
        }
        else if (action === 'TRIGGER_CDS_HOOK' && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${baseUrl}/cdshooks/cds-services`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", cdsResponse: res.data };
        }

        return { error: `Missing required parameters or unsupported Athenahealth action: ${action}` };
    } catch (err: any) {
        const safeError = formatAxiosError(err);
        console.error(`[executeAthenahealth] Error: ${safeError}`);
        return { error: `Athenahealth API Error: ${safeError}` };
    }
};