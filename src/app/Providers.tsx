'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { peaqAgung, peaq } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

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
        <Toaster position="bottom-right" />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 