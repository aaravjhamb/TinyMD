import type { Metadata } from 'next';
import './globals.css';
import 'highlight.js/styles/atom-one-dark.css';

export const metadata: Metadata = {
  title: 'TinyMD',
  description: 'Journal hardware projects in markdown with a live preview.',
  icons: { icon: 'https://assets.hackclub.com/icon-rounded.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grid-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
