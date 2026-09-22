import { 
    CognitoIdentityProviderClient, 
    AdminAddUserToGroupCommand, 
    AdminRemoveUserFromGroupCommand, 
    AdminListGroupsForUserCommand 
} from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from '../../data/resource';

const cognitoClient = new CognitoIdentityProviderClient();

const VALID_GROUPS = ['superadmin', 'root', 'admin', 'heda', 'user', 'standard'];

const BASE_USER_ROLES = ['standard', 'user']; 

export const handler: Schema["updateUserGroup"]["functionHandler"] = async (event) => {
    const { targetCognitoUserId, groupName } = event.arguments;
    const userPoolId = process.env.USER_POOL_ID;

    if (!userPoolId) throw new Error("CRITICAL: USER_POOL_ID environment variable is missing.");
    
    if (!VALID_GROUPS.includes(groupName)) {
        console.error(`[Vanguard] Invalid group elevation attempted: ${groupName}`);
        throw new Error("Invalid identity group requested.");
    }

    try {
        const listCmd = new AdminListGroupsForUserCommand({
            UserPoolId: userPoolId,
            Username: targetCognitoUserId
        });
        const { Groups } = await cognitoClient.send(listCmd);
        const existingGroupNames = Groups?.map(g => g.GroupName as string) || [];
        const groupsToRemove = existingGroupNames.filter(gName => gName !== groupName);
        
        if (groupsToRemove.length > 0) {
            await Promise.all(groupsToRemove.map(gName => 
                cognitoClient.send(new AdminRemoveUserFromGroupCommand({
                    UserPoolId: userPoolId,
                    Username: targetCognitoUserId,
                    GroupName: gName
                }))
            ));
        }

        if (!BASE_USER_ROLES.includes(groupName) && !existingGroupNames.includes(groupName)) {
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