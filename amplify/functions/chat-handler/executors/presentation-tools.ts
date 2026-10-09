import { BedrockRuntimeClient, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ToolExecutionContext } from './types';

const bedrockClient = new BedrockRuntimeClient({ 
    region: process.env.BEDROCK_REGION || 'us-west-2' 
});

async function recordRAGArtifact(
    profile: any,
    session: { userId: string; id: string; title?: string },
    fileUrl: string,
    fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
    dynamodb: any,
    ragArtifactsTable?: string
) {
    if (!ragArtifactsTable || !dynamodb) return;
    const fileName = fileUrl.split('/').pop() || 'presentation.mp4';
    
    try {
        const putPromise = dynamodb.send(new PutCommand({
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

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DynamoDB RAG telemetry timeout")), 4000));
        await Promise.race([putPromise, timeoutPromise]);
    } catch (err) {
        console.error("Failed to record RAG artifact telemetry:", err);
    }
}

export const executeLumaVideoPresentation = async ({ toolInput, env, clients, profile, cognitoUserId: ctxUserId, sessionId: ctxSessionId }: ToolExecutionContext) => {
    const { 
        topicDescription, industryTheme, voiceoverStyle, 
        slides, taskId, cognitoUserId, sessionId 
    } = toolInput;
    
    const outputBucket = env.MEDIA_OUTPUT_BUCKET_NAME;
    if (!outputBucket) return { error: "System configuration error: MEDIA_OUTPUT_BUCKET_NAME missing." };

    const userId = cognitoUserId || ctxUserId || 'SYSTEM_USER';
    const activeSessionId = sessionId || ctxSessionId || taskId || `session_${Date.now()}`;
    const jobId = taskId || `vanguard_deck_${Date.now()}`;
    const s3DestinationPrefix = `s3://${outputBucket}/luma-presentations/${jobId}`;


    let computeCredits = 20; 
    computeCredits += (slides.length * 80);
    if (voiceoverStyle && voiceoverStyle !== 'NONE') {
        computeCredits += (slides.length * 5);
    }

    try {
        const dispatchedJobs = [];
        
        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            const slideNumber = i + 1;
            const safeVisualPrompt = slide.sceneVisualPrompt ? slide.sceneVisualPrompt.substring(0, 350) : 'Cinematic presentation background';
            const optimizedPrompt = `${safeVisualPrompt}. Aesthetic: ${industryTheme}. High quality, cinematic lighting, photorealistic.`;
            
            const command = new StartAsyncInvokeCommand({
                modelId: "luma.ray-v2:0",
                modelInput: {
                    prompt: optimizedPrompt,
                    aspect_ratio: "16:9",
                    resolution: "720p",
                    duration: "5s"
                },
                outputDataConfig: {
                    s3OutputDataConfig: {
                        s3Uri: `${s3DestinationPrefix}/slide_${slideNumber}/`
                    }
                }
            });

            const response = await bedrockClient.send(command);

            dispatchedJobs.push({
                slideIndex: slideNumber,
                bedrockInvocationArn: response.invocationArn,
                s3ExpectedOutput: `https://${outputBucket}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/luma-presentations/${jobId}/slide_${slideNumber}/output.mp4`, 
                overlayText: slide.overlayText,
                speakerScript: slide.speakerScript
            });

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        const primaryArtifactUrl = `https://${outputBucket}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/luma-presentations/${jobId}/slide_1/output.mp4`;

        await recordRAGArtifact(
            profile,
            { userId, id: activeSessionId, title: topicDescription?.slice(0, 50) || 'Cinematic Luma Deck' },
            primaryArtifactUrl,
            'VIDEO',
            clients?.dynamodb,
            env.RAG_ARTIFACTS_TABLE_NAME
        );

        return {
            status: "Success",
            message: `Successfully dispatched ${slides.length} scenes to Amazon Bedrock Luma Ray-2.`,
            compilationPipeline: {
                orchestrator: "Vanguard_Bedrock_Compiler",
                theme: industryTheme,
                tasks: dispatchedJobs
            },
            primaryArtifactUrl,
            uiDirective: "POLL_BEDROCK_STATUS",
            billingMetrics: { action: "LUMA_VIDEO_DECK", creditsToDeduct: computeCredits }
        };

    } catch (err: any) {
        console.error("[BedrockLumaExecutor] Execution error:", err.message);
        return { error: `Bedrock Presentation Engine Error: ${err.message}.` };
    }
};