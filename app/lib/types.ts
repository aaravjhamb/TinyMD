export type User = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  slack_id: string | null;
  cdn_api_key: string | null;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  cover_image: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectWithCounts = Project & {
  entry_count: number;
  last_entry_at: string | null;
  last_entry_title: string | null;
};

export type EntryKind = 'journal' | 'readme' | 'bom';

export type Entry = {
  id: string;
  title: string;
  body: string;
  kind: EntryKind;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type ToastInfo = { msg: string; type?: 'success' | 'error' } | null;
