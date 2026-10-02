import React, { useState } from 'react';
import '../styles/userprofilecard.scss';
import { formatPlanName } from '../utils/voltaire';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none';

export interface SubscriptionDetails {
  status: SubscriptionStatus;
  planName?: string;
  currentPeriodEnd?: string;
  computeCredits?: number; 
  maxCredits?: number;     
}

export interface UserProfileCardProps {
  username: string;
  email: string;
  isVerified: boolean;
  role: string;
  permissions: string[];
  subscription: SubscriptionDetails;
  darkMode?: boolean; 
  isLoading?: boolean;
  onSubscribeVanguard?: () => Promise<void>;
  onSubscribeElite?: () => Promise<void>;
  onCancelSubscription?: () => Promise<void>;
  onRenewSubscription?: () => Promise<void>;
  onTopUpCredits?: () => Promise<void>;
  onUpdatePayment?: () => Promise<void>; 
}

const getInitials = (name: string) => {
  const parts = name.split(/[\s._-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  username,
  email,
  isVerified,
  role,
  permissions,
  subscription,
  darkMode = false,
  isLoading = false,
  onSubscribeVanguard,
  onSubscribeElite,
  onCancelSubscription,
  onRenewSubscription,
  onTopUpCredits,
  onUpdatePayment
}) => {
  const [isProcessingVanguard, setIsProcessingVanguard] = useState(false);
  const [isProcessingElite, setIsProcessingElite] = useState(false);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [isProcessingRenew, setIsProcessingRenew] = useState(false);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  const initials = getInitials(username);

  const handleIsolatedAction = async (
    action: (() => Promise<void>) | undefined, 
    setLoadingState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!action) return;
    
    setLoadingState(true);
    try {
      await action();
    } catch (error) {
      console.error('Stripe API error:', error);
    } finally {
      setTimeout(() => {
        setLoadingState(false);
      }, 2000); 
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const safeComputeCredits = subscription.computeCredits ?? 0;
  const safeMaxCredits = subscription.maxCredits ?? 1;
  const creditPercentage = Math.min(100, Math.max(0, (safeComputeCredits / safeMaxCredits) * 100));
  const isLowCredits = safeComputeCredits < (safeMaxCredits * 0.15);
  const isActivePeriod = subscription.status === 'active' || 
    (subscription.status === 'canceled' && !!subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > new Date());

  const isAnyProcessing = isProcessingVanguard || isProcessingElite || isProcessingCancel || isProcessingRenew || isProcessingUpdate || isProcessingTopUp;

  return (
    <div className={`profile-card ${darkMode ? 'dark' : ''}`}>
      
      <div className="profile-card-left">
        <div className="profile-avatar" style={{ backgroundColor: '#800020' }}>{initials}</div>
        <h2 className="profile-username" style={{ fontFamily: 'Bodoni Moda Variable' }}>{username}</h2>
        <p className="profile-subtitle" style={{ fontFamily: 'Google Sans Code, monospace' }}>Cognito User</p>
      </div>

      <div className="profile-card-right">
        <h3 className="profile-section-title" style={{ fontFamily: 'Bodoni Moda Variable' }}>Profile Details</h3>
        
        <dl className="profile-details-grid">
          
          <div className="profile-detail-full flex-between">
            <div>
              <dt className="profile-detail-label">Email Address</dt>
              <dd className="profile-detail-value">{email}</dd>
            </div>
            <div>
              <span className={`status-badge ${isVerified ? 'verified' : 'unverified'}`}>
                {isVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>

          <div>
            <dt className="profile-detail-label">Role</dt>
            <dd className="profile-detail-value capitalize">{role}</dd>
          </div>

          <div>
            <dt className="profile-detail-label mb-small">Permissions</dt>
            <dd className="permissions-list">
              {permissions.map((perm) => (
                <span key={perm} className="permission-badge">{perm}</span>
              ))}
              {permissions.length === 0 && (
                <span className="text-muted italic">None</span>
              )}
            </dd>
          </div>

          <div className="profile-detail-full subscription-section">
            <div className="subscription-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              
              <div style={{ flex: '1 1 auto', minWidth: 'max-content' }}>
                <dt className="profile-detail-label mb-small">Subscription Plan</dt>
                {isLoading ? (
                  <div style={{ height: '24px', width: '120px', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                ) : subscription.status === 'none' ? (
                  <dd className="profile-detail-value font-medium" style={{ whiteSpace: 'nowrap' }}>No Subscription</dd>
                ) : (
                  <dd className="profile-detail-value font-medium" style={{ fontFamily: 'Bodoni Moda Variable', fontSize: '1.2rem', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {formatPlanName(subscription.planName)}
                    <span className={`subscription-status ${subscription.status}`} style={{ marginLeft: '0.5rem' }}>
                      {subscription.status
                        .replace('_', ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                  </span>
                  </dd>
                )}
                
                {!isLoading && subscription.currentPeriodEnd && (
                  <p className="subscription-date" style={{ fontFamily: 'Google Sans Code, monospace', whiteSpace: 'nowrap', marginTop: '0.25rem' }}>
                    {subscription.status === 'canceled' ? 'Ends on: ' : 'Renews on: '}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>

              <div className="subscription-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: '0 0 auto', minWidth: '240px' }}>
                {isLoading && (
                   <>
                     <div style={{ height: '38px', width: '100%', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                     <div style={{ height: '38px', width: '100%', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '4px', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                   </>
                )}
                
                {!isLoading && subscription.status === 'none' && (
                  <>
                    <button 
                      onClick={() => handleIsolatedAction(onSubscribeVanguard, setIsProcessingVanguard)} 
                      disabled={isAnyProcessing} 
                      className="btn btn-primary" 
                      style={{ 
                        backgroundColor: '#800020', border: 'none', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
                        opacity: isAnyProcessing && !isProcessingVanguard ? 0.5 : 1
                      }}
                    >
                      {isProcessingVanguard ? 'Processing...' : 'Buy Vanguard Pro | $69 USD / month'}
                    </button>
                    
                    <button 
                      onClick={() => handleIsolatedAction(onSubscribeElite, setIsProcessingElite)} 
                      disabled={isAnyProcessing} 
                      className="btn btn-primary" 
                      style={{ 
                        backgroundColor: '#2563eb', border: 'none', width: '100%', textAlign: 'left', whiteSpace: 'nowrap',
                        opacity: isAnyProcessing && !isProcessingElite ? 0.5 : 1
                      }}
                    >
                      {isProcessingElite ? 'Processing...' : 'Buy Vanguard Elite | $169 USD / month'}
                    </button>
                    
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280', textAlign: 'left', marginTop: '-0.25rem' }}>
                      Pricing is localized to region at checkout.
                    </span>
                  </>
                )}
                
                {!isLoading && subscription.status === 'active' && (
                  <button 
                    onClick={() => handleIsolatedAction(onCancelSubscription, setIsProcessingCancel)} 
                    disabled={isAnyProcessing} 
                    className="btn btn-danger" 
                    style={{ 
                      backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', width: '100%', textAlign: 'center',
                      opacity: isAnyProcessing && !isProcessingCancel ? 0.5 : 1
                    }}
                  >
                    {isProcessingCancel ? 'Processing...' : 'Manage / Cancel Plan'}
                  </button>
                )}
                
                {!isLoading && subscription.status === 'canceled' && (
                  <button 
                    onClick={() => handleIsolatedAction(onRenewSubscription, setIsProcessingRenew)} 
                    disabled={isAnyProcessing} 
                    className="btn btn-secondary" 
                    style={{ 
                      width: '100%', textAlign: 'center',
                      opacity: isAnyProcessing && !isProcessingRenew ? 0.5 : 1
                    }}
                  >
                    {isProcessingRenew ? 'Processing...' : 'Renew Plan'}
                  </button>
                )}
                
                {!isLoading && subscription.status === 'past_due' && (
                  <button 
                    onClick={() => handleIsolatedAction(onUpdatePayment, setIsProcessingUpdate)} 
                    disabled={isAnyProcessing} 
                    className="btn btn-danger-solid" 
                    style={{ 
                      width: '100%', textAlign: 'center',
                      opacity: isAnyProcessing && !isProcessingUpdate ? 0.5 : 1
                    }}
                  >
                    {isProcessingUpdate ? 'Processing...' : 'Update Payment Method'}
                  </button>
                )}
              </div>
            </div>

            {!isLoading && isActivePeriod && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                  <dt className="profile-detail-label">Compute Credits</dt>
                  <span style={{ fontFamily: 'Google Sans Code, monospace', fontSize: '0.875rem', color: isLowCredits ? '#ef4444' : (darkMode ? '#10b981' : '#059669'), fontWeight: 600 }}>
                    {safeComputeCredits.toLocaleString()} / {safeMaxCredits.toLocaleString()}
                  </span>
                </div>
                
                <div style={{ width: '100%', height: '8px', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '1rem' }}>
                  <div style={{ 
                    height: '100%', width: `${creditPercentage}%`, 
                    backgroundColor: isLowCredits ? '#ef4444' : '#800020', 
                    transition: 'width 0.5s ease-out' 
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    {isLowCredits ? '⚠️ Running low on synthesis credits.' : 'Credits reset at the end of your billing cycle.'}
                  </span>
                  <button 
                    onClick={() => handleIsolatedAction(onTopUpCredits, setIsProcessingTopUp)} 
                    disabled={isAnyProcessing}
                    style={{ 
                      padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', 
                      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Bodoni Moda Variable',
                      whiteSpace: 'nowrap', 
                      opacity: isAnyProcessing && !isProcessingTopUp ? 0.5 : 1
                    }}
                  >
                    {isProcessingTopUp ? 'Processing...' : 'Top Up Credits'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </dl>
      </div>
    </div>
  );
};