import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 10000; 
const MAX_FLEET_DEVICES = 50; 

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

const projectRecord = (record: Record<string, any>): Record<string, any> => {
    if (!record || typeof record !== 'object') return record;
    const projected: Record<string, any> = {};
    const IGNORED_KEYS = new Set(['attributes', 'meta', '_links', 'href']);

    for (const [key, value] of Object.entries(record)) {
        if (IGNORED_KEYS.has(key) || value === null || value === undefined || value === '') continue;
        if (typeof value === 'object' && !Array.isArray(value)) {
            projected[key] = value.name || value.title || value.id || '[Object]';
        } else if (Array.isArray(value)) {
            projected[key] = `[Array (${value.length} items)]`;
        } else {
            projected[key] = value;
        }
    }
    return projected;
};

const slimAndProjectRecords = (records: any[], max = MAX_FLEET_DEVICES) => {
    if (!Array.isArray(records)) return [];
    return records.slice(0, max).map(r => (typeof r === 'object' && r !== null ? projectRecord(r) : r));
};

export const executeArduinoCloud = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ARDUINO_CLIENT_ID = ephemeralSecrets.arduinoClientId;
    const ARDUINO_SECRET = ephemeralSecrets.arduinoClientSecret;
    
    if (!ARDUINO_CLIENT_ID || !ARDUINO_SECRET) {
        return { error: "Missing Arduino IoT credentials. Call 'request_secure_credentials' with serviceName 'arduino'." };
    } 

    try {
        const tokenRes = await axios.post('https://api2.arduino.cc/iot/v1/clients/token', 
            new URLSearchParams({ grant_type: "client_credentials", client_id: ARDUINO_CLIENT_ID, client_secret: ARDUINO_SECRET, audience: "https://api2.arduino.cc/iot" }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: TIMEOUT_MS }
        );
        
        const headers = { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' };
        const { action, thingId, propertyId, payload } = toolInput;
        const baseUrl = 'https://api2.arduino.cc/iot/v2/things';
        const baseCost = { action: `ARDUINO_${action}`, creditsToDeduct: 5 };

        if (action === 'GET_THINGS') {
            const res = await axios.get(baseUrl, { headers, timeout: TIMEOUT_MS });
            const cleanThings = slimAndProjectRecords(Array.isArray(res.data) ? res.data : [], MAX_FLEET_DEVICES);
            return { status: "Success", count: cleanThings.length, things: cleanThings, billingMetrics: baseCost };
        } 
        else if (action === 'GET_PROPERTIES' && thingId) {
            const res = await axios.get(`${baseUrl}/${thingId}/properties`, { headers, timeout: TIMEOUT_MS });
            const cleanProps = slimAndProjectRecords(Array.isArray(res.data) ? res.data : [], MAX_FLEET_DEVICES);
            return { status: "Success", count: cleanProps.length, properties: cleanProps, billingMetrics: baseCost };
        } 
        else if (action === 'UPDATE_PROPERTY' && thingId && propertyId && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.put(`${baseUrl}/${thingId}/properties/${propertyId}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", property: projectRecord(res.data), billingMetrics: { action: "ARDUINO_UPDATE_PROPERTY", creditsToDeduct: 10 } };
        } 
        else if (action === 'CREATE_PROPERTY' && thingId && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${baseUrl}/${thingId}/properties`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", property: projectRecord(res.data), billingMetrics: { action: "ARDUINO_CREATE_PROPERTY", creditsToDeduct: 10 } };
        }

        return { error: `Missing required parameters or unsupported Arduino action: ${action}` };
    } catch (err: any) { 
        return { error: `Arduino IoT Error: ${err.response?.data?.message || err.response?.data?.detail || err.message}` }; 
    }
};

export const executeRaspberryPiFleet = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const FLEET_TOKEN = ephemeralSecrets.balenaToken || ephemeralSecrets.raspberryPiToken;
    
    if (!FLEET_TOKEN) {
        return { error: "Missing Fleet Management token. Call 'request_secure_credentials' with serviceName 'balena'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${FLEET_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, deviceUuid, envVars } = toolInput;
        const baseUrl = `https://api.balena-cloud.com/v6`;
        const baseCost = { action: `BALENA_${action}`, creditsToDeduct: 5 };

        if (action === 'GET_FLEET_STATUS') {
            const res = await axios.get(`${baseUrl}/device?$select=id,uuid,device_name,status,is_online,os_version,overall_status`, { headers, timeout: TIMEOUT_MS });
            const devicesArray = Array.isArray(res.data?.d) ? res.data.d : [];
            const cleanDevices = slimAndProjectRecords(devicesArray, MAX_FLEET_DEVICES);

            return { 
                status: "Success", 
                totalDevices: devicesArray.length, 
                returnedCount: cleanDevices.length,
                truncated: devicesArray.length > MAX_FLEET_DEVICES,
                devices: cleanDevices,
                billingMetrics: baseCost
            };
        } 
        else if (action === 'GET_DEVICE_LOGS' && deviceUuid) {
            const res = await axios.get(`https://api.balena-cloud.com/device/v2/${deviceUuid}/logs?count=50`, { headers, timeout: TIMEOUT_MS });
            const rawLogs = res.data;
            const cleanLogs = Array.isArray(rawLogs) 
                ? rawLogs.slice(-50).map(l => typeof l === 'object' ? `${l.timestamp || ''} ${l.message || JSON.stringify(l)}` : String(l))
                : String(rawLogs).split('\n').slice(-50).join('\n');

            return { status: "Success", logs: cleanLogs, billingMetrics: baseCost };
        } 
        else if (action === 'REBOOT_DEVICE' && deviceUuid) {
            await axios.post(`https://api.balena-cloud.com/supervisor/v1/reboot`, { uuid: deviceUuid }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Reboot command sent to device ${deviceUuid}`, billingMetrics: { action: "BALENA_REBOOT", creditsToDeduct: 15 } };
        }
        else if (action === 'SET_DEVICE_ENV_VAR' && deviceUuid && envVars) {
            const parsedVars = safeJsonObject(envVars);
            
            if (!parsedVars.name || parsedVars.value === undefined) {
                return { error: "Invalid envVars payload. Must be a JSON object containing 'name' and 'value'." };
            }

            const res = await axios.post(`${baseUrl}/device_environment_variable`, { 
                device: deviceUuid, 
                name: parsedVars.name, 
                value: parsedVars.value 
            }, { headers, timeout: TIMEOUT_MS });
            
            return { status: "Success", variable: projectRecord(res.data), billingMetrics: { action: "BALENA_SET_ENV_VAR", creditsToDeduct: 10 } };
        }

        return { error: `Missing required parameters for Edge Fleet action: ${action}` };
    } catch (err: any) { 
        return { error: `Raspberry Pi Fleet Error: ${err.response?.data?.message || err.message}` }; 
    }
};