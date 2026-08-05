/* ============================================================
   Supabase persistence.

   Deliberately additive: the app is fully usable with no
   database. Every call here fails soft, so a missing key or a
   dead venue network degrades to localStorage rather than
   breaking the demo.

   Credentials come from .env (gitignored), same as the model key:
     supabase_url      = "https://xxxx.supabase.co"
     supabase_anon_key = "sb_publishable_..."   (or a legacy eyJ... anon key)

   Dashboard → Connect, or Settings → API Keys. Take the PUBLISHABLE key
   (`sb_publishable_…`); the legacy `anon` JWT still works but is being
   retired. Never the secret / service_role key — that bypasses RLS.

   The publishable key is designed to be public — access is enforced by
   the RLS policies in db/schema.sql, not by hiding it.
   ============================================================ */

const SDK = 'https://esm.sh/@supabase/supabase-js@2';
const USER_ID = 'demo';        // single-user prototype

let client = null;
let status = 'offline';        // offline | connected

export function isConnected() {
  return status === 'connected';
}

async function readEnv() {
  try {
    const res = await fetch('.env', { cache: 'no-store' });
    if (!res.ok) return {};
    const text = await res.text();
    const pick = name => {
      const m = text.match(new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*(.+?)[ \\t]*$`, 'im'));
      return m ? m[1].replace(/^["']|["']$/g, '').trim() : '';
    };
    return { url: pick('supabase_url'), key: pick('supabase_anon_key') };
  } catch {
    return {};
  }
}

/** Connect if credentials exist. Never throws. */
export async function init() {
  const { url, key } = await readEnv();
  if (!url || !key) {
    console.info('[db] no Supabase credentials in .env — running on localStorage only');
    return false;
  }

  try {
    const { createClient } = await import(SDK);
    client = createClient(url, key);
    status = 'connected';
    console.info('[db] connected to Supabase');
    return true;
  } catch (err) {
    console.warn('[db] connect failed, staying local:', err);
    return false;
  }
}

/** Pull history back so focus stats survive a different browser. */
export async function loadAll() {
  if (!client) return null;

  try {
    const [sessions, reframes] = await Promise.all([
      client.from('sessions').select('*').eq('user_id', USER_ID).order('date', { ascending: false }).limit(200),
      client.from('reframes').select('*').eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(50),
    ]);

    if (sessions.error || reframes.error) {
      console.warn('[db] load failed:', sessions.error || reframes.error);
      return null;
    }

    return {
      sessions: (sessions.data || []).map(r => ({
        id: r.id,
        date: r.date,
        plannedMin: r.planned_min,
        focusedMin: r.focused_min,
        distractions: r.distractions || [],
      })),
      reframes: (reframes.data || []).map(r => ({
        input: r.input,
        distortion: r.distortion,
        response: r.response,
        ts: Date.parse(r.created_at),
      })),
    };
  } catch (err) {
    console.warn('[db] load threw:', err);
    return null;
  }
}

/* ---- writes: fire and forget, never block the UI ---- */

export function saveSession(s) {
  if (!client) return;
  client.from('sessions').insert({
    user_id: USER_ID,
    date: s.date,
    planned_min: s.plannedMin,
    focused_min: s.focusedMin || 0,
    distractions: s.distractions || [],
  }).then(({ error }) => error && console.warn('[db] session insert failed:', error));
}

export function saveReframe(r) {
  if (!client) return;
  client.from('reframes').insert({
    user_id: USER_ID,
    input: r.input,
    distortion: r.distortion,
    response: r.response,
  }).then(({ error }) => error && console.warn('[db] reframe insert failed:', error));
}
