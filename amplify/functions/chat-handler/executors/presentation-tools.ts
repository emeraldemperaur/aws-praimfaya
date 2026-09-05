import { BedrockRuntimeClient, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime";
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../../data/resource';
import { ToolExecutionContext } from './types';

const bedrockClient = new BedrockRuntimeClient({ 
    region: process.env.BEDROCK_REGION || 'us-west-2' 
});

export const executeLumaVideoPresentation = async ({ toolInput, env }: ToolExecutionContext) => {
    const { 
        topicDescription, industryTheme, voiceoverStyle, 
        slides, taskId, cognitoUserId, sessionId 
    } = toolInput;
    
    const outputBucket = env.MEDIA_OUTPUT_BUCKET_NAME;
    if (!outputBucket) return { error: "System configuration error: MEDIA_OUTPUT_BUCKET_NAME missing." };

    const userId = cognitoUserId || 'SYSTEM_USER';
    const activeSessionId = sessionId || taskId || `session_${Date.now()}`;
    const jobId = taskId || `vanguard_deck_${Date.now()}`;
    const s3DestinationPrefix = `s3://${outputBucket}/luma-presentations/${jobId}`;

    const client = generateClient<Schema>();

   
    let computeCredits = 20; 
    computeCredits += (slides.length * 80);
    if (voiceoverStyle && voiceoverStyle !== 'NONE') {
        computeCredits += (slides.length * 5);
    }

    
    const userProfileResp = await client.models.UserProfile.list({
        filter: { cognitoUserId: { eq: userId } }
    });
    const userProfile = userProfileResp.data?.[0];

    if (!userProfile) return { error: `User profile not found. Cannot bill credits.` };

    const originalBalance = userProfile.computeCredits ?? 0;
    if (originalBalance < computeCredits) {
        return { error: `Insufficient compute credits. Required: ${computeCredits}, Available: ${originalBalance}.` };
    }

    const updatedBalance = originalBalance - computeCredits;
    await client.models.UserProfile.update({ id: userProfile.id, computeCredits: updatedBalance });

    try {
        await client.models.UsageRecord.create({
            userId: userId,
            sessionId: activeSessionId,
            sessionTitle: topicDescription?.slice(0, 50) || 'Cinematic Presentation',
            actionType: 'TOOL_EXECUTION',
            modelId: 'luma.ray-v2:0',
            toolName: 'generate_luma_video_presentation',
            creditsUsed: computeCredits,
            createdAt: new Date().toISOString()
        });

        
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

            await new Promise(resolve => setTimeout(resolve, 250));
        }

        
        const primaryArtifactUrl = `https://${outputBucket}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/luma-presentations/${jobId}/slide_1/output.mp4`;

        await client.models.RAGArtifact.create({
            userId: userId,
            terminalId: activeSessionId,
            terminalTitle: topicDescription?.slice(0, 50) || 'Cinematic Luma Deck',
            modelName: 'luma.ray-v2:0',
            contextProfileName: 'Presentation Agent',
            fileName: `${jobId}.mp4`,
            fileUrl: primaryArtifactUrl,
            fileType: 'VIDEO',
            createdAt: new Date().toISOString()
        });

        return {
            status: "Success",
            message: `Successfully dispatched ${slides.length} scenes to Amazon Bedrock Luma Ray-2.`,
            computeDeduction: computeCredits,
            remainingUserCredits: updatedBalance,
            compilationPipeline: {
                orchestrator: "Vanguard_Bedrock_Compiler",
                theme: industryTheme,
                tasks: dispatchedJobs
            },
            uiDirective: "POLL_BEDROCK_STATUS" 
        };

    } catch (err: any) {
        console.error("[BedrockLumaExecutor] Execution error. Rolling back credits:", err.message);
        try {
            await client.models.UserProfile.update({ 
                id: userProfile.id, 
                computeCredits: originalBalance 
            });
        } catch (rollbackErr) {
            console.error("FATAL: Credit rollback failed", rollbackErr);
        }

        return { error: `Bedrock Presentation Engine Error: ${err.message}. Credits have been refunded.` };
    }
};