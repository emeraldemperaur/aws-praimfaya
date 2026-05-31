import { useEffect } from "react";
import TitleRibbon from "../components/titleribbon";
import { UserProfileCard, type SubscriptionDetails } from "../components/userprofilecard";

const UserProfile = ({ darkMode }: { darkMode: boolean }) => {
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  const mockUser = {
    username: 'jane.smith',
    email: 'jane.smith@example.com',
    isVerified: true,
    role: 'administrator',
    permissions: ['read:data', 'write:data', 'delete:data'],
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
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network request
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
      
      {/* This sits at the top and takes up its natural height */}
      <TitleRibbon 
        title="User Profile" 
        darkMode={darkMode} 
        typewriterFX 
        textAlignment="right"
      /> 
      
      {/* This fills the remaining height and centers the card inside it */}
      <div className="card-center-container">
        <UserProfileCard 
          username={mockUser.username}
          email={mockUser.email}
          isVerified={mockUser.isVerified}
          role={mockUser.role}
          permissions={mockUser.permissions}
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