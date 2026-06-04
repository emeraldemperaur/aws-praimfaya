import { useEffect } from "react";
import TitleRibbon from "../components/titleribbon";
import { UserProfileCard, type SubscriptionDetails } from "../components/userprofilecard";
import { usePraimfaya } from "../contexts";
import { getPermissions } from "../utils/asimov";

const UserProfile = ({ darkMode }: { darkMode: boolean }) => {
  const { logUser, logKey, userGroups } = usePraimfaya();
  
  const adminRoles = ['admin', 'superadmin', 'root', 'heda'];
  const highestRole = userGroups.find(group => adminRoles.includes(group));
  const isAdmin = !!highestRole;

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  const initUser = {
    username: logUser ? logUser.split('@')[0] : 'John Doe',
    email: logUser || 'john.doe@example.com',
    isVerified: logKey === 'verified',
    role: isAdmin ? `Administrator::${highestRole}` : userGroups[0] || 'User',
    permissions: getPermissions(userGroups),
  };

  const mockSubscription: SubscriptionDetails = {
    status: 'active',
    planName: 'Pro Tier',
    currentPeriodEnd: '2026-06-15T00:00:00.000Z',
  };

  const handleStripeSubscribe = async () => {
    console.log('Initiating checkout session...');
    // Example: const session = await api.createStripeCheckout();
    // window.location.href = session.url;
    await new Promise((resolve) => setTimeout(resolve, 1500)); 
  };

  const handleStripeCancel = async () => {
    console.log('Canceling subscription at period end...');
    // Example: await api.cancelStripeSubscription();
    await new Promise((resolve) => setTimeout(resolve, 1500)); 
  };

  const handleStripeRenew = async () => {
    console.log('Renewing subscription...');
    // Example: await api.resumeStripeSubscription();
    await new Promise((resolve) => setTimeout(resolve, 1500)); 
  };

  return (
    <>
      <div className="page-layout">
        
        <TitleRibbon 
          title="User Profile" 
          darkMode={darkMode} 
          typewriterFX 
          textAlignment="right"
        /> 
        
        <div className="card-center-container">
          <UserProfileCard 
            username={initUser.username}
            email={initUser.email}
            isVerified={initUser.isVerified}
            role={initUser.role}
            permissions={initUser.permissions}
            subscription={mockSubscription}
            onSubscribe={handleStripeSubscribe}
            onCancelSubscription={handleStripeCancel}
            onRenewSubscription={handleStripeRenew}
            darkMode={darkMode}
          />
        </div> 

      </div>
    </>
  );
};

export default UserProfile;