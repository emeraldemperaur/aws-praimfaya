import axios from 'axios';
import { ToolExecutionContext } from './types';


export const executeRippling = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const RIPPLING_API_KEY = ephemeralSecrets.ripplingApiKey;
    if (!RIPPLING_API_KEY) return { error: "Missing Rippling API Key. You MUST call 'request_secure_credentials' with serviceName 'rippling' to proceed." };

    try {
        const headers = { Authorization: `Bearer ${RIPPLING_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' };
        const { action, employeeId, employeeData } = toolInput;
        
        let parsedData = {};
        if (employeeData) {
            try { parsedData = typeof employeeData === 'string' ? JSON.parse(employeeData) : employeeData; } 
            catch (e) { return { error: "Failed to parse employeeData JSON payload. Ensure valid formatting." }; }
        }

        if (action === 'GET_EMPLOYEE' && employeeId) {
            const res = await axios.get(`https://api.rippling.com/platform/api/employees/${employeeId}`, { headers });
            return { status: "Success", data: res.data };
        } 
        else if (action === 'ONBOARD_EMPLOYEE') {
            const res = await axios.post(`https://api.rippling.com/platform/api/employees`, parsedData, { headers });
            return { status: "Success", data: res.data };
        } 
        else if (action === 'UPDATE_EMPLOYEE' && employeeId) {
            const res = await axios.put(`https://api.rippling.com/platform/api/employees/${employeeId}`, parsedData, { headers });
            return { status: "Success", data: res.data };
        }
        else if (action === 'TERMINATE_EMPLOYEE' && employeeId) {
            const res = await axios.post(`https://api.rippling.com/platform/api/employees/${employeeId}/terminate`, parsedData, { headers });
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
        const baseUrl = `https://api.bamboohr.com/api/gateway.php/${BAMBOO_SUBDOMAIN}/v1`;

        if (action === 'GET_DIRECTORY') {
            const res = await axios.get(`${baseUrl}/employees/directory`, { headers });
            let employees = res.data.employees || [];
            
            if (searchName) {
                const term = searchName.toLowerCase();
                employees = employees.filter((emp: any) => 
                    (emp.firstName && emp.firstName.toLowerCase().includes(term)) || 
                    (emp.lastName && emp.lastName.toLowerCase().includes(term)) ||
                    (emp.displayName && emp.displayName.toLowerCase().includes(term))
                );
                return { status: "Success", resultsFound: employees.length, directory: employees };
            }
            
            return { status: "Success", warning: "Truncated to 50 records. Use searchName for specific lookups.", directory: employees.slice(0, 50) };
        } 
        else if (action === 'GET_TIME_OFF') {
            const start = startDate || new Date().toISOString().split('T')[0];
            const end = endDate || start; 
            
            const res = await axios.get(`${baseUrl}/time_off/requests?start=${start}&end=${end}`, { headers });
            return { status: "Success", requests: res.data };
        }
        else if (action === 'APPROVE_TIME_OFF' && requestId && status) {
            const res = await axios.put(`${baseUrl}/time_off/requests/${requestId}/status`, { status: status }, { headers });
            return { status: "Success", message: `Time off request ${requestId} marked as ${status}.` };
        }

        return { error: `Missing parameters or unsupported BambooHR action: ${action}` };
    } catch (err: any) { 
        return { error: `BambooHR Error: ${err.response?.data?.message || err.message}` }; 
    }
};