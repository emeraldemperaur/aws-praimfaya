import axios from 'axios';
import * as crypto from 'crypto';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 12000;
const MAX_RECORDS = 30; 

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

const projectRecord = (record: any, depth = 0): any => {
    if (depth > 3) return '[Max Depth Reached]';
    if (!record || typeof record !== 'object') return record;
    
    if (Array.isArray(record)) {
        return record.slice(0, MAX_RECORDS).map(r => projectRecord(r, depth + 1));
    }

    const projected: Record<string, any> = {};
    const IGNORED_KEYS = new Set(['attributes', 'meta', 'text', 'SystemModstamp', '_links', 'link']);

    for (const [key, value] of Object.entries(record)) {
        if (IGNORED_KEYS.has(key) || value === null || value === undefined || value === '') continue;
        
        if (typeof value === 'object') {
            projected[key] = projectRecord(value, depth + 1);
        } else {
            projected[key] = value;
        }
    }
    return projected;
};

const generateOAuthHeader = (method: string, url: string, consumerKey: string, consumerSecret: string, accessToken: string, accessSecret: string, queryParams: Record<string, string> = {}): string => {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const oauthParams: Record<string, string> = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: timestamp,
        oauth_token: accessToken,
        oauth_version: '1.0'
    };

    const allParams = { ...oauthParams, ...queryParams };
    const encode = (str: string) => encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    
    const parameterString = Object.keys(allParams).sort().map(k => `${encode(k)}=${encode(allParams[k])}`).join('&');
    const signatureBaseString = `${method.toUpperCase()}&${encode(url)}&${encode(parameterString)}`;
    const signingKey = `${encode(consumerSecret)}&${encode(accessSecret)}`;
    
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
    oauthParams['oauth_signature'] = signature;

    return 'OAuth ' + Object.keys(oauthParams).map(k => `${encode(k)}="${encode(oauthParams[k])}"`).join(', ');
};

export const executeETradeFinancial = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const CONSUMER_KEY = ephemeralSecrets.etradeConsumerKey;
    const CONSUMER_SECRET = ephemeralSecrets.etradeConsumerSecret;
    const ACCESS_TOKEN = ephemeralSecrets.etradeAccessToken;
    const ACCESS_SECRET = ephemeralSecrets.etradeAccessSecret;
    const ENVIRONMENT = ephemeralSecrets.etradeEnvironment || 'production';

    if (!CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
        return { error: "Missing E*TRADE credentials. Call 'request_secure_credentials' with serviceName 'etrade'." };
    }

    const baseUrl = ENVIRONMENT === 'production' ? 'https://api.etrade.com/v1' : 'https://apisb.etrade.com/v1';

    try {
        const { action, accountIdKey, symbols, orderId, payload } = toolInput;
        const baseCost = { action: `ETRADE_${action}`, creditsToDeduct: 15 }; 

        const makeRequest = async (method: 'GET' | 'POST' | 'PUT', endpoint: string, queryParams: Record<string, string> = {}, bodyData?: any) => {
            const fullUrl = `${baseUrl}${endpoint}`;
            const authHeader = generateOAuthHeader(method, fullUrl, CONSUMER_KEY, CONSUMER_SECRET, ACCESS_TOKEN, ACCESS_SECRET, queryParams);
            const headers: Record<string, string> = { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' };
            const res = await axios({ method, url: fullUrl, params: queryParams, headers, data: bodyData, timeout: TIMEOUT_MS });
            return projectRecord(res.data);
        };

        if (action === 'LIST_ACCOUNTS') {
            const data = await makeRequest('GET', '/accounts/list');
            return { status: "Success", accounts: data, billingMetrics: baseCost };
        }
        else if (action === 'GET_ACCOUNT_BALANCE' && accountIdKey) {
            const data = await makeRequest('GET', `/accounts/${accountIdKey}/balance`, { instType: 'BROKERAGE' });
            return { status: "Success", balance: data, billingMetrics: baseCost };
        }
        else if (action === 'VIEW_PORTFOLIO' && accountIdKey) {
            const data = await makeRequest('GET', `/accounts/${accountIdKey}/portfolio`);
            return { status: "Success", portfolio: data, billingMetrics: baseCost };
        }
        else if (action === 'GET_QUOTE' && symbols) {
            const symbolList = Array.isArray(symbols) ? symbols.join(',') : String(symbols);
            const data = await makeRequest('GET', `/market/quote/${symbolList}`);
            return { status: "Success", quote: data, billingMetrics: baseCost };
        }
        else if (action === 'PREVIEW_ORDER' && accountIdKey && payload) {
            const parsedPayload = safeJsonObject(payload);
            const data = await makeRequest('POST', `/accounts/${accountIdKey}/orders/preview`, {}, parsedPayload);
            return { status: "Success", orderPreview: data, billingMetrics: baseCost };
        }
        else if (action === 'PLACE_ORDER' && accountIdKey && payload) {
            const parsedPayload = safeJsonObject(payload);
            const data = await makeRequest('POST', `/accounts/${accountIdKey}/orders/place`, {}, parsedPayload);
            return { status: "Success", orderResult: data, billingMetrics: baseCost };
        }
        else if (action === 'CANCEL_ORDER' && accountIdKey && orderId) {
            const cancelPayload = { CancelOrderRequest: { orderId } };
            const data = await makeRequest('PUT', `/accounts/${accountIdKey}/orders/cancel`, {}, cancelPayload);
            return { status: "Success", cancelResult: data, billingMetrics: baseCost };
        }
        else if (action === 'CHECK_ORDER_STATUS' && accountIdKey) {
            const data = await makeRequest('GET', `/accounts/${accountIdKey}/orders`);
            return { status: "Success", orders: data, billingMetrics: baseCost };
        }

        return { error: `Missing required parameters or unsupported E*TRADE action: ${action}` };
    } catch (err: any) {
        return { error: `E*TRADE Financial Error: ${err.response?.data?.Error?.message || err.response?.data?.message || err.message}` };
    }
};