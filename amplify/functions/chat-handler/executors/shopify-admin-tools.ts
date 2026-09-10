import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ToolExecutionContext } from "./types";

const DEFAULT_SHOPIFY_API_VERSION = "2026-07";
const MAX_QUERY_LIMIT = 250; 

interface ShopifyRequestOptions {
    shopDomain: string;
    accessToken: string;
    apiVersion?: string;
    endpoint: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    queryParams?: Record<string, any>;
    payload?: any;
}

function getMediaBucketName(env: Record<string, string>): string {
    return env.MEDIA_OUTPUT_BUCKET_NAME || env.MEDIA_OUTPUT_BUCKET || "praimfaya-media-outputs";
}

async function recordRAGArtifact(
    profile: any,
    session: { userId: string; id: string; title?: string },
    fileUrl: string,
    fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
    dynamodb: any,
    ragArtifactsTable?: string
) {
    if (!ragArtifactsTable || !dynamodb) return;
    const fileName = fileUrl.split('/').pop() || 'shopify_report.json';
    
    try {
        await dynamodb.send(new PutCommand({
            TableName: ragArtifactsTable,
            Item: {
                id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: session.userId,
                terminalId: session.id,
                terminalTitle: session.title || profile?.name || 'Terminal Session',
                modelName: profile?.llmModelId || 'amazon.nova-pro-v1:0',
                contextProfileName: profile?.name || 'Vanguard AI',
                fileUrl: fileUrl,
                fileName: fileName,
                fileType: fileType,
                createdAt: new Date().toISOString()
            }
        }));
    } catch (err) {
        console.error("[Shopify Vanguard] Failed to record RAG artifact telemetry:", err);
    }
}

