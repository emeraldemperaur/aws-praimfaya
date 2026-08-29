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


export const executeArduinoCloud = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ARDUINO_CLIENT_ID = ephemeralSecrets.arduinoClientId;
    const ARDUINO_SECRET = ephemeralSecrets.arduinoClientSecret;
    
    if (!ARDUINO_CLIENT_ID || !ARDUINO_SECRET) {
        return { error: "Missing Arduino IoT credentials. Call 'request_secure_credentials' with serviceName 'arduino'." };
    } 

    try {
        const tokenRes = await axios.post('https://api2.arduino.cc/iot/v1/clients/token', 
            new URLSearchParams({ grant_type: "client_credentials", client_id: ARDUINO_CLIENT_ID, client_secret: ARDUINO_SECRET, audience: "https://api2.arduino.cc/iot" }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        
        const headers = { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' };
        const { action, thingId, propertyId, payload } = toolInput;
        const baseUrl = 'https://api2.arduino.cc/iot/v2/things';

        if (action === 'GET_THINGS') {
            const res = await axios.get(baseUrl, { headers });
            return { status: "Success", things: res.data };
        } 
        else if (action === 'GET_PROPERTIES' && thingId) {
            const res = await axios.get(`${baseUrl}/${thingId}/properties`, { headers });
            return { status: "Success", properties: res.data };
        } 
        else if (action === 'UPDATE_PROPERTY' && thingId && propertyId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.put(`${baseUrl}/${thingId}/properties/${propertyId}`, parsedPayload, { headers });
            return { status: "Success", property: res.data };
        } 
        else if (action === 'CREATE_PROPERTY' && thingId && payload) {
            const parsedPayload = safeJsonParse(payload);
            const res = await axios.post(`${baseUrl}/${thingId}/properties`, parsedPayload, { headers });
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
            const res = await axios.get(`${baseUrl}/device?$select=id,uuid,device_name,status,is_online,os_version,overall_status`, { headers });
            return { status: "Success", devices: res.data.d };
        } 
        else if (action === 'GET_DEVICE_LOGS' && deviceUuid) {
            const res = await axios.get(`https://api.balena-cloud.com/device/v2/${deviceUuid}/logs?count=50`, { headers });
            return { status: "Success", logs: res.data };
        } 
        else if (action === 'REBOOT_DEVICE' && deviceUuid) {
            await axios.post(`https://api.balena-cloud.com/supervisor/v1/reboot`, { uuid: deviceUuid }, { headers });
            return { status: "Success", message: `Reboot command sent to device ${deviceUuid}` };
        }
        else if (action === 'SET_DEVICE_ENV_VAR' && deviceUuid && envVars) {
            const parsedVars = safeJsonParse(envVars);
            const res = await axios.post(`${baseUrl}/device_environment_variable`, { 
                device: deviceUuid, 
                name: parsedVars.name, 
                value: parsedVars.value 
            }, { headers });
            return { status: "Success", variable: res.data };
        }

        return { error: `Missing required parameters for Edge Fleet action: ${action}` };
    } catch (err: any) { 
        return { error: `Raspberry Pi Fleet Error: ${err.response?.data?.message || err.message}` }; 
    }
};