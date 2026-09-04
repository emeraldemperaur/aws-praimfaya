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

        if (action === 'GET_THINGS') {
            const res = await axios.get(baseUrl, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", things: res.data };
        } 
        else if (action === 'GET_PROPERTIES' && thingId) {
            const res = await axios.get(`${baseUrl}/${thingId}/properties`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", properties: res.data };
        } 
        else if (action === 'UPDATE_PROPERTY' && thingId && propertyId && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.put(`${baseUrl}/${thingId}/properties/${propertyId}`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", property: res.data };
        } 
        else if (action === 'CREATE_PROPERTY' && thingId && payload) {
            const parsedPayload = safeJsonObject(payload);
            const res = await axios.post(`${baseUrl}/${thingId}/properties`, parsedPayload, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", property: res.data };
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
        const { action, deviceUuid, command, envVars } = toolInput;
        const baseUrl = `https://api.balena-cloud.com/v6`;

        if (action === 'GET_FLEET_STATUS') {
            const res = await axios.get(`${baseUrl}/device?$select=id,uuid,device_name,status,is_online,os_version,overall_status`, { headers, timeout: TIMEOUT_MS });
            const devicesArray = Array.isArray(res.data?.d) ? res.data.d : [];
            
            const truncated = devicesArray.length > MAX_FLEET_DEVICES;
            const devices = devicesArray.slice(0, MAX_FLEET_DEVICES);

            return { 
                status: "Success", 
                totalDevices: devicesArray.length, 
                returnedCount: devices.length,
                truncated,
                devices 
            };
        } 
        else if (action === 'GET_DEVICE_LOGS' && deviceUuid) {
            const res = await axios.get(`https://api.balena-cloud.com/device/v2/${deviceUuid}/logs?count=50`, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", logs: res.data };
        } 
        else if (action === 'REBOOT_DEVICE' && deviceUuid) {
            await axios.post(`https://api.balena-cloud.com/supervisor/v1/reboot`, { uuid: deviceUuid }, { headers, timeout: TIMEOUT_MS });
            return { status: "Success", message: `Reboot command sent to device ${deviceUuid}` };
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
            
            return { status: "Success", variable: res.data };
        }

        return { error: `Missing required parameters for Edge Fleet action: ${action}` };
    } catch (err: any) { 
        return { error: `Raspberry Pi Fleet Error: ${err.response?.data?.message || err.message}` }; 
    }
};