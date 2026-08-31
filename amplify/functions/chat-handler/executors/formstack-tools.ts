import axios from 'axios';
import { ToolExecutionContext } from './types';

export const executeFormstackAgent = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const { endpoint, method = 'GET', payload = {}, queryParams = {} } = toolInput;
    
    const apiToken = ephemeralSecrets.formstackToken;

    if (!apiToken) {
        return { 
            error: "Authentication required. Missing Formstack API Token.", 
            resolution: "Please use the 'request_secure_credentials' tool with serviceName 'formstack'." 
        };
    }

 
    let cleanEndpoint = endpoint.replace(/^https?:\/\/(www\.)?formstack\.com\/api\/v2/i, '');
    cleanEndpoint = cleanEndpoint.replace(/{(\d+)}/g, '$1');
    cleanEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
    const finalEndpoint = cleanEndpoint.endsWith('.json') ? cleanEndpoint : `${cleanEndpoint}.json`;
    
    const baseUrl = `https://www.formstack.com/api/v2${finalEndpoint}`;

    const executeRequest = async (url: string, params: any, retryCount = 0): Promise<any> => {
        try {
            const config: any = {
                method: method.toUpperCase(),
                url,
                timeout: 10000, 
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (config.method === 'GET' || config.method === 'DELETE') {
                config.params = params;
            } else {
                config.data = payload;
            }

            return await axios(config);
        } catch (error: any) {
            if (error.response?.status === 429 && retryCount < 3) {
                const backoffMs = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return executeRequest(url, params, retryCount + 1);
            }
            throw error;
        }
    };

    try {
        const response = await executeRequest(baseUrl, queryParams);
        let data = response.data;

        if (method.toUpperCase() === 'GET' && data.pages && data.pages > 1) {
            let allItems: any[] = [];
            const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
            
            if (arrayKey) {
                allItems = [...data[arrayKey]];
                const maxPages = Math.min(data.pages, 5); 
                
              
                for (let i = 2; i <= maxPages; i++) {
                    try {
                        const pageRes = await executeRequest(baseUrl, { ...queryParams, page: i });
                        if (pageRes.data[arrayKey]) {
                            allItems = allItems.concat(pageRes.data[arrayKey]);
                        }
                    } catch (pageErr) {
                        console.warn(`Formstack pagination failed on page ${i}. Halting pagination early.`);
                        break; 
                    }
                }
                
                data[arrayKey] = allItems;
                data.auto_paginated = true;
                data.pages_fetched = maxPages;
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