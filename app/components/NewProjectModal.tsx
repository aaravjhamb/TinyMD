'use client';

import { useEffect, useRef, useState } from 'react';
import { loadApiKey } from '../lib/storage';

const COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; color: string; cover_image: string | null }) => void;
  onNeedApiKey?: () => void;
};

export default function NewProjectModal({ open, onClose, onCreate, onNeedApiKey }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('red');
  const [cover, setCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setCover(null);
      setUploadErr(null);
      setUploading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (!open) return null;

  function submit() {
    const n = name.trim();
    if (!n) return;
    onCreate({ name: n, color, cover_image: cover });
  }

  async function handleFile(file: File) {
    const key = loadApiKey();
    if (!key) {
      setUploadErr('Add a Hack Club CDN key in Settings first.');
      onNeedApiKey?.();
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/cdn/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setCover(data.url);
    } catch (e: any) {
      setUploadErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'));
    if (file) handleFile(file);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">New project</div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Macropad v2"
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
          </label>

          <div className="field">
            <span>Cover image <em className="optional">(optional)</em></span>
            <div
              className={'cover-drop' + (cover ? ' has-image' : '') + (uploading ? ' uploading' : '')}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {cover ? (
                <>
                  <img src={cover} alt="" className="cover-preview" />
                  <div className="cover-overlay">
                    <button
                      className="cover-action"
                      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                      disabled={uploading}
                    >
                      Replace
                    </button>
                    <button
                      className="cover-action danger"
                      onClick={(e) => { e.stopPropagation(); setCover(null); }}
                      disabled={uploading}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : uploading ? (
                <div className="cover-empty">
                  <div className="cover-spinner" />
                  Uploading…
                </div>
              ) : (
                <div className="cover-empty">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-5-5L5 21"/>
                  </svg>
                  <div>Drop image, or click to upload</div>
                  <small>Stored on cdn.hackclub.com</small>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {uploadErr && <small className="cover-err">{uploadErr}</small>}
          </div>

          <div className="field">
            <span>Accent</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'swatch swatch-' + c + (c === color ? ' on' : '')}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button className="ghost-btn" onClick={onClose}>Cancel</button>
            <button className="primary-btn" onClick={submit} disabled={!name.trim() || uploading}>
              Create project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
