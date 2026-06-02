#!/usr/bin/env node
/*
 * One-time backfill: re-host images that live on the old (Hack Club) CDN onto
 * the new self-hosted cdn, and rewrite the stored URLs in the database.
 *
 * What it touches:
 *   - projects.cover_image  (a single image URL per project)
 *   - entries.body          (markdown image links: ![alt](url))
 *
 * For every old image URL it finds, it asks the new cdn to pull the file
 * directly via POST /api/upload_from_url, then swaps the old URL for the new
 * one everywhere it appears. Already-migrated URLs (already on the new cdn
 * host) are skipped, so the script is safe to re-run.
 *
 * SAFETY: dry-run by default. It only writes to the DB when you pass --apply.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-cdn.js            # dry run, report only
 *   node --env-file=.env scripts/migrate-cdn.js --apply    # actually migrate
 *
 * Required env:
 *   DATABASE_URL    Postgres connection string (the app's DB)
 *   CDN_ADMIN_KEY   Bearer key the new cdn uses to re-host the files
 *
 * Optional env:
 *   CDN_BASE_URL    New cdn base URL        (default https://cdn.aaravj.tech)
 *   OLD_CDN_HOST    Only migrate URLs on this host (e.g. hc-cdn.hel1.your-
 *                   objectstorage.com). If unset, every image URL that is NOT
 *                   already on the new cdn host is migrated.
 */

const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const DATABASE_URL = process.env.DATABASE_URL;
const CDN_BASE_URL = (process.env.CDN_BASE_URL || 'https://cdn.aaravj.tech').replace(/\/+$/, '');
const CDN_ADMIN_KEY = process.env.CDN_ADMIN_KEY;
const OLD_CDN_HOST = process.env.OLD_CDN_HOST || '';

const NEW_HOST = new URL(CDN_BASE_URL).host;

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!DATABASE_URL) die('DATABASE_URL is not set.');
if (!CDN_ADMIN_KEY) die('CDN_ADMIN_KEY is not set (Bearer key for the new cdn).');

// Pull http(s) URLs out of markdown IMAGE syntax only: ![alt](url ...).
// The leading "!" means it's an embedded image, not a plain link, so we never
// touch ordinary hyperlinks a user may have written.
const IMG_MD_RE = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^)\s>]+)>?[^)]*\)/g;

/** Does this URL point at a file we should migrate? */
function isOldImageUrl(raw) {
  let host;
  try {
    host = new URL(raw).host;
  } catch {
    return false; // not an absolute URL (e.g. a relative path) — leave it
  }
  if (host === NEW_HOST) return false;          // already on the new cdn
  if (OLD_CDN_HOST) return host === OLD_CDN_HOST; // restricted to one old host
  return true;                                   // any other absolute host
}

