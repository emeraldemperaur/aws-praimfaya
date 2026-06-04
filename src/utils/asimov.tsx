import { fetchAuthSession } from 'aws-amplify/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';

export const getUserGroups = async (): Promise<string[]> => {
  try {
    const session = await fetchAuthSession();
    const groups = session.tokens?.accessToken?.payload['cognito:groups'];
    
    return (groups as string[]) || [];
  } catch (error) {
    console.error("Failed to fetch user groups:", error);
    return [];
  }
};

export const getPermissions = (groups: string[]): string[] => {
  if (groups.some(group => ['superadmin', 'root', 'heda'].includes(group))) {
    return ['Read: All', 'Write: All', 'Delete: All'];
  }
  if (groups.includes('admin')) {
    return ['Read: All', 'Delete: All'];
  }
  return ['Read: Owner', 'Write: Owner', 'Delete: Owner'];
};

export const getUserEmail = async (): Promise<string> => {
  try {
    const attributes = await fetchUserAttributes();
    const emailAttr = attributes.email
    return emailAttr ? emailAttr : '';
  } catch (error) {
    console.error("Failed to fetch user email:", error);
    return '';
  }  
}; 