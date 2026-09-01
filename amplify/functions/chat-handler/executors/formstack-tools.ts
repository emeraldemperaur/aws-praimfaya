import axios from 'axios';
import { ToolExecutionContext } from './types';

const TIMEOUT_MS = 6000; 
const MAX_ARRAY_ITEMS = 50; 


const safeJsonParse = (input: any, fallback: any = {}) => {
    if (!input) return fallback;
    if (typeof input === 'object') return input;
    try {
        const parsed = JSON.parse(input);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
};

export const executeFormstackAgent = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const { endpoint, method = 'GET', payload = {}, queryParams = {} } = toolInput;
    const apiToken = ephemeralSecrets.formstackToken;

    if (!apiToken) {
        return { 
            error: "Authentication required. Missing Formstack API Token.", 
            resolution: "Please use the 'request_secure_credentials' tool with serviceName 'formstack'." 
        };
    }


    let cleanEndpoint = (endpoint || '/form')
        .replace(/^https?:\/\/(www\.)?formstack\.com\/api\/v2/i, '')
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
    if (!cleanEndpoint.endsWith('.json')) {
        cleanEndpoint = `${cleanEndpoint}.json`;
    }

    const baseUrl = `https://www.formstack.com/api/v2${cleanEndpoint}`;

    const parsedPayload = safeJsonParse(payload, {});
    const parsedQueryParams = {
        ...inlineParams,
        ...safeJsonParse(queryParams, {})
    };

    
    const executeRequest = async (url: string, params: any, bodyData: any, retryCount = 0): Promise<any> => {
        try {
            const config: any = {
                method: method.toUpperCase(),
                url,
                timeout: TIMEOUT_MS,
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (config.method === 'GET' || config.method === 'DELETE') {
                config.params = params;
            } else {
                config.data = bodyData;
            }

            return await axios(config);
        } catch (error: any) {
            if (error.response?.status === 429 && retryCount < 2) {
                const backoffMs = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return executeRequest(url, params, bodyData, retryCount + 1);
            }
            throw error;
        }
    };

    try {
        const response = await executeRequest(baseUrl, parsedQueryParams, parsedPayload);
        let data = response.data;

       
        if (method.toUpperCase() === 'GET' && data && data.pages && data.pages > 1) {
            const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
            
            if (arrayKey) {
                let allItems = [...data[arrayKey]];
                const maxPagesToFetch = Math.min(data.pages, 4); // Limit to top 4 pages max

                const pagePromises = [];
                for (let page = 2; page <= maxPagesToFetch; page++) {
                    pagePromises.push(
                        executeRequest(baseUrl, { ...parsedQueryParams, page }, parsedPayload)
                            .then(res => res.data[arrayKey] || [])
                            .catch(err => {
                                console.warn(`Formstack pagination failed for page ${page}:`, err.message);
                                return [];
                            })
                    );
                }

                const additionalPages = await Promise.all(pagePromises);
                additionalPages.forEach(pageItems => {
                    allItems = allItems.concat(pageItems);
                });

                data[arrayKey] = allItems.slice(0, MAX_ARRAY_ITEMS);
                data.auto_paginated = true;
                data.total_retrieved = data[arrayKey].length;
            }
        }

        return { status: "Success", data };

    } catch (error: any) {
        return { 
            error: `Formstack API Error (${error.response?.status || 'Unknown'})`,
            details: error.response?.data || error.message,
            attemptedUrl: baseUrl
        };
    }
};