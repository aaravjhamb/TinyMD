'use client';

import { useEffect, useState } from 'react';
import { getMe, type CdnMe } from '../lib/cdn';
import { formatBytes } from '../lib/utils';

type Props = {
  open: boolean;
  initialKey: string;
  onClose: () => void;
  onSave: (key: string) => Promise<void> | void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export default function SettingsModal({ open, initialKey, onClose, onSave, onToast }: Props) {
  const [keyInput, setKeyInput] = useState(initialKey);
  const [me, setMe] = useState<CdnMe | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKeyInput(initialKey);
      setMe(null);
    }
  }, [open, initialKey]);

  if (!open) return null;

  const pct = me && me.storage_limit
    ? Math.min(100, (me.storage_used / me.storage_limit) * 100)
    : 0;

  async function test() {
    const k = keyInput.trim();
    if (!k) { onToast('Enter a key first', 'error'); return; }
    try {
      const data = await getMe(k);
      setMe(data);
      onToast(`Connected as ${data.email || 'CDN user'}`, 'success');
    } catch (e: any) {
      onToast(e.message || 'Failed', 'error');
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">Settings</div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Hack Club CDN API key</span>
            <input
              type="password"
              placeholder="sk_cdn_…"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <small>
              Saved to your account. Create one at{' '}
              <a href="https://cdn.hackclub.com/" target="_blank" rel="noopener noreferrer">
                cdn.hackclub.com
              </a>.
            </small>
          </label>

          {me && (
            <div className="quota">
              <div className="quota-row"><span>Account</span><span>{me.email || '-'}</span></div>
              <div className="quota-row"><span>Tier</span><span>{me.quota_tier || '-'}</span></div>
              <div className="quota-bar"><div style={{ width: pct + '%' }} /></div>
              <div className="quota-row">
                <span>{formatBytes(me.storage_used || 0)} used</span>
                <span>{formatBytes(me.storage_limit || 0)} total</span>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="ghost-btn" onClick={test} disabled={saving}>Test key</button>
            <button
              className="primary-btn"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(keyInput.trim());
                  onToast('Settings saved', 'success');
                  onClose();
                } catch (e: any) {
                  onToast(e.message || 'Failed to save', 'error');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
