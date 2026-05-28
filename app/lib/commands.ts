export type SlashAction =
  | { type: 'replaceLine'; prefix: string }
  | { type: 'wrap'; before: string; after: string; placeholder?: string }
  | { type: 'insert'; text: string; cursorOffset?: number }
  | { type: 'link' }
  | { type: 'image' }
  | { type: 'date' }
  | { type: 'time' };

export type SlashCommand = {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: 'red' | 'orange' | 'green' | 'blue' | 'purple';
  keywords: string;
  action: SlashAction;
};

export type SlashGroup = { group: string; items: SlashCommand[] };

export const SLASH_COMMANDS: SlashGroup[] = [
  {
    group: 'Headings',
    items: [
      { id: 'h1', label: 'Heading 1', desc: 'Top-level title', icon: 'H1', color: 'red', keywords: 'heading h1 title', action: { type: 'replaceLine', prefix: '# ' } },
      { id: 'h2', label: 'Heading 2', desc: 'Section heading',  icon: 'H2', color: 'red', keywords: 'heading h2 section',  action: { type: 'replaceLine', prefix: '## ' } },
      { id: 'h3', label: 'Heading 3', desc: 'Sub-section',      icon: 'H3', color: 'red', keywords: 'heading h3',          action: { type: 'replaceLine', prefix: '### ' } },
    ],
  },
  {
    group: 'Inline',
    items: [
      { id: 'bold',   label: 'Bold',          desc: '**bold text**',  icon: 'B',  color: 'orange', keywords: 'bold strong',          action: { type: 'wrap', before: '**', after: '**' } },
      { id: 'italic', label: 'Italic',        desc: '*italic text*',  icon: 'I',  color: 'orange', keywords: 'italic emphasis',      action: { type: 'wrap', before: '*',  after: '*'  } },
      { id: 'strike', label: 'Strikethrough', desc: '~~struck~~',     icon: 'S',  color: 'orange', keywords: 'strike strikethrough', action: { type: 'wrap', before: '~~', after: '~~' } },
      { id: 'code',   label: 'Inline code',   desc: '`code`',         icon: '<>', color: 'orange', keywords: 'code inline',          action: { type: 'wrap', before: '`',  after: '`'  } },
      { id: 'link',   label: 'Link',          desc: '[text](url)',    icon: '🔗', color: 'blue',   keywords: 'link href url',        action: { type: 'link' } },
    ],
  },
  {
    group: 'Blocks',
    items: [
      { id: 'ul',        label: 'Bulleted list', desc: '- item',          icon: '•',   color: 'green',  keywords: 'list ul unordered bullets',  action: { type: 'replaceLine', prefix: '- ' } },
      { id: 'ol',        label: 'Numbered list', desc: '1. item',         icon: '1.',  color: 'green',  keywords: 'list ol ordered',            action: { type: 'replaceLine', prefix: '1. ' } },
      { id: 'todo',      label: 'Task list',     desc: '- [ ] task',      icon: '☐',   color: 'green',  keywords: 'task todo checklist',        action: { type: 'replaceLine', prefix: '- [ ] ' } },
      { id: 'quote',     label: 'Blockquote',    desc: '> quote',         icon: '"',   color: 'purple', keywords: 'quote blockquote',           action: { type: 'replaceLine', prefix: '> ' } },
      { id: 'codeblock', label: 'Code block',    desc: '```lang ...```',    icon: '{ }', color: 'purple', keywords: 'code block fence',           action: { type: 'insert', text: '\n```cpp\n\n```\n', cursorOffset: 7 } },
      { id: 'hr',        label: 'Divider',       desc: 'Horizontal rule', icon: '-',   color: 'purple', keywords: 'divider hr rule',            action: { type: 'insert', text: '\n---\n\n' } },
      { id: 'table',     label: 'Table',         desc: '3-column starter',icon: '⊞',   color: 'blue',   keywords: 'table grid',                 action: { type: 'insert', text: '\n| Column | Column | Column |\n| --- | --- | --- |\n| cell | cell | cell |\n\n' } },
    ],
  },
  {
    group: 'Hardware',
    items: [
      { id: 'image',     label: 'Image upload',  desc: 'Upload to Hack Club CDN', icon: '🖼', color: 'red',    keywords: 'image picture photo upload cdn', action: { type: 'image' } },
      { id: 'component', label: 'Component',     desc: 'Part / spec card',        icon: '⚙', color: 'blue',   keywords: 'component part bom spec',        action: { type: 'insert', text: '\n:::component\nName: \nValue: \nPackage: \nDatasheet: \n:::\n', cursorOffset: 18 } },
      { id: 'bom',       label: 'BOM table',     desc: 'Bill of materials',       icon: '📋', color: 'blue',   keywords: 'bom parts list table',           action: { type: 'insert', text: '\n| Qty | Part | Value | Footprint | Notes |\n| --- | --- | --- | --- | --- |\n| 1 |  |  |  |  |\n\n' } },
      { id: 'pinout',    label: 'Pinout table',  desc: 'Pin assignments',         icon: '⏚', color: 'green',  keywords: 'pinout pins wiring',             action: { type: 'insert', text: '\n| Pin | Net | Notes |\n| --- | --- | --- |\n|  |  |  |\n\n' } },
      { id: 'date',      label: 'Date',          desc: 'Today’s date',            icon: '📅', color: 'orange', keywords: 'date today',                     action: { type: 'date' } },
      { id: 'time',      label: 'Time stamp',    desc: 'Now',                     icon: '🕘', color: 'orange', keywords: 'time stamp now',                 action: { type: 'time' } },
    ],
  },
];

export function flattenCommands(): SlashCommand[] {
  return SLASH_COMMANDS.flatMap((g) => g.items);
}
