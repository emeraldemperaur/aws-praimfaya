import axios from 'axios';
import { randomUUID } from 'crypto';
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

const generateIdempotencyKey = () => {
    try {
        return randomUUID();
    } catch {
        return Math.random().toString(36).substring(2, 15);
    }
};

const formatAxiosError = (err: any): string => {
    if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') return data.slice(0, 300);
        
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            return data.errors[0]?.detail || data.errors[0]?.category || JSON.stringify(data.errors[0]);
        }
        if (data.message) return typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    }
    return err.message || 'Unknown network error occurred while reaching Square API.';
};

const slimSquareResponse = (data: any, maxItems = MAX_RESULTS) => {
    if (!data || typeof data !== 'object') return data;
    
    const slimmed = { ...data };
    
    for (const key of Object.keys(slimmed)) {
        if (Array.isArray(slimmed[key]) && slimmed[key].length > maxItems) {
            slimmed[key] = slimmed[key].slice(0, maxItems);
            slimmed[`_metadata_${key}_truncated`] = `Truncated from ${data[key].length} to ${maxItems} items to save context.`;
        }
    }
    
    return slimmed;
};

export const executeSquareAgent = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const SQUARE_ENVIRONMENT = ephemeralSecrets.squareEnvironment || 'sandbox';
    const SQUARE_ACCESS_TOKEN = ephemeralSecrets.squareAccessToken;

    if (!SQUARE_ACCESS_TOKEN) {
        return { error: "Missing Square API credentials. Call 'request_secure_credentials' with serviceName 'square'." };
    }

    const baseUrl = SQUARE_ENVIRONMENT === 'production' 
        ? 'https://connect.squareup.com' 
        : 'https://connect.squareupsandbox.com';

    try {
        const { action, method = 'GET', endpoint, payload, queryParams } = toolInput;
        
        const headers = {
            'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
            'Square-Version': '2024-06-04',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        if (action === 'GET_BUSINESS_SUMMARY') {
            const [locations, catalog] = await Promise.all([
                axios.get(`${baseUrl}/v2/locations`, { headers, timeout: TIMEOUT_MS }),
                axios.get(`${baseUrl}/v2/catalog/info`, { headers, timeout: TIMEOUT_MS })
            ]);
            return { 
                status: "Success", 
                businessSummary: {
                    locations: locations.data?.locations || [],
                    catalogInfo: catalog.data || {}
                }
            };
        }
        else if (action === 'EXECUTE_SQUARE_API') {
            if (!endpoint) return { error: "Endpoint path is required for EXECUTE_SQUARE_API." };

            const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const fullUrl = `${baseUrl}${cleanEndpoint}`;

            let parsedPayload = safeJsonObject(payload);

            const isPost = method.toUpperCase() === 'POST';
            const isSearch = cleanEndpoint.toLowerCase().includes('/search');

            if (isPost && !isSearch && Object.keys(parsedPayload).length > 0 && !parsedPayload.idempotency_key) {
                parsedPayload.idempotency_key = generateIdempotencyKey();
            }

            const res = await axios({
                method,
                url: fullUrl,
                params: queryParams,
                headers,
                data: ['POST', 'PUT'].includes(method.toUpperCase()) ? parsedPayload : undefined,
                timeout: TIMEOUT_MS
            });

            return { status: "Success", data: slimSquareResponse(res.data) };
        }

        return { error: `Unsupported Square action: ${action}` };
    } catch (err: any) {
        const safeError = formatAxiosError(err);
        console.error(`[executeSquareAgent] Error: ${safeError}`);
        
        return { 
            error: `Square API Error: ${safeError}`,
            squareErrors: (err.response?.data?.errors || []).slice(0, 3) 
        };
    }
};