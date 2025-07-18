import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './Providers'; // Import the new client-side providers

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cxmpute',
  description: 'The DePIN for AI Inference',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
