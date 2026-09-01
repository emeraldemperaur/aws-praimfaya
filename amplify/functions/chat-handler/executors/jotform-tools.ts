import axios from 'axios';
import qs from 'qs';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 8000; 
const MAX_ARRAY_ITEMS = 50; 


const safeJsonObject = (input: any, fallback: any = {}) => {
    if (!input) return fallback;
    if (typeof input === 'object' && !Array.isArray(input)) return input;
    try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

export const executeJotformAgent = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const { endpoint, method = 'GET', payload = {}, queryParams = {} } = toolInput;
    const apiKey = ephemeralSecrets.jotformToken;

    if (!apiKey) {
        return { 
            error: "Authentication required. Missing Jotform API Token.", 
            resolution: "Please use the 'request_secure_credentials' tool with serviceName 'jotform'." 
        };
    }

 
    let cleanEndpoint = (endpoint || '/user')
        .replace(/^https?:\/\/(www\.|eu-api\.|hipaa-api\.|api\.)?jotform\.com/i, '')
        .replace(/{(\d+)}/g, '$1');

    let inlineParams: Record<string, any> = {};
    if (cleanEndpoint.includes('?')) {
        const [pathPart, queryString] = cleanEndpoint.split('?');
        cleanEndpoint = pathPart;
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((val, key) => {
            inlineParams[key] = val;
        });
    }

    cleanEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
    const baseUrl = `https://api.jotform.com${cleanEndpoint}`;

   
    const parsedPayload = safeJsonObject(payload);
    const parsedQueryParams = {
        ...inlineParams,
        ...safeJsonObject(queryParams)
    };

    const executeRequest = async (url: string, params: any, retryCount = 0): Promise<any> => {
        try {
            const config: any = {
                method: method.toUpperCase(),
                url,
                timeout: TIMEOUT_MS, 
                headers: {
                    'APIKEY': apiKey, 
                    'Accept': 'application/json'
                }
            };

            if (config.method === 'GET' || config.method === 'DELETE') {
                config.params = params;
            } else {
                config.data = qs.stringify(parsedPayload);
                config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            return await axios(config);
        } catch (error: any) {
            if (error.response?.status === 429 && retryCount < 2) {
                const backoffMs = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return executeRequest(url, params, retryCount + 1);
            }
            throw error;
        }
    };

    try {
        const response = await executeRequest(baseUrl, parsedQueryParams);
        const data = response.data;

        if (data.responseCode !== 200 && data.responseCode !== 201) {
            throw new Error(`Jotform returned code ${data.responseCode}: ${data.message}`);
        }

        
        let content = data.content;
        let truncated = false;
        
        if (Array.isArray(content) && content.length > MAX_ARRAY_ITEMS) {
            content = content.slice(0, MAX_ARRAY_ITEMS);
            truncated = true;
        }

        return { 
            status: "Success", 
            message: data.message,
            truncated,
            content,
            limitLeft: data.limitJSON 
        };

    } catch (error: any) {
        return { 
            error: `Jotform API Error (${error.response?.status || 'Unknown'})`,
            details: error.response?.data?.message || error.message,
            attemptedUrl: baseUrl
        };
    }
};