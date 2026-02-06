import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import ProtectedLayout from '@/components/ProtectedLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Starfish AI — Custom AI Employees for Small Business',
    template: '%s | Starfish AI',
  },
  description:
    'Custom AI agent teams that handle outbound marketing, customer engagement, and content creation 24/7. Multi-agent orchestration platform for small business.',
  keywords: [
    'AI agents',
    'AI employees',
    'small business automation',
    'outbound marketing AI',
    'multi-agent orchestration',
    'AI agent platform',
    'autonomous AI workers',
    'business automation',
    'AI-powered marketing',
    'custom AI agents',
    'AI content creation',
    'Telegram bot agents',
    'Reddit automation',
    'email outreach AI',
    'social media AI',
  ],
  authors: [{ name: 'EntreArtists', url: 'https://entreartists.com' }],
  creator: 'EntreArtists',
  metadataBase: new URL('https://bigstarfish.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://bigstarfish.com',
    siteName: 'Starfish AI',
    title: 'Starfish AI — Custom AI Employees for Small Business',
    description:
      'Deploy teams of AI agents that handle outbound marketing, content creation, and customer engagement around the clock.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Starfish AI — AI Employees for Small Business',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Starfish AI — Custom AI Employees for Small Business',
    description:
      'Deploy teams of AI agents that handle outbound marketing, content creation, and customer engagement 24/7.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-900 text-slate-50`}>
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
