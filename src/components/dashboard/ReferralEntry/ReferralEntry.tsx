"use client";

import React, { useState } from 'react';
import styles from './ReferralEntry.module.css';
import ThemeCard from '../ThemeCard/ThemeCard';
import DashboardButton from '../DashboardButton/DashboardButton';
import { notify } from '@/components/ui/NotificationToaster/NotificationToaster';
import { Gift } from 'lucide-react';

interface ReferralEntryProps {
  title: string;
  description: string;
  placeholder: string;
  onSubmit: (referralCode: string) => Promise<void>;
  isLoading?: boolean;
}

const ReferralEntry: React.FC<ReferralEntryProps> = ({
  title,
  description,
  placeholder,
  onSubmit,
  isLoading = false
}) => {
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!referralCode.trim()) {
      notify.error('Please enter a referral code');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(referralCode.trim());
      setReferralCode('');
    } catch {
      // Error handling is done in the parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeCard title={title} className={styles.referralCard}>
      <div className={styles.referralContent}>
        <div className={styles.iconWrapper}>
          <Gift size={24} />
        </div>
        <p className={styles.description}>{description}</p>
        <form onSubmit={handleSubmit} className={styles.referralForm}>
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder={placeholder}
            className={styles.referralInput}
            disabled={isSubmitting || isLoading}
          />
          <DashboardButton
            type="submit"
            variant="primary"
            text="Apply Referral"
            isLoading={isSubmitting}
            disabled={isSubmitting || isLoading || !referralCode.trim()}
            iconLeft={<Gift size={16} />}
          />
        </form>
      </div>
    </ThemeCard>
  );
};

export default ReferralEntry; 