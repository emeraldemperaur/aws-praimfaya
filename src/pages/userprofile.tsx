import { useEffect, useState } from "react";
import TitleRibbon from "../components/titleribbon";
import { UserProfileCard, type SubscriptionDetails } from "../components/userprofilecard";
import { usePraimfaya } from "../contexts";
import { getPermissions } from "../utils/asimov";
import { generateClient } from "aws-amplify/data"; // Fixed import
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from '../../amplify/data/resource'; // Added schema typing

const client = generateClient<Schema>();

const UserProfile = ({ darkMode }: { darkMode: boolean }) => {
  const { logUser, logKey, userGroups } = usePraimfaya();

  const [dbProfile, setDbProfile] = useState<Schema['UserProfile']['type'] | null>(null);

  const adminRoles = ['admin', 'superadmin', 'root', 'heda'];
  const highestRole = userGroups.find(group => adminRoles.includes(group));
  const isAdmin = !!highestRole;

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  useEffect(() => {
    let sub: any;

    const fetchProfile = async () => {
      try {
        const { userId } = await getCurrentUser();

        sub = client.models.UserProfile.observeQuery({
          filter: {
            cognitoUserId: { eq: userId }
          }
        }).subscribe({
          next: (data) => {
            if (data.items && data.items.length > 0) {
              setDbProfile(data.items[0]);
            } else {
              console.log("No backend UserProfile found for this user yet.");
            }
          },
          error: (err) => console.error("Error observing live user profile:", err)
        });

      } catch (err) {
        console.error("Error fetching live user profile:", err);
      }
    };
    fetchProfile();

    return () => {
      if (sub) sub.unsubscribe();
    }
  }, []);

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
    currentPeriodEnd: dbProfile?.currentPeriodEnd || undefined,
    computeCredits: dbProfile?.computeCredits ?? 0,
    maxCredits: dbProfile?.maxCredits ?? 1,
  };

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
    await new Promise((resolve) => setTimeout(resolve, 1500)); 
  };

  const handleStripeRenew = async () => {
    console.log('Renewing subscription...');
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