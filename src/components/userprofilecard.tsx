import React, { useState } from 'react';
import '../styles/userprofilecard.scss';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none';

export interface SubscriptionDetails {
  status: SubscriptionStatus;
  planName?: string;
  currentPeriodEnd?: string;
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

  return (
    <div className={`profile-card ${darkMode ? 'dark' : ''}`}>
      
      <div className="profile-card-left">
        <div className="profile-avatar">{initials}</div>
        <h2 className="profile-username">{username}</h2>
        <p className="profile-subtitle">Cognito User</p>
      </div>

      <div className="profile-card-right">
        <h3 className="profile-section-title">Profile Details</h3>
        
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
                  <dd className="profile-detail-value font-medium">Free Tier</dd>
                ) : (
                  <dd className="profile-detail-value font-medium">
                    {subscription.planName}
                    <span className={`subscription-status ${subscription.status}`}>
                      {subscription.status.replace('_', ' ')}
                    </span>
                  </dd>
                )}
                
                {subscription.currentPeriodEnd && (
                  <p className="subscription-date">
                    {subscription.status === 'canceled' ? 'Ends on: ' : 'Renews on: '}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
              </div>

              <div className="subscription-actions">
                {subscription.status === 'none' && (
                  <button onClick={() => handleAction(onSubscribe)} disabled={isProcessing} className="btn btn-primary">
                    {isProcessing ? 'Processing...' : 'Subscribe'}
                  </button>
                )}
                {subscription.status === 'active' && (
                  <button onClick={() => handleAction(onCancelSubscription)} disabled={isProcessing} className="btn btn-danger">
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
          </div>
        </dl>
      </div>
    </div>
  );
};