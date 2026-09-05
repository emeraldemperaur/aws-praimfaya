import { ToolExecutionContext } from './types';
import { QAExecutor, TestExecutionIntent } from './qa-executor'; // (The class from earlier)

export const executeVanguardQA = async ({ toolInput, ephemeralSecrets, env }: ToolExecutionContext) => {
    try {
        const jiraToken = ephemeralSecrets.atlassianToken || env.JIRA_API_TOKEN;
        const jiraEmail = ephemeralSecrets.atlassianEmail || env.JIRA_USER_EMAIL;
        const jiraBaseUrl = ephemeralSecrets.atlassianDomain 
            ? `https://${ephemeralSecrets.atlassianDomain}.atlassian.net`
            : env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';

        const executor = new QAExecutor(jiraBaseUrl, jiraToken, jiraEmail);

        const intent: TestExecutionIntent = {
            taskId: toolInput.taskId,
            jiraTicketKey: toolInput.jiraTicketKey,
            platform: toolInput.platform,
            gridUrl: toolInput.gridUrl,
            targetUrlOrApp: toolInput.targetUrlOrApp,
            actions: toolInput.actions,
            timeoutMs: toolInput.timeoutMs || 15000
        };

        const report = await executor.executeTask(intent);
        if (report.status === 'FAILED') {
            return { 
                status: "Failed", 
                message: "QA execution failed on one or more steps.", 
                report 
            };
        }

        return { 
            status: "Success", 
            message: `QA execution completed with status: ${report.status}`, 
            report 
        };

    } catch (err: any) {
        return { error: `Vanguard QA Engine Error: ${err.message}` };
    }
};