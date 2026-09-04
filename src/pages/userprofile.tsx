import { useEffect, useState } from "react";
import TitleRibbon from "../components/titleribbon";
import { UserProfileCard, type SubscriptionDetails } from "../components/userprofilecard";
import { usePraimfaya } from "../contexts";
import { getPermissions } from "../utils/asimov";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser } from "aws-amplify/auth";

const UserProfile = ({ darkMode }: { darkMode: boolean }) => {
  const { logUser, logKey, userGroups } = usePraimfaya();
  const client = generateClient() as any;

  const [dbProfile, setDbProfile] = useState<any>(null);

  const adminRoles = ['admin', 'superadmin', 'root', 'heda'];
  const highestRole = userGroups.find(group => adminRoles.includes(group));
  const isAdmin = !!highestRole;

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { userId } = await getCurrentUser();

        const { data } = await client.models.UserProfile.list({
          filter: {
            cognitoUserId: { eq: userId }
          }
        });

        if (data && data.length > 0) {
          setDbProfile(data[0]);
        } else {
          console.log("No backend UserProfile found for this user yet.");
        }
      } catch (err) {
        console.error("Error fetching live user profile:", err);
      }
    };
    fetchProfile();
  }, [client.models.UserProfile]);

  const initUser = {
    username: logUser ? logUser.split('@')[0] : 'John Doe',
    email: logUser || 'john.doe@example.com',
    isVerified: logKey === 'verified',
    role: isAdmin ? `Administrator::${highestRole}` : userGroups[0] || 'User',
    permissions: getPermissions(userGroups),
  };

  const subscriptionDetails: SubscriptionDetails = {
    status: (dbProfile?.subscriptionStatus?.toLowerCase() as any) || 'none',
    planName: dbProfile?.planName || 'Free Tier',
    currentPeriodEnd: dbProfile?.currentPeriodEnd,
    computeCredits: dbProfile?.computeCredits ?? 0,
    maxCredits: dbProfile?.maxCredits ?? 1,
  };

  // Stripe Checkout Action Handler
  const handleCheckout = async (planTier: 'VANGUARD' | 'VANGUARD_ELITE' | 'TOP_UP') => {
    try {
      console.log(`Initiating checkout session for tier: ${planTier}...`);
      const response = await client.mutations.createCheckoutSession({ planTier });
      if (response.data) {
        window.location.href = response.data; // Redirect to Stripe Checkout
      }
    } catch (error) {
      console.error("Failed to launch Stripe checkout session:", error);
    }
  };

  const handleStripeCancel = async () => {
    console.log('Canceling subscription at period end...');
    // Implement cancel mutation call if linked to backend billing portal
    await new Promise((resolve) => setTimeout(resolve, 1500)); 
  };

  const handleStripeRenew = async () => {
    console.log('Renewing subscription...');
    // Implement renewal routing or checkout redirect
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
            subscription={subscriptionDetails}
            onSubscribeVanguard={() => handleCheckout('VANGUARD')}
            onSubscribeElite={() => handleCheckout('VANGUARD_ELITE')}
            onTopUpCredits={() => handleCheckout('TOP_UP')}
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