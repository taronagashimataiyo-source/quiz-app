import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Realtime Quiz App',
  description: 'Next.js + Firebase realtime quiz MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
