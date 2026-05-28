import { NextRequest, NextResponse } from 'next/server';
import { destroySession, publicOrigin } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(`${publicOrigin(req.url)}/login`, { status: 303 });
}

export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(`${publicOrigin(req.url)}/login`);
}
