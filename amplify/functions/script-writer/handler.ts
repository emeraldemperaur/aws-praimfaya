import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bedrock = new BedrockRuntimeClient({});
const s3 = new S3Client({});

export const handler = async (event: any) => {
    const { topic, targetDurationMinutes, totalClipsToGenerate, outputBucket, style } = event;
    const safeClipsCount = Math.min(totalClipsToGenerate, 150);
    const systemPrompt = `You are a Hollywood director. The user wants a ${targetDurationMinutes}-minute video about: "${topic}". Style: ${style}.
    Write a continuous voiceover script (roughly ${safeClipsCount * 12} words).
    Then, describe ${safeClipsCount} sequential visual scenes (5 seconds each) that match the script.
    Respond ONLY in this strict JSON format:
    {
        "voiceoverText": "Full narration text here...",
        "scenes": [
            { "prompt": "Visual description for scene 1..." },
            { "prompt": "Visual description for scene 2..." }
        ]
    }`;

    const bedrockRes = await bedrock.send(new InvokeModelCommand({
        modelId: process.env.MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
            messages: [{ role: "user", content: [{ text: systemPrompt }] }],
            inferenceConfig: { temperature: 0.7, maxTokens: 4000 }
        })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockRes.body));
    let rawText = responseBody.output.message.content[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const generatedData = JSON.parse(rawText);
    const sfnMapArray = generatedData.scenes.slice(0, safeClipsCount).map((scene: any, index: number) => ({
        sceneId: `scene-${String(index).padStart(3, '0')}.mp4`,
        prompt: scene.prompt
    }));

    const mapArrayKey = `orchestration/map-inputs/scenes-${Date.now()}.json`;
    await s3.send(new PutObjectCommand({
        Bucket: outputBucket,
        Key: mapArrayKey,
        Body: JSON.stringify(sfnMapArray),
        ContentType: "application/json"
    }));

    const mediaConvertInputs = sfnMapArray.map((scene: any) => ({
        FileInput: `s3://${outputBucket}/video-renders/scenes/${scene.sceneId}`
    }));

    return {
        FullScriptText: generatedData.voiceoverText,
        SceneArrayS3Key: mapArrayKey,
        MediaConvertInputArray: mediaConvertInputs
    };
};