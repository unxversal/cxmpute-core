"use client";

import React from 'react';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import type { AuthenticatedUserSubject } from '@/lib/auth';

interface PricingManagerProps {
  subject: AuthenticatedUserSubject['properties'];
}

const PricingManager: React.FC<PricingManagerProps> = ({ subject }) => {
  return (
    <div>
      <ThemeCard title="Pricing & Fee Management">
        <p>Pricing management functionality coming soon...</p>
        <p>Admin: {subject.email}</p>
      </ThemeCard>
    </div>
  );
};

export default PricingManager; 