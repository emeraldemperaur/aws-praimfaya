import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";

const schedulerClient = new SchedulerClient({ region: process.env.AWS_REGION });

export const schedule_future_task = async (context: any) => {
    const { toolInput, profile, cognitoUserId, terminalId, env, userProfile } = context;
    const { taskDescription, scheduledTimeIso } = toolInput; 
    
    const userTimeZone = userProfile?.timeZone || "UTC";

    try {
        await schedulerClient.send(new CreateScheduleCommand({
            Name: `va-task-${Date.now().toString().substring(5)}`,
            ScheduleExpression: `at(${scheduledTimeIso.substring(0, 19)})`, 
            ScheduleExpressionTimezone: userTimeZone,
            FlexibleTimeWindow: { Mode: "OFF" },
            Target: {
                Arn: env.AGENT_WORKER_FUNCTION_ARN!, 
                RoleArn: env.SCHEDULER_ROLE_ARN!,
                Input: JSON.stringify({
                    profileId: profile.id,
                    cognitoUserId: cognitoUserId,
                    terminalId: terminalId,
                    prompt: `[SYSTEM: WAKING FROM SCHEDULED PAUSE] Proceed to execute the following task: ${taskDescription}`,
                    isWakeUpEvent: true
                })
            }
        }));

        return { 
            __END_CURRENT_EXECUTION__: true, 
            message: `Task successfully scheduled for ${scheduledTimeIso} (${userTimeZone}). Agent is going to sleep.` 
        };
    } catch (err: any) {
        return { error: `Failed to schedule task: ${err.message}` };
    }
};