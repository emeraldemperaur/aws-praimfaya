import { 
    CognitoIdentityProviderClient, 
    AdminAddUserToGroupCommand, 
    AdminRemoveUserFromGroupCommand, 
    AdminListGroupsForUserCommand 
} from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from '../../data/resource';

const cognitoClient = new CognitoIdentityProviderClient();

export const handler: Schema["updateUserGroup"]["functionHandler"] = async (event) => {
    const { targetCognitoUserId, groupName } = event.arguments;
    const userPoolId = process.env.USER_POOL_ID;

    if (!userPoolId) throw new Error("CRITICAL: USER_POOL_ID environment variable is missing.");

    try {
        const listCmd = new AdminListGroupsForUserCommand({
            UserPoolId: userPoolId,
            Username: targetCognitoUserId
        });
        const { Groups } = await cognitoClient.send(listCmd);
        const existingGroupNames = Groups?.map(g => g.GroupName) || [];

        for (const gName of existingGroupNames) {
            if (gName !== groupName) {
                await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
                    UserPoolId: userPoolId,
                    Username: targetCognitoUserId,
                    GroupName: gName
                }));
            }
        }

        if (groupName !== 'standard' && !existingGroupNames.includes(groupName)) {
            await cognitoClient.send(new AdminAddUserToGroupCommand({
                UserPoolId: userPoolId,
                Username: targetCognitoUserId,
                GroupName: groupName
            }));
        }

        return true;
    } catch (error) {
        console.error("[Vanguard] Cognito Group Update Failed:", error);
        throw new Error("Failed to update identity group. Review CloudWatch logs for details.");
    }
}