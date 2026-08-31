import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import axios from 'axios';
import * as pdfParseNamespace from 'pdf-parse';
import { ToolExecutionContext } from './types';

const s3Client = new S3Client({});
const pdfParse = (pdfParseNamespace as any).default || pdfParseNamespace;

const CORPORATE_CSS = `
    body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 850px; margin: 0 auto; padding: 40px; }
    h1, h2, h3 { color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; margin-top: 1.5em; }
    table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
    th, td { padding: 12px; border: 1px solid #e5e7eb; text-align: left; }
    th { background-color: #f9fafb; font-weight: 600; }
    blockquote { border-left: 4px solid #3b82f6; margin: 0; padding-left: 1em; color: #4b5563; background: #eff6ff; padding: 10px; }
    @media print { body { padding: 0; } }
`;

export const executeGenerateDocument = async ({ toolInput, profile, sessionId, cognitoUserId, env, clients }: ToolExecutionContext) => {
    const { content, fileName, format } = toolInput;
    
    if (!env.MEDIA_OUTPUT_BUCKET_NAME || !env.RAG_ARTIFACTS_TABLE_NAME) {
        return { error: "Backend Configuration Error: Missing S3 Bucket or DynamoDB table references." };
    }

    const safeName = (fileName || 'document').replace(/[^a-zA-Z0-9-_]/g, '');
    const s3Key = `documents/${cognitoUserId}/${sessionId}/${safeName}-${Date.now()}.${format}`;
    
    let mimeType = 'text/plain';
    let finalContent = content;

    if (format === 'html') {
        mimeType = 'text/html';
        if (!content.toLowerCase().includes('<html')) {
            finalContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CORPORATE_CSS}</style></head><body>${content}</body></html>`;
        }
    } else if (format === 'csv') {
        mimeType = 'text/csv';
    } else if (format === 'md') {
        mimeType = 'text/markdown';
    }

    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: env.MEDIA_OUTPUT_BUCKET_NAME,
            Key: s3Key,
            Body: finalContent,
            ContentType: mimeType
        }));

        const command = new GetObjectCommand({
            Bucket: env.MEDIA_OUTPUT_BUCKET_NAME,
            Key: s3Key
        });
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const permanentUrl = `https://${env.MEDIA_OUTPUT_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
        
        
        await clients.dynamodb.send(new PutCommand({
            TableName: env.RAG_ARTIFACTS_TABLE_NAME,
            Item: {
                id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                userId: cognitoUserId,
                terminalId: sessionId || 'unknown-session',
                terminalTitle: profile?.title || 'Terminal Session',
                modelName: profile?.llmModelId || 'amazon.nova-pro-v1:0',
                contextProfileName: profile?.name || 'Vanguard AI',
                fileUrl: permanentUrl,
                fileName: `${safeName}.${format}`,
                fileType: 'DOCUMENT',
                createdAt: new Date().toISOString()
            }
        }));

        return { 
            status: "Success", 
            downloadUrl: presignedUrl, 
            message: `Document saved securely as ${format.toUpperCase()}. Provide the downloadUrl to the user.` 
        };

    } catch (err: any) {
        return { error: `Failed to save document: ${err.message}` };
    }
};

export const executeExtractPdf = async ({ toolInput, clients }: ToolExecutionContext) => {
    const { fileUrl, maxPages = 15 } = toolInput;
    
    if (!fileUrl) {
        return { error: "Missing required parameter: fileUrl" };
    }

    let pdfBuffer: Buffer;

    try {
        if (fileUrl.includes('.s3.') || fileUrl.startsWith('s3://')) {
            const urlObj = new URL(fileUrl.replace('s3://', 'https://'));
            const bucketName = fileUrl.startsWith('s3://') 
                ? urlObj.hostname 
                : urlObj.hostname.split('.')[0];
            const key = decodeURIComponent(urlObj.pathname.substring(1));

            const s3Res = await clients.s3.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: key
            }));
            
            const byteArr = await s3Res.Body?.transformToByteArray();
            if (!byteArr) throw new Error("Empty S3 object received.");
            pdfBuffer = Buffer.from(byteArr);
        } else {
            const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            pdfBuffer = Buffer.from(res.data);
        }
    } catch (downloadErr: any) {
        return { error: `Failed to download PDF. Ensure the link is public or an internal system artifact. Details: ${downloadErr.message}` };
    }

    try {
        const parseOptions = { max: maxPages };
        const parsedData = await pdfParse(pdfBuffer, parseOptions);

        const cleanText = parsedData.text.replace(/\n\s*\n/g, '\n').trim();

        return {
            status: "Success",
            documentMetadata: {
                title: parsedData.info?.Title || "Unknown",
                author: parsedData.info?.Author || "Unknown",
                pagesExtracted: parsedData.numpages,
            },
            extractedText: cleanText.substring(0, 100000) 
        };

    } catch (parseErr: any) {
        return { error: `Failed to parse PDF document structure: ${parseErr.message}` };
    }
};