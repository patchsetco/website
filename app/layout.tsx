import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Patchset Company',
  description: 'A software company',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="root">
          {children}
        </div>
      </body>
    </html>
  );
}
