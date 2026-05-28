import { NextRequest, NextResponse } from 'next/server';
import { destroySession } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await destroySession();
  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
}

export async function GET(req: NextRequest) {
  await destroySession();
  const url = new URL(req.url);
  return NextResponse.redirect(`${url.origin}/login`);
}
