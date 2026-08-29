export interface ToolExecutionContext {
    toolInput: any;
    ephemeralSecrets: Record<string, string>;
    profile: any;
    cognitoUserId: string;
    sessionId: string;
    citations: any[];
    clients: {
        s3: any;
        polly: any;
        bedrockRuntime: any;
        dynamodb: any;
        lambda: any;
    };
    env: Record<string, string>;
}

export type ToolExecutor = (context: ToolExecutionContext) => Promise<any>;