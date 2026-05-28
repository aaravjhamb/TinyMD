import type { Metadata } from 'next';
import './globals.css';
import 'highlight.js/styles/atom-one-dark.css';

export const metadata: Metadata = {
  title: 'TinyMD',
  description: "The journaling software you didn't know you needed :D",
  icons: { icon: '/tinymd-logo-black.png' },
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
