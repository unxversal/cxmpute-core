'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { peaqAgung, peaq } from '@/lib/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as HotToaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';

const queryClient = new QueryClient();

const config = createConfig({
  chains: [peaqAgung, peaq],
  transports: {
    [peaqAgung.id]: http(),
    [peaq.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {/* Legacy hot-toast notifications */}
        <HotToaster position="bottom-right" />
        {/* Preferred Sonner toast notifications used by the CAD editor */}
        <SonnerToaster richColors position="bottom-right" />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 