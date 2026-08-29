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


export const executeGoogleHome = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const GH_PROJECT = ephemeralSecrets.googleHomeProjectId;
    const GH_TOKEN = ephemeralSecrets.googleHomeToken;
    
    if (!GH_PROJECT || !GH_TOKEN) {
        return { error: "Missing Google Home credentials. Call 'request_secure_credentials' with serviceName 'google_home'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${GH_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, deviceId, command, params } = toolInput;
        const baseUrl = `https://smartdevicemanagement.googleapis.com/v1/enterprises/${GH_PROJECT}`;

        if (action === 'GET_DEVICES') {
            const res = await axios.get(`${baseUrl}/devices`, { headers });
            return { status: "Success", devices: res.data.devices };
        } 
        else if (action === 'CONTROL_DEVICE' && deviceId && command) {
            const payload = { command: command, params: safeJsonParse(params) || {} };
            const res = await axios.post(`${baseUrl}/devices/${deviceId}:executeCommand`, payload, { headers });
            return { status: "Success", results: res.data };
        } 
        else if (action === 'GET_ROOMS') {
            const res = await axios.get(`${baseUrl}/structures`, { headers });
            return { status: "Success", structures: res.data.structures };
        } 
        else if (action === 'MANAGE_ROOM') {
            return { error: "Google SDM API restricts third-party applications from mutating rooms. Inform the user they must use the Google Home App." };
        }

        return { error: `Missing required parameters or unsupported Google Home action: ${action}` };
    } catch (err: any) { 
        return { error: `Google Home Error: ${err.response?.data?.error?.message || err.message}` }; 
    }
};


export const executeHomeAssistant = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const HA_URL = ephemeralSecrets.homeAssistantUrl;
    const HA_TOKEN = ephemeralSecrets.homeAssistantToken;
    
    if (!HA_URL || !HA_TOKEN) {
        return { error: "Missing Home Assistant credentials. Call 'request_secure_credentials' with serviceName 'home_assistant'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, entityId, domain, service, serviceData, templateString, startTime } = toolInput;
        const baseUrl = `${HA_URL.replace(/\/$/, "")}/api`;

        if (action === 'GET_DEVICES') {
            const res = await axios.get(`${baseUrl}/states`, { headers });
            const filteredStates = res.data.filter((s: any) => !s.entity_id.startsWith('sensor.uptime'));
            return { status: "Success", totalEntities: filteredStates.length, devices: filteredStates.slice(0, 100) };
        } 
        else if (action === 'CONTROL_DEVICE' && domain && service) {
            const payload = safeJsonParse(serviceData) || {};
            if (entityId) payload.entity_id = entityId;
            const res = await axios.post(`${baseUrl}/services/${domain}/${service}`, payload, { headers });
            return { status: "Success", changedStates: res.data };
        } 
        else if (action === 'GET_HISTORY' && entityId) {
            const timeParam = startTime ? `/${startTime}` : '';
            const res = await axios.get(`${baseUrl}/history/period${timeParam}?filter_entity_id=${entityId}`, { headers });
            return { status: "Success", history: res.data[0] || [] };
        }
        else if (action === 'GET_ERROR_LOGS') {
            const res = await axios.get(`${baseUrl}/error_log`, { headers });
            const logs = res.data.split('\n').slice(-50).join('\n'); 
            return { status: "Success", logs };
        }
        else if (action === 'RENDER_TEMPLATE' && templateString) {
            const res = await axios.post(`${baseUrl}/template`, { template: templateString }, { headers });
            return { status: "Success", renderedOutput: res.data };
        }

        return { error: `Missing required parameters or unsupported Home Assistant action: ${action}` };
    } catch (err: any) { 
        return { error: `Home Assistant Error: ${err.response?.data?.message || err.message}` }; 
    }
};


export const executeAmazonAlexa = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const ALEXA_TOKEN = ephemeralSecrets.alexaToken;
    
    if (!ALEXA_TOKEN) {
        return { error: "Missing Amazon Alexa credentials. Call 'request_secure_credentials' with serviceName 'alexa'." };
    } 

    try {
        const headers = { Authorization: `Bearer ${ALEXA_TOKEN}`, 'Content-Type': 'application/json' };
        const { action, endpointId, namespace, name, payload } = toolInput;
        const baseUrl = `https://api.amazonalexa.com/v3`;

        if (action === 'GET_DEVICES') {
            return { error: "Proactive device discovery is not supported via the Alexa Event Gateway. You must rely on the user providing the target device name/ID." };
        } 
        else if (action === 'CONTROL_DEVICE' && endpointId && namespace && name) {
            const parsedPayload = safeJsonParse(payload) || {};
            const eventPayload = {
                context: {},
                event: {
                    header: { namespace: namespace, name: name, payloadVersion: "3", messageId: Date.now().toString() },
                    endpoint: { endpointId: endpointId },
                    payload: parsedPayload
                }
            };
            const res = await axios.post(`${baseUrl}/events`, eventPayload, { headers });
            return { status: "Success", eventResponse: res.data };
        } 
        else if (action === 'GET_ROOMS' || action === 'MANAGE_ROOM') {
            return { error: "Alexa Smart Home Skill API strictly prohibits third-party group/room management. Inform the user they must manage their Alexa Groups directly in the Alexa App." };
        } 

        return { error: `Missing required parameters for Alexa action: ${action}` };
    } catch (err: any) { 
        return { error: `Alexa Error: ${err.response?.data?.message || err.message}` }; 
    }
};