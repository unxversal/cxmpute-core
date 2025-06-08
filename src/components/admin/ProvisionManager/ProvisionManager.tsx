"use client";

import React from 'react';
import ThemeCard from '@/components/dashboard/ThemeCard/ThemeCard';
import type { AuthenticatedUserSubject } from '@/lib/auth';

interface ProvisionManagerProps {
  subject: AuthenticatedUserSubject['properties'];
}

const ProvisionManager: React.FC<ProvisionManagerProps> = ({ subject }) => {
  return (
    <div>
      <ThemeCard title="Provision Management">
        <p>Provision management functionality coming soon...</p>
        <p>Admin: {subject.email}</p>
      </ThemeCard>
    </div>
  );
};

export default ProvisionManager; 