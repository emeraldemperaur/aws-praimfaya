import { useEffect, useState } from "react";
import TitleRibbon from "../components/titleribbon";
import { UserProfileCard, type SubscriptionDetails } from "../components/userprofilecard";
import BottomRightModal from "../components/bottomrightmodal";
import { usePraimfaya } from "../contexts";
import { getPermissions } from "../utils/asimov";
import { showToast } from "../utils/toastService"; 
import { generateClient } from "aws-amplify/data"; 
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from '../../amplify/data/resource'; 

const client = generateClient<Schema>();

const UserProfile = ({ darkMode }: { darkMode: boolean }) => {
  const { logUser, logKey, userGroups } = usePraimfaya();
  const [dbProfile, setDbProfile] = useState<Schema['UserProfile']['type'] | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
            setIsLoading(false);
          },
          error: (err) => {
            console.error("Error observing live user profile:", err);
            setIsLoading(false);
          }
        });

      } catch (err) {
        console.error("Error fetching live user profile:", err);
        setIsLoading(false);
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
      
      if (response.errors && response.errors.length > 0) {
        console.error("AppSync returned errors:", response.errors);
        setErrorMessage(response.errors[0].message || "Server rejected the checkout request.");
        setIsErrorModalOpen(true);
        return;
      }

      if (response.data) {
        let targetUrl = response.data;
        try {
          const parsed = JSON.parse(response.data);
          if (parsed.url) targetUrl = parsed.url;
        } catch (e) { 
        }

        console.log("Redirecting to Stripe:", targetUrl);
        
        showToast.success("Redirecting to secure Stripe Checkout...");
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 800);

      } else {
        console.warn("Mutation succeeded but returned no data.");
      }
    } catch (error) {
      console.error("Failed to launch Stripe checkout session:", error);
      setErrorMessage("Failed to initiate secure checkout. Please verify your connection.");
      setIsErrorModalOpen(true);
    }
  };

  const handlePortalRedirect = async () => {
    try {
      console.log('Generating secure Stripe Portal link...');
      const response = await client.mutations.createPortalSession();
      
      if (response.errors && response.errors.length > 0) {
        console.error("AppSync returned errors:", response.errors);
        setErrorMessage(response.errors[0].message || "Server rejected the portal request.");
        setIsErrorModalOpen(true);
        return;
      }
      
      if (response.data) {
        let targetUrl = response.data;
        try {
          const parsed = JSON.parse(response.data);
          if (parsed.url) targetUrl = parsed.url;
        } catch (e) { 
        }
        
        showToast.success("Redirecting to Stripe Billing Portal...");
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 800);

      } else {
        setErrorMessage("Failed to reach the billing portal. Please contact support.");
        setIsErrorModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to generate Stripe Customer Portal session:", error);
      setErrorMessage("An unexpected network error occurred while reaching the billing portal.");
      setIsErrorModalOpen(true);
    }
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
            isLoading={isLoading} // FIX: Pass isLoading prop to the card
            onSubscribeVanguard={() => handleCheckout('VANGUARD')}
            onSubscribeElite={() => handleCheckout('VANGUARD_ELITE')}
            onTopUpCredits={() => handleCheckout('TOP_UP')}
            onCancelSubscription={handlePortalRedirect}
            onRenewSubscription={handlePortalRedirect}
            onUpdatePayment={handlePortalRedirect}
            darkMode={darkMode}
          />
        </div> 
      </div>

      <BottomRightModal 
        isOpen={isErrorModalOpen} 
        onClose={() => setIsErrorModalOpen(false)} 
        title="Billing Action Failed" 
        darkMode={darkMode}
      >
        <div style={{ 
          padding: '1.5rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          fontFamily: 'Google Sans Code, monospace',
          color: darkMode ? '#9e0f33' : '#800020'
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.5rem' }}></i>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
            {errorMessage}
          </p>
        </div>
      </BottomRightModal>
    </>
  );
};

export default UserProfile;