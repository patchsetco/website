import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { CuelumeBind } from './cuelume-bind';
import './globals.css';

const hyperlegibleSans = localFont({
  src: [
    {
      path: './fonts/HyperlegibleSans-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/HyperlegibleSans-Italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/HyperlegibleSans-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/HyperlegibleSans-MediumItalic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: './fonts/HyperlegibleSans-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/HyperlegibleSans-BoldItalic.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-hyperlegible-sans',
  display: 'swap',
});

const siteName = 'Patchset Company';
const description = 'The official site of Patchset Company, a software company.';

function getSiteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://patchset.co');
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description,
  applicationName: siteName,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName,
    title: siteName,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#101010',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hyperlegibleSans.variable}>
      <body className="font-sans antialiased">
        <CuelumeBind />
        <div className="root">{children}</div>
      </body>
    </html>
  );
}
