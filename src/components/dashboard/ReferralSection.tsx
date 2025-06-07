'use client';

import { useState, useEffect } from 'react';
import styles from './ReferralSection.module.css';

interface ReferralSectionProps {
  userId: string;
  userType: 'user' | 'provider';
  hasReferrer?: boolean; // Whether user already has a referrer
}

interface ReferralCodeData {
  referralCode: string;
  totalReferrals: number;
  totalRewards: number;
}

export default function ReferralSection({ userId, userType, hasReferrer = false }: ReferralSectionProps) {
  const [myReferralCode, setMyReferralCode] = useState<string>('');
  const [enterReferralCode, setEnterReferralCode] = useState<string>('');
  const [isLoadingMyCode, setIsLoadingMyCode] = useState(false);
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showEnterCode, setShowEnterCode] = useState(!hasReferrer);

  // Generate/get user's own referral code
  const generateMyReferralCode = async () => {
    setIsLoadingMyCode(true);
    setError('');
    
    try {
      const response = await fetch('/api/referrals/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userType
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMyReferralCode(data.referralCode);
        setMessage('Your referral code is ready to share!');
      } else {
        setError(data.error || 'Failed to generate referral code');
      }
    } catch (err) {
      setError('Failed to generate referral code');
    } finally {
      setIsLoadingMyCode(false);
    }
  };

  // Submit someone else's referral code
  const submitReferralCode = async () => {
    if (!enterReferralCode.trim()) {
      setError('Please enter a referral code');
      return;
    }
    
    setIsSubmittingReferral(true);
    setError('');
    
    try {
      const response = await fetch('/api/referrals/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referralCode: enterReferralCode.trim(),
          refereeId: userId,
          refereeType: userType
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('Referral code applied successfully! You and your referrer will earn bonus points.');
        setShowEnterCode(false); // Hide the input once successfully applied
      } else {
        setError(data.error || 'Failed to apply referral code');
      }
    } catch (err) {
      setError('Failed to apply referral code');
    } finally {
      setIsSubmittingReferral(false);
    }
  };

  // Copy referral code to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(myReferralCode);
      setMessage('Referral code copied to clipboard!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Load user's referral code on component mount
  useEffect(() => {
    generateMyReferralCode();
  }, []);

  return (
    <div className={styles.referralSection}>
      <h3 className={styles.title}>Referral Rewards</h3>
      
      {/* Show referral code entry if user doesn't have a referrer */}
      {showEnterCode && (
        <div className={styles.enterCodeSection}>
          <h4 className={styles.subtitle}>Enter Referral Code</h4>
          <p className={styles.description}>
            Have a referral code? Enter it below to earn bonus points for both you and your referrer!
          </p>
          
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={enterReferralCode}
              onChange={(e) => setEnterReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter referral code (e.g., ALEX-8F2D9)"
              className={styles.referralInput}
              maxLength={20}
            />
            <button
              onClick={submitReferralCode}
              disabled={isSubmittingReferral || !enterReferralCode.trim()}
              className={styles.submitButton}
            >
              {isSubmittingReferral ? 'Applying...' : 'Apply Code'}
            </button>
          </div>
        </div>
      )}

      {/* Show user's own referral code */}
      <div className={styles.myCodeSection}>
        <h4 className={styles.subtitle}>Your Referral Code</h4>
        <p className={styles.description}>
          Share your code with friends to earn bonus points when they join and become active!
        </p>
        
        {myReferralCode ? (
          <div className={styles.codeDisplay}>
            <div className={styles.codeBox}>
              <span className={styles.code}>{myReferralCode}</span>
              <button 
                onClick={copyToClipboard}
                className={styles.copyButton}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
            
            <div className={styles.rewardInfo}>
              <p>
                <strong>Rewards:</strong> Earn {userType === 'provider' ? '20%' : '100 points'} when someone you refer becomes active, 
                plus additional bonuses for their ongoing activity!
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={generateMyReferralCode}
            disabled={isLoadingMyCode}
            className={styles.generateButton}
          >
            {isLoadingMyCode ? 'Generating...' : 'Generate My Referral Code'}
          </button>
        )}
      </div>

      {/* Messages */}
      {message && <div className={styles.successMessage}>{message}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      {/* Referral Program Info */}
      <div className={styles.infoSection}>
        <h4 className={styles.subtitle}>How Referrals Work</h4>
        <ul className={styles.infoList}>
          <li>Share your referral code with friends</li>
          <li>They enter your code when signing up</li>
          <li>You both earn bonus points when they become active</li>
          <li>You continue earning a percentage of their points for the first month</li>
          <li>Build referral chains up to 3 levels deep for maximum rewards</li>
        </ul>
      </div>
    </div>
  );
} 