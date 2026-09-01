import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_RECORD_LIMIT = 50; 


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

export const executeRippling = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const RIPPLING_API_KEY = ephemeralSecrets.ripplingApiKey;
    if (!RIPPLING_API_KEY) {
        return { error: "Missing Rippling API Key. You MUST call 'request_secure_credentials' with serviceName 'rippling' to proceed." };
    }

    try {
        const headers = { 
            Authorization: `Bearer ${RIPPLING_API_KEY}`, 
            Accept: 'application/json', 
            'Content-Type': 'application/json' 
        };
        const { action, employeeId, employeeData } = toolInput;
        
        const parsedData = safeJsonObject(employeeData);
        const safeEmployeeId = employeeId ? encodeURIComponent(employeeId) : '';

        if (action === 'GET_EMPLOYEE' && safeEmployeeId) {
            const res = await axios.get(`https://api.rippling.com/platform/api/employees/${safeEmployeeId}`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", data: res.data };
        } 
        else if (action === 'ONBOARD_EMPLOYEE') {
            const res = await axios.post(`https://api.rippling.com/platform/api/employees`, parsedData, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", data: res.data };
        } 
        else if (action === 'UPDATE_EMPLOYEE' && safeEmployeeId) {
            const res = await axios.put(`https://api.rippling.com/platform/api/employees/${safeEmployeeId}`, parsedData, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", data: res.data };
        }
        else if (action === 'TERMINATE_EMPLOYEE' && safeEmployeeId) {
            const res = await axios.post(`https://api.rippling.com/platform/api/employees/${safeEmployeeId}/terminate`, parsedData, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: "Termination workflow initiated.", data: res.data };
        }

        return { error: `Missing parameters or unsupported Rippling action: ${action}` };
    } catch (err: any) { 
        return { error: `Rippling Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeBambooHR = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const BAMBOO_API_KEY = ephemeralSecrets.bambooApiKey;
    const BAMBOO_SUBDOMAIN = ephemeralSecrets.bambooSubdomain;
    
    if (!BAMBOO_API_KEY || !BAMBOO_SUBDOMAIN) {
        return { error: "Missing BambooHR credentials. You MUST call 'request_secure_credentials' with serviceName 'bamboohr'." };
    } 

    try {
        const authHeader = `Basic ${Buffer.from(`${BAMBOO_API_KEY}:x`).toString('base64')}`;
        const headers = { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' };
        const { action, startDate, endDate, searchName, requestId, status } = toolInput;
        
        const cleanSubdomain = encodeURIComponent(BAMBOO_SUBDOMAIN.replace(/[^a-zA-Z0-9-]/g, ''));
        const baseUrl = `https://api.bamboohr.com/api/gateway.php/${cleanSubdomain}/v1`;

        if (action === 'GET_DIRECTORY') {
            const res = await axios.get(`${baseUrl}/employees/directory`, { headers, timeout: TIMEOUT_MS });
            const rawEmployees = Array.isArray(res.data?.employees) ? res.data.employees : [];
            
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

            const truncated = employees.length > MAX_RECORD_LIMIT;
            const finalDirectory = employees.slice(0, MAX_RECORD_LIMIT);
            
            return { 
                status: "Success", 
                resultsFound: employees.length, 
                returnedCount: finalDirectory.length,
                truncated,
                directory: finalDirectory 
            };
        } 
        else if (action === 'GET_TIME_OFF') {
            const start = startDate || new Date().toISOString().split('T')[0];
            const end = endDate || start; 
            
            const res = await axios.get(`${baseUrl}/time_off/requests?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { headers, timeout: TIMEOUT_MS });
            const rawRequests = Array.isArray(res.data) ? res.data : [];
            
            const requests = rawRequests.slice(0, MAX_RECORD_LIMIT);

            return { 
                status: "Success", 
                totalFound: rawRequests.length, 
                returnedCount: requests.length, 
                requests 
            };
        }
        else if (action === 'APPROVE_TIME_OFF' && requestId && status) {
            const safeRequestId = encodeURIComponent(requestId);
            const res = await axios.put(`${baseUrl}/time_off/requests/${safeRequestId}/status`, { status }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Time off request ${requestId} marked as ${status}.` };
        }

        return { error: `Missing parameters or unsupported BambooHR action: ${action}` };
    } catch (err: any) { 
        return { error: `BambooHR Error: ${err.response?.data?.message || err.message}` }; 
    }
};