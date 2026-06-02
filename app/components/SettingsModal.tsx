'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  initialKey: string;
  onClose: () => void;
  onSave: (key: string) => Promise<void> | void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export default function SettingsModal({ open, initialKey, onClose, onSave, onToast }: Props) {
  const [keyInput, setKeyInput] = useState(initialKey);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKeyInput(initialKey);
    }
  }, [open, initialKey]);

  if (!open) return null;

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
            <span>CDN API key</span>
            <input
              type="password"
              placeholder="Bearer key…"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <small>
              Saved to your account. Used to upload images to the cdn.
            </small>
          </label>

          <div className="modal-actions">
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
