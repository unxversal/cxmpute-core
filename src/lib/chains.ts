import { type Chain } from 'viem';

export const peaq = {
  id: 3338,
  name: 'peaq',
  nativeCurrency: { name: 'PEAQ', symbol: 'PEAQ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://peaq-rpc.publicnode.com'] },
    public: { http: ['https://peaq-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Subscan', url: 'https://peaq.subscan.io' },
  },
} as const satisfies Chain;

export const peaqAgung = {
  id: 9990,
  name: 'agung',
  nativeCurrency: { name: 'AGNG', symbol: 'AGNG', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.agung.peaq.network'] },
    public: { http: ['https://rpc.agung.peaq.network'] },
  },
  blockExplorers: {
    default: { name: 'Subscan', url: 'https://agung.subscan.io' },
  },
  testnet: true,
} as const satisfies Chain; 