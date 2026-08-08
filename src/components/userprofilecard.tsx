import React, { useState } from 'react';
import '../styles/userprofilecard.scss';

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
  onSubscribe?: () => Promise<void>;
  onCancelSubscription?: () => Promise<void>;
  onRenewSubscription?: () => Promise<void>;
  onTopUpCredits?: () => Promise<void>;
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
  onSubscribe,
  onCancelSubscription,
  onRenewSubscription,
  onTopUpCredits
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const initials = getInitials(username);

  const handleAction = async (action?: () => Promise<void>) => {
    if (!action) return;
    setIsProcessing(true);
    try {
      await action();
    } catch (error) {
      console.error('Stripe API error:', error);
    } finally {
      setIsProcessing(false);
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
            <div className="subscription-content">
              <div>
                <dt className="profile-detail-label mb-small">Subscription Plan</dt>
                {subscription.status === 'none' ? (
                  <dd className="profile-detail-value font-medium">Free Tier (Read-Only)</dd>
                ) : (
                  <dd className="profile-detail-value font-medium" style={{ fontFamily: 'Bodoni Moda Variable', fontSize: '1.2rem' }}>
                    {subscription.planName}
                    <span className={`subscription-status ${subscription.status}`}>
                      {subscription.status.replace('_', ' ')}
                    </span>
                  </dd>
                )}
                
                {subscription.currentPeriodEnd && (
                  <p className="subscription-date" style={{ fontFamily: 'Google Sans Code, monospace' }}>
                    {subscription.status === 'canceled' ? 'Ends on: ' : 'Renews on: '}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>

              <div className="subscription-actions">
                {subscription.status === 'none' && (
                  <button onClick={() => handleAction(onSubscribe)} disabled={isProcessing} className="btn btn-primary" style={{ backgroundColor: '#800020', border: 'none' }}>
                    {isProcessing ? 'Processing...' : 'Subscribe via Stripe'}
                  </button>
                )}
                {subscription.status === 'active' && (
                  <button onClick={() => handleAction(onCancelSubscription)} disabled={isProcessing} className="btn btn-danger" style={{ backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}>
                    {isProcessing ? 'Processing...' : 'Cancel Plan'}
                  </button>
                )}
                {subscription.status === 'canceled' && (
                  <button onClick={() => handleAction(onRenewSubscription)} disabled={isProcessing} className="btn btn-secondary">
                    {isProcessing ? 'Processing...' : 'Renew Plan'}
                  </button>
                )}
                {subscription.status === 'past_due' && (
                  <button onClick={() => handleAction(onSubscribe)} disabled={isProcessing} className="btn btn-danger-solid">
                    {isProcessing ? 'Processing...' : 'Update Payment Method'}
                  </button>
                )}
              </div>
            </div>

            {subscription.status === 'active' && (
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    {isLowCredits ? '⚠️ Running low on synthesis credits.' : 'Credits reset at the end of your billing cycle.'}
                  </span>
                  <button 
                    onClick={() => handleAction(onTopUpCredits)} 
                    disabled={isProcessing}
                    style={{ 
                      padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', 
                      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Bodoni Moda Variable'
                    }}
                  >
                    Top Up Credits
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