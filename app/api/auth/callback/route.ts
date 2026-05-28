import { NextRequest, NextResponse } from 'next/server';
import {
  clearOAuthState,
  createSession,
  exchangeCode,
  fetchIdentity,
  readOAuthState,
  upsertUserFromIdentity,
} from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  if (err) {
    return NextResponse.redirect(`${url.origin}/login?error=${encodeURIComponent(err)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/login?error=missing_code`);
  }

  const stored = await readOAuthState();
  if (!stored || stored.state !== state) {
    return NextResponse.redirect(`${url.origin}/login?error=state_mismatch`);
  }
  await clearOAuthState();

  const redirectUri = process.env.HACKCLUB_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  try {
    const token = await exchangeCode({
      code,
      redirectUri,
      codeVerifier: stored.verifier,
    });
    const identity = await fetchIdentity(token.access_token);
    const user = await upsertUserFromIdentity(identity);
    await createSession(user.id, token.access_token);
  } catch (e: any) {
    console.error('[auth] callback failed', e);
    return NextResponse.redirect(`${url.origin}/login?error=${encodeURIComponent(e.message || 'callback_failed')}`);
  }

  const safeReturn = stored.returnTo && stored.returnTo.startsWith('/') ? stored.returnTo : '/';
  return NextResponse.redirect(`${url.origin}${safeReturn}`);
}