async function callShopifyAdminAPI({
    shopDomain,
    accessToken,
    apiVersion = DEFAULT_SHOPIFY_API_VERSION,
    endpoint,
    method = "GET",
    queryParams,
    payload
}: ShopifyRequestOptions) {
    const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.substring(1) : endpoint;
    
    let queryString = "";
    if (queryParams && Object.keys(queryParams).length > 0) {
        const params = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
                if (key === "limit") val = Math.min(Number(val), MAX_QUERY_LIMIT);
                params.append(key, String(val));
            }
        });
        queryString = `?${params.toString()}`;
    }

    const url = `https://${cleanDomain}/admin/api/${apiVersion}/${cleanEndpoint}${queryString}`;

    const headers: Record<string, string> = {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const fetchOptions: RequestInit = { method, headers };

    if (payload && ["POST", "PUT"].includes(method)) {
        fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API Error (${response.status} ${response.statusText}): ${errorText}`);
    }

    if (response.status === 204) {
        return { success: true, status: 204 };
    }

    return await response.json();
}

export const executeShopifyAdminAgent = async ({
    toolInput,
    citations,
    clients,
    profile,
    cognitoUserId,
    sessionId,
    env,
    ephemeralSecrets
}: ToolExecutionContext) => {
    try {
        const {
            action = "EXECUTE_REST_ACTION",
            endpoint,
            method = "GET",
            queryParams = {},
            payload,
            timeframeDays = 30
        } = toolInput;

        const shopDomain = ephemeralSecrets?.shopifyDomain || toolInput.shopDomain || env.SHOPIFY_STORE_DOMAIN;
        const accessToken = ephemeralSecrets?.shopifyAccessToken || env.SHOPIFY_ADMIN_ACCESS_TOKEN;
        const apiVersion = env.SHOPIFY_API_VERSION || DEFAULT_SHOPIFY_API_VERSION;

        if (!shopDomain || !accessToken) {
            return {
                error: "Authentication Error: Missing Shopify Domain or Access Token. Provide credentials in ephemeral memory or environment context.",
                additionalCreditsUsed: -10
            };
        }

        if (action === "GET_FINANCIAL_INSIGHTS") {
            const baseCredits = 400;

            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - timeframeDays);
            const createdAtMin = dateThreshold.toISOString();

            const orderData = await callShopifyAdminAPI({
                shopDomain,
                accessToken,
                apiVersion,
                endpoint: "orders.json",
                queryParams: {
                    status: "any",
                    limit: MAX_QUERY_LIMIT,
                    created_at_min: createdAtMin, 
                    fields: "id,total_price,subtotal_price,total_tax,total_discounts,created_at,financial_status,fulfillment_status,customer,line_items"
                }
            });

            const orders: any[] = Array.isArray(orderData.orders) ? orderData.orders : [];

            let grossRevenue = 0;
            let totalDiscounts = 0;
            let fulfilledCount = 0;
            let unfulfilledCount = 0;
            const customerOrderMap: Record<string, number> = {};
            const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

            orders.forEach(order => {
                const totalPrice = parseFloat(order.total_price || "0");
                const discount = parseFloat(order.total_discounts || "0");
                grossRevenue += totalPrice;
                totalDiscounts += discount;

                if (order.fulfillment_status === "fulfilled") fulfilledCount++;
                else unfulfilledCount++;

                if (order.customer?.id) {
                    const cid = String(order.customer.id);
                    customerOrderMap[cid] = (customerOrderMap[cid] || 0) + 1;
                }

                if (Array.isArray(order.line_items)) {
                    order.line_items.forEach((item: any) => {
                        const pid = String(item.product_id || item.title);
                        if (!productSalesMap[pid]) {
                            productSalesMap[pid] = { name: item.title, quantity: 0, revenue: 0 };
                        }
                        productSalesMap[pid].quantity += item.quantity || 0;
                        productSalesMap[pid].revenue += parseFloat(item.price || "0") * (item.quantity || 1);
                    });
                }
            });

            const totalOrders = orders.length;
            const averageOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;
            const repeatCustomers = Object.values(customerOrderMap).filter(count => count > 1).length;
            const totalCustomers = Object.keys(customerOrderMap).length;
            const repeatCustomerRatio = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

            const topProducts = Object.values(productSalesMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            const insightsSummary = {
                storeDomain: shopDomain,
                timeframeAnalyzed: `${timeframeDays} days`,
                financialOverview: {
                    totalOrders,
                    grossRevenue: Number(grossRevenue.toFixed(2)),
                    totalDiscountsGranted: Number(totalDiscounts.toFixed(2)),
                    averageOrderValue: Number(averageOrderValue.toFixed(2)),
                    currency: orders[0]?.currency || "USD"
                },
                operationalHealth: {
                    fulfilledOrders: fulfilledCount,
                    unfulfilledOrders: unfulfilledCount,
                    fulfillmentBacklogRatio: totalOrders > 0 ? Number(((unfulfilledCount / totalOrders) * 100).toFixed(1)) : 0
                },
                customerRetention: {
                    totalUniqueCustomers: totalCustomers,
                    repeatCustomers,
                    repeatCustomerRatioPercentage: Number(repeatCustomerRatio.toFixed(1))
                },
                topPerformingProducts: topProducts
            };

            const bucketName = getMediaBucketName(env);
            const fileName = `shopify-reports/report-${Date.now()}.json`;
            
            await clients.s3.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: JSON.stringify(insightsSummary, null, 2),
                ContentType: "application/json"
            }));

            const fileUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;

            await recordRAGArtifact(
                profile,
                { userId: cognitoUserId, id: sessionId, title: profile?.name },
                fileUrl,
                'DOCUMENT',
                clients.dynamodb,
                env.RAG_ARTIFACTS_TABLE_NAME
            );
            
            citations.push({ type: 'asset', uri: fileUrl });

            const computeCreditsUsed = baseCredits + Math.ceil(orders.length * 1.5);

            return {
                status: "Success",
                action: "GET_FINANCIAL_INSIGHTS",
                insights: insightsSummary,
                reportUrl: fileUrl,
                additionalCreditsUsed: -computeCreditsUsed
            };
        }

        if (!endpoint) {
            return {
                error: "Execution Error: Parameter 'endpoint' is required for EXECUTE_REST_ACTION.",
                additionalCreditsUsed: -10
            };
        }

        let baseCost = 150;
        if (method === "POST") baseCost = 300;
        if (method === "PUT") baseCost = 250;
        if (method === "DELETE") baseCost = 400;

        const apiResult = await callShopifyAdminAPI({
            shopDomain,
            accessToken,
            apiVersion,
            endpoint,
            method,
            queryParams,
            payload
        });

        return {
            status: "Success",
            action: "EXECUTE_REST_ACTION",
            endpoint,
            method,
            result: apiResult,
            additionalCreditsUsed: -baseCost
        };

    } catch (err: any) {
        console.error("[Shopify Vanguard Agent Error]:", err);
        return {
            error: `Shopify Execution Failed: ${err.message}`,
            additionalCreditsUsed: -50
        };
    }
};