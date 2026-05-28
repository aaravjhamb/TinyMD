'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '../lib/types';

export default function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const initials = ((user.first_name?.[0] || user.email?.[0] || '?') + (user.last_name?.[0] || '')).toUpperCase();
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'You';

  return (
    <div className="user-menu" ref={wrap}>
      <button className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <span className="avatar">{initials}</span>
      </button>
      {open && (
        <div className="user-popover" role="menu">
          <div className="user-popover-head">
            <div className="user-popover-name">{displayName}</div>
            {user.email && <div className="user-popover-email">{user.email}</div>}
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="user-popover-action">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
