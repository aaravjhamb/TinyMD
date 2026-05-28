import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  buildAuthorizeUrl,
  challengeFromVerifier,
  generateVerifier,
  setOAuthState,
} from '../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get('return_to') || '/';
  const redirectUri = process.env.HACKCLUB_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  if (!process.env.HACKCLUB_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Server is not configured: HACKCLUB_CLIENT_ID is missing.' },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString('base64url');
  const verifier = generateVerifier();
  const challenge = challengeFromVerifier(verifier);

  await setOAuthState(state, verifier, returnTo);

  const authorizeUrl = buildAuthorizeUrl({
    state,
    codeChallenge: challenge,
    redirectUri,
    scopes: ['openid', 'email', 'name', 'verification_status'],
  });

  return NextResponse.redirect(authorizeUrl);
}
