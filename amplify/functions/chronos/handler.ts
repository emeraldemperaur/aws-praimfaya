import type { Handler } from "aws-lambda";

export const handler: Handler = async (event, context) => {
    const { name } = event.arguments || {};
    console.log("Received event:", JSON.stringify(event, null, 2));
    return `Executing Function: ${name} at ${new Date().toISOString()}`;
};