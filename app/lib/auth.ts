import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { many, one, query } from './db';

export const COOKIE_SESSION = 'tinymd_sess';
export const COOKIE_OAUTH_STATE = 'tinymd_oauth_state';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export const HC_AUTHORIZE = process.env.HACKCLUB_AUTHORIZE_URL || 'https://auth.hackclub.com/oauth/authorize';
export const HC_TOKEN     = process.env.HACKCLUB_TOKEN_URL     || 'https://auth.hackclub.com/oauth/token';
export const HC_USERINFO  = process.env.HACKCLUB_USERINFO_URL  || 'https://auth.hackclub.com/api/v1/me';

// Behind a reverse proxy (Dokploy/Traefik) the standalone Next server sees
// the internal request, so `new URL(req.url).origin` resolves to
// http://localhost:3000. Prefer the public origin derived from the configured
// redirect URI; fall back to the request URL only in local dev.
export function publicOrigin(reqUrl: string): string {
  const configured = process.env.APP_URL || process.env.HACKCLUB_REDIRECT_URI;
  if (configured) {
    try { return new URL(configured).origin; } catch {}
  }
  return new URL(reqUrl).origin;
}

export type SessionUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  slack_id: string | null;
};

export function generateVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function challengeFromVerifier(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function setOAuthState(state: string, verifier: string, returnTo: string) {
  const value = JSON.stringify({ state, verifier, returnTo });
  const c = await cookies();
  c.set(COOKIE_OAUTH_STATE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
}

export async function readOAuthState(): Promise<{ state: string; verifier: string; returnTo: string } | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_OAUTH_STATE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearOAuthState() {
  const c = await cookies();
  c.delete(COOKIE_OAUTH_STATE);
}

export async function createSession(userId: string, accessToken: string | null) {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  await query(
    'INSERT INTO sessions (id, user_id, access_token, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, accessToken, expiresAt]
  );
  const c = await cookies();
  c.set(COOKIE_SESSION, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  return sessionId;
}

export async function destroySession() {
  const c = await cookies();
  const id = c.get(COOKIE_SESSION)?.value;
  if (id) {
    try { await query('DELETE FROM sessions WHERE id = $1', [id]); } catch {}
  }
  c.delete(COOKIE_SESSION);
}

export async function currentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const id = c.get(COOKIE_SESSION)?.value;
  if (!id) return null;
  const row = await one<SessionUser & { expires_at: Date }>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.slack_id, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1`,
    [id]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE id = $1', [id]);
    return null;
  }
  const { expires_at, ...user } = row;
  return user;
}

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

export function buildAuthorizeUrl(opts: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
  scopes?: string[];
}): string {
  if (!process.env.HACKCLUB_CLIENT_ID) {
    throw new Error('HACKCLUB_CLIENT_ID is not set');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.HACKCLUB_CLIENT_ID,
    redirect_uri: opts.redirectUri,
    scope: (opts.scopes && opts.scopes.length ? opts.scopes : ['openid', 'email', 'name']).join(' '),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${HC_AUTHORIZE}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: process.env.HACKCLUB_CLIENT_ID || '',
    code_verifier: opts.codeVerifier,
  });
  if (process.env.HACKCLUB_CLIENT_SECRET) {
    body.set('client_secret', process.env.HACKCLUB_CLIENT_SECRET);
  }
  const res = await fetch(HC_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export type HackClubIdentity = {
  identity: {
    id: string;
    primary_email?: string;
    first_name?: string;
    last_name?: string;
    slack_id?: string;
  };
  scopes?: string[];
};

export async function fetchIdentity(accessToken: string): Promise<HackClubIdentity> {
  const res = await fetch(HC_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Userinfo failed (${res.status}): ${text}`);
  }
  return (await res.json()) as HackClubIdentity;
}

export async function upsertUserFromIdentity(id: HackClubIdentity): Promise<SessionUser> {
  const u = id.identity;
  await query(
    `INSERT INTO users (id, email, first_name, last_name, slack_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            slack_id = EXCLUDED.slack_id,
            updated_at = NOW()`,
    [u.id, u.primary_email || null, u.first_name || null, u.last_name || null, u.slack_id || null]
  );
  return {
    id: u.id,
    email: u.primary_email || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    slack_id: u.slack_id || null,
  };
}
