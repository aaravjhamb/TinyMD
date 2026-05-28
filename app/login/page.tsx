'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getMe } from '../lib/api';

function LoginInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const error = sp.get('error');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getMe().then(({ user }) => {
      if (user) router.replace('/');
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  if (checking) return <div className="loading">checking session…</div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-panel-left">
          <div className="login-brand-row">
            <img src="/tinymd-logo-white.png" alt="" />
          </div>

          <h2 className="login-pitch">
            The markdown editor you didn't know you needed
          </h2>

          <ul className="login-features">
            <li className="login-feature">
              <span className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>
              </span>
              Markdown editor with slash commands
            </li>
            <li className="login-feature">
              <span className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </span>
              BOMs, pinouts &amp; component cards
            </li>
            <li className="login-feature">
              <span className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-5-5L5 21"/>
                </svg>
              </span>
              CDN integration for photos!
            </li>
          </ul>
        </div>

        <div className="login-panel-right">
          <div className="login-form">
            <h1>Sign in to TinyMD</h1>

            <a className="login-cta" href="/api/auth/login">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Continue with Hack Club
            </a>

            {error && (
              <div className="login-error">
                {error.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading">loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