/** Have the new cdn pull `oldUrl` server-side. Returns the new URL. */
async function rehostViaUrl(oldUrl) {
  const res = await fetch(`${CDN_BASE_URL}/api/upload_from_url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CDN_ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: oldUrl }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload_from_url ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  if (!data.url) throw new Error(`upload_from_url response had no url: ${text.slice(0, 200)}`);
  return data.url;
}

/**
 * Download `oldUrl` ourselves (following redirects) and upload the bytes via
 * multipart. Fallback for sources upload_from_url can't fetch — e.g. hosts
 * that 30x-redirect or whose filenames contain spaces/odd characters.
 */
async function rehostByBytes(oldUrl) {
  const dl = await fetch(oldUrl, { redirect: 'follow' });
  if (!dl.ok) throw new Error(`download ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const type = dl.headers.get('content-type') || 'application/octet-stream';
  let name = 'upload';
  try {
    name = decodeURIComponent(new URL(oldUrl).pathname.split('/').pop() || 'upload');
  } catch {}
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), name);
  const up = await fetch(`${CDN_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CDN_ADMIN_KEY}` },
    body: fd,
  });
  const text = await up.text();
  if (!up.ok) throw new Error(`upload ${up.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  if (!data.url) throw new Error(`upload response had no url: ${text.slice(0, 200)}`);
  return data.url;
}

/** Re-host `oldUrl` on the new cdn, preferring the server-side pull. */
async function rehost(oldUrl) {
  try {
    return await rehostViaUrl(oldUrl);
  } catch (e) {
    // upload_from_url can't always fetch the source (redirects, odd filenames);
    // fall back to streaming the bytes through this script.
    return await rehostByBytes(oldUrl);
  }
}

async function main() {
  console.log(`Mode:        ${APPLY ? 'APPLY (will write to DB)' : 'DRY RUN (no changes)'}`);
  console.log(`New cdn:      ${CDN_BASE_URL}  (host ${NEW_HOST})`);
  console.log(`Old host:     ${OLD_CDN_HOST || '(any host that is not the new cdn)'}\n`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  // 1. Collect every distinct old image URL across both columns.
  const { rows: projects } = await pool.query(
    `SELECT id, cover_image FROM projects WHERE cover_image IS NOT NULL AND cover_image <> ''`
  );
  const { rows: entries } = await pool.query(
    `SELECT id, body FROM entries WHERE body LIKE '%http%'`
  );

  const oldUrls = new Set();
  for (const p of projects) {
    if (isOldImageUrl(p.cover_image)) oldUrls.add(p.cover_image);
  }
  for (const e of entries) {
    let m;
    IMG_MD_RE.lastIndex = 0;
    while ((m = IMG_MD_RE.exec(e.body)) !== null) {
      if (isOldImageUrl(m[1])) oldUrls.add(m[1]);
    }
  }

  console.log(`Scanned ${projects.length} project covers, ${entries.length} entries.`);
  console.log(`Found ${oldUrls.size} distinct old image URL(s) to migrate.\n`);

  if (oldUrls.size === 0) {
    console.log('Nothing to do. ✅');
    await pool.end();
    return;
  }

  // 2. Re-host each unique URL on the new cdn (sequential, gentle on the cdn).
  const map = new Map(); // oldUrl -> newUrl
  const failures = [];
  let i = 0;
  for (const oldUrl of oldUrls) {
    i++;
    const label = `[${i}/${oldUrls.size}] ${oldUrl}`;
    if (!APPLY) {
      console.log(`  would re-host  ${label}`);
      continue;
    }
    try {
      const newUrl = await rehost(oldUrl);
      map.set(oldUrl, newUrl);
      console.log(`  ✓ ${label}\n      -> ${newUrl}`);
    } catch (err) {
      failures.push({ oldUrl, error: err.message });
      console.warn(`  ✗ ${label}\n      ${err.message}`);
    }
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to migrate and rewrite the DB.');
    await pool.end();
    return;
  }

  if (map.size === 0) {
    console.error('\nNo URLs were successfully re-hosted; leaving the DB untouched.');
    await pool.end();
    process.exit(1);
  }

  // 3. Rewrite the DB inside a single transaction.
  const client = await pool.connect();
  let projectsUpdated = 0;
  let entriesUpdated = 0;
  try {
    await client.query('BEGIN');

    for (const p of projects) {
      const next = map.get(p.cover_image);
      if (next) {
        await client.query('UPDATE projects SET cover_image = $1, updated_at = NOW() WHERE id = $2', [next, p.id]);
        projectsUpdated++;
      }
    }

    for (const e of entries) {
      let body = e.body;
      let changed = false;
      for (const [oldUrl, newUrl] of map) {
        if (body.includes(oldUrl)) {
          body = body.split(oldUrl).join(newUrl);
          changed = true;
        }
      }
      if (changed) {
        await client.query('UPDATE entries SET body = $1, updated_at = NOW() WHERE id = $2', [body, e.id]);
        entriesUpdated++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n✗ DB rewrite failed, rolled back: ${err.message}`);
    client.release();
    await pool.end();
    process.exit(1);
  }
  client.release();

  console.log(`\n✅ Migrated ${map.size} file(s). Updated ${projectsUpdated} project cover(s) and ${entriesUpdated} entry body(ies).`);
  if (failures.length) {
    console.log(`\n⚠ ${failures.length} URL(s) could not be re-hosted and were left pointing at the old host:`);
    for (const f of failures) console.log(`   ${f.oldUrl}  —  ${f.error}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
