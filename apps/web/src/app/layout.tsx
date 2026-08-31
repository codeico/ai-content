import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'AI Content',
  description: 'AI Multi-Account Content Automation Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
