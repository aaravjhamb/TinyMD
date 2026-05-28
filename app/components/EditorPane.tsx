'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { SLASH_COMMANDS, type SlashCommand, type SlashAction, flattenCommands } from '../lib/commands';
import { uploadFile } from '../lib/cdn';
import { escapeAlt, escapeHTML, getCaretCoords } from '../lib/utils';

export type EditorHandle = {
  focus: () => void;
  insertImageFromFile: (file: File) => Promise<void>;
};

type Props = {
  entryId: string;
  initialBody: string;
  onChange: (body: string) => void;
  onSelectionChange?: (info: { line: number; col: number }) => void;
  apiKey: string;
  onToast: (msg: string, type?: 'success' | 'error') => void;
  onRequestApiKey: () => void;
};

const EditorPane = forwardRef<EditorHandle, Props>(function EditorPane(
  { entryId, initialBody, onChange, onSelectionChange, apiKey, onToast, onRequestApiKey },
  outerRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropActive, setDropActive] = useState(false);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const slashTriggerStart = useRef<number | null>(null);

  useImperativeHandle(outerRef, () => ({
    focus: () => textareaRef.current?.focus(),
    insertImageFromFile: async (f: File) => { await uploadAndInsert(f); },
  }));

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.value = initialBody;
    ta.setSelectionRange(0, 0);
    ta.focus();
    notifySelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const notifySelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !onSelectionChange) return;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    onSelectionChange({ line, col });
  }, [onSelectionChange]);

  function fire() {
    if (!textareaRef.current) return;
    onChange(textareaRef.current.value);
    notifySelection();
  }

  function insertAtCursor(text: string, opts: { cursorOffset?: number } = {}) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + text + after;
    const offset = opts.cursorOffset != null ? opts.cursorOffset : text.length;
    ta.selectionStart = ta.selectionEnd = start + offset;
    ta.focus();
    fire();
  }

  function wrapSelection(prefix: string, suffix: string, placeholder = '') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    const inner = sel || placeholder;
    const text = prefix + inner + suffix;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    if (sel) {
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = start + prefix.length + inner.length;
    } else {
      ta.selectionStart = ta.selectionEnd = start + prefix.length + inner.length;
    }
    ta.focus();
    fire();
  }

  function replaceCurrentLine(prefix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const value = ta.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    const rest = value.slice(start, lineEnd);
    ta.value = value.slice(0, lineStart) + prefix + rest + value.slice(lineEnd);
    ta.selectionStart = ta.selectionEnd = lineStart + prefix.length;
    ta.focus();
    fire();
  }

  function insertLinkAtCursor() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    const url = prompt('Link URL', 'https://');
    if (url == null) return;
    const text = sel || 'link text';
    const chunk = `[${text}](${url})`;
    ta.value = ta.value.slice(0, start) + chunk + ta.value.slice(end);
    ta.selectionStart = start + 1;
    ta.selectionEnd = start + 1 + text.length;
    ta.focus();
    fire();
  }

  function openSlash() {
    const ta = textareaRef.current;
    if (!ta) return;
    slashTriggerStart.current = ta.selectionStart - 1;
    setSlashQuery('');
    setActiveIndex(0);
    positionSlashMenu();
    setSlashOpen(true);
  }
  function closeSlash() {
    setSlashOpen(false);
    slashTriggerStart.current = null;
  }
  function positionSlashMenu() {
    const ta = textareaRef.current;
    if (!ta) return;
    const coords = getCaretCoords(ta, ta.selectionStart);
    let left = coords.left - ta.scrollLeft;
    let top = coords.top - ta.scrollTop + coords.height + 6;
    const menuW = 280;
    const maxLeft = ta.clientWidth - menuW - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;
    setSlashPos({ left, top });
  }

  function removeSlashTrigger() {
    const ta = textareaRef.current;
    const ts = slashTriggerStart.current;
    if (!ta || ts == null) return;
    const caret = ta.selectionStart;
    if (ts >= 0 && caret >= ts) {
      ta.value = ta.value.slice(0, ts) + ta.value.slice(caret);
      ta.selectionStart = ta.selectionEnd = ts;
    }
    slashTriggerStart.current = null;
  }

  function runAction(action: SlashAction) {
    switch (action.type) {
      case 'replaceLine':
        removeSlashTrigger();
        replaceCurrentLine(action.prefix);
        break;
      case 'wrap':
        removeSlashTrigger();
        wrapSelection(action.before, action.after, action.placeholder);
        break;
      case 'insert':
        removeSlashTrigger();
        insertAtCursor(action.text, { cursorOffset: action.cursorOffset });
        break;
      case 'link':
        removeSlashTrigger();
        insertLinkAtCursor();
        break;
      case 'image':
        removeSlashTrigger();
        pickAndUploadImage();
        break;
      case 'date': {
        removeSlashTrigger();
        const d = new Date().toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        insertAtCursor(d);
        break;
      }
      case 'time': {
        removeSlashTrigger();
        insertAtCursor(new Date().toLocaleTimeString());
        break;
      }
    }
  }

  function filteredCommands() {
    const q = slashQuery.trim().toLowerCase();
    return SLASH_COMMANDS.map((group) => ({
      group: group.group,
      items: group.items.filter((it) =>
        !q || (it.label + ' ' + it.desc + ' ' + it.keywords).toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length);
  }

  const flatList: SlashCommand[] = filteredCommands().flatMap((g) => g.items);

  function pickActive() {
    const it = flatList[activeIndex];
    if (!it) return false;
    closeSlash();
    runAction(it.action);
    return true;
  }

  function pickAndUploadImage() {
    if (!apiKey) {
      onToast('Add a Hack Club CDN key in Settings first', 'error');
      onRequestApiKey();
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function uploadAndInsert(file: File) {
    if (!apiKey) {
      onToast('Add a Hack Club CDN key in Settings first', 'error');
      onRequestApiKey();
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    const token = `tinymd_upload_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const placeholder = `_⏳ uploading ${escapeAlt(file.name)}… [${token}]_`;
    insertAtCursor('\n' + placeholder + '\n');
    try {
      const res = await uploadFile(file, apiKey);
      const md = `![${escapeAlt(file.name)}](${res.url})`;
      ta.value = ta.value.replace(placeholder, md);
      fire();
      onToast(`Uploaded ${file.name}`, 'success');
    } catch (e: any) {
      ta.value = ta.value.replace(placeholder, `_✗ upload failed: ${escapeAlt(file.name)}_`);
      fire();
      onToast(e.message || 'Upload failed', 'error');
    }
  }

  function handleInput() {
    const ta = textareaRef.current;
    if (!ta) return;
    fire();

    const pos = ta.selectionStart;
    const value = ta.value;

    if (slashOpen) {
      const ts = slashTriggerStart.current;
      if (ts == null || pos <= ts) { closeSlash(); return; }
      const after = value.slice(ts, pos);
      if (!after.startsWith('/')) { closeSlash(); return; }
      const query = after.slice(1);
      if (/\s|\n/.test(query)) { closeSlash(); return; }
      setSlashQuery(query);
      setActiveIndex(0);
      positionSlashMenu();
      return;
    }

    const ch = value.slice(pos - 1, pos);
    if (ch === '/') {
      const prev = pos >= 2 ? value.slice(pos - 2, pos - 1) : '';
      if (prev === '' || prev === '\n' || prev === ' ') {
        openSlash();
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = textareaRef.current;
    if (!ta) return;

    if (slashOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(flatList.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (pickActive()) { e.preventDefault(); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }

    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); wrapSelection('**','**','bold'); return; }
      if (k === 'i') { e.preventDefault(); wrapSelection('*','*','italic'); return; }
      if (k === 'k') { e.preventDefault(); insertLinkAtCursor(); return; }
      if (k === 'u') { e.preventDefault(); pickAndUploadImage(); return; }
      if (k === 'e') { e.preventDefault(); wrapSelection('`','`','code'); return; }
    }

    if (e.key === 'Tab' && !e.shiftKey && !mod) {
      e.preventDefault();
      insertAtCursor('  ');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const value = ta.value;
      const pos = ta.selectionStart;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      const line = value.slice(lineStart, pos);
      const m = line.match(/^(\s*)([-*+]|\d+\.|>)\s(\[ \]\s|\[x\]\s)?/i);
      if (m) {
        if (line.trim() === m[0].trim()) {
          e.preventDefault();
          ta.value = value.slice(0, lineStart) + value.slice(pos);
          ta.selectionStart = ta.selectionEnd = lineStart;
          fire();
          return;
        }
        e.preventDefault();
        let bullet = m[2];
        if (/^\d+\./.test(bullet)) bullet = (parseInt(bullet, 10) + 1) + '.';
        const cont = '\n' + m[1] + bullet + ' ' + (m[3] ? '[ ] ' : '');
        insertAtCursor(cont);
        return;
      }
    }
  }

  function onTextareaScroll() {
    if (slashOpen) positionSlashMenu();
  }

  function onTextareaSelect() {
    notifySelection();
  }

  function onBlur() {
    setTimeout(() => closeSlash(), 120);
  }

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer) return;
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    setDropActive(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
  }
  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) setDropActive(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
    for (const f of files) await uploadAndInsert(f);
  }
  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgs = items.filter((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    for (const it of imgs) {
      const f = it.getAsFile();
      if (f) await uploadAndInsert(f);
    }
  }

  const groups = filteredCommands();
  let runningIndex = -1;

  return (
    <div
      className="editor-pane"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <textarea
        ref={textareaRef}
        className="editor"
        spellCheck={false}
        placeholder="Start writing. Type / for commands…"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onScroll={onTextareaScroll}
        onSelect={onTextareaSelect}
        onClick={onTextareaSelect}
        onKeyUp={onTextareaSelect}
        onBlur={onBlur}
        onPaste={onPaste}
        defaultValue={initialBody}
      />

      {slashOpen && (
        <div
          className="slash-menu"
          style={{ left: slashPos.left, top: slashPos.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {groups.length === 0 ? (
            <div className="slash-group-label" style={{ padding: 12 }}>No commands match</div>
          ) : groups.map((g) => (
            <div key={g.group}>
              <div className="slash-group-label">{g.group}</div>
              {g.items.map((it) => {
                runningIndex++;
                const idx = runningIndex;
                return (
                  <div
                    key={it.id}
                    className={'slash-item' + (idx === activeIndex ? ' active' : '')}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); closeSlash(); runAction(it.action); }}
                  >
                    <span className={'icon color-' + it.color}>{it.icon}</span>
                    <span className="meta">
                      <span className="label" dangerouslySetInnerHTML={{ __html: escapeHTML(it.label) }} />
                      <span className="desc">{it.desc}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.currentTarget.files || []);
          for (const f of files) await uploadAndInsert(f);
        }}
      />

      {dropActive && (
        <div className="drop-overlay">
          <div className="drop-card">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>Drop to upload to Hack Club CDN</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default EditorPane;
