/* Natiq Arab — Telegram bot + Mini App serveri (Railway’da 24/7).
   Railway → Variables:
     BOT_TOKEN             — yangi botning tokeni (@BotFather). Hech kimga bermang, kodga yozmang.
     SUPABASE_URL          — saytdagi Supabase loyiha manzili (https://xxxx.supabase.co)
     SUPABASE_SERVICE_KEY  — Supabase → Settings → API → service_role (yoki sb_secret_…) kaliti
     APP_URL               — ixtiyoriy. Boʻlmasa: https://<RAILWAY_PUBLIC_DOMAIN>/app
   Railway → Settings → Networking → «Generate Domain» bosilgan boʻlishi shart (Mini App HTTPS’da ochiladi). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { SupabaseStore, MemoryStore } = require('./store');
const { createApi } = require('./api');
const { createArabBot } = require('./bot');

/* GitHub’da fayllar bir papkada (app.html index.js yonida) yoki public/ ichida boʻlishi mumkin */
const APP_FILE = [path.join(__dirname, 'app.html'), path.join(__dirname, '..', 'public', 'app.html')].find(f => fs.existsSync(f)) || path.join(__dirname, 'app.html');

/* maskot rasmlari (mascot-<nom>.webp / .jpg) — app.html bilan bir papkada */
const MASCOTS = ['read', 'thumbs', 'cheer', 'bravo', 'think', 'goodjob', 'cool', 'party', 'love', 'sleep', 'write', 'learn', 'peek', 'walk', 'stars', 'trophy'];
const assetPath = f => [path.join(__dirname, f), path.join(__dirname, '..', 'public', f)].find(x => fs.existsSync(x)) || null;

function createServer({ api, appHtml = () => fs.readFileSync(APP_FILE, 'utf8'), info = () => ({}) }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const p = url.pathname.replace(/\/+$/, '') || '/';
    const send = (st, body, type = 'application/json; charset=utf-8', extra = {}) => { res.writeHead(st, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }, extra)); res.end(body); };
    try {
      if (req.method === 'GET' && (p === '/health' || p === '/')) return send(200, JSON.stringify(Object.assign({ ok: true, app: 'natiq-arab' }, info())));
      const m = /^\/mascot-([a-z]+)\.(webp|jpg|png)$/.exec(p);
      if (req.method === 'GET' && m && MASCOTS.includes(m[1])) { const f = assetPath(`mascot-${m[1]}.${m[2]}`); if (f) return send(200, fs.readFileSync(f), { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' }[m[2]], { 'Cache-Control': 'public, max-age=604800' }); }
      if (req.method === 'GET' && p === '/app') return send(200, appHtml(), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
      if (req.method === 'POST' && p.startsWith('/api/')) {
        let body = ''; let big = false;
        for await (const ch of req) { body += ch; if (body.length > 65536) { big = true; break; } }
        if (big) return send(413, JSON.stringify({ error: 'Soʻrov juda katta' }));
        let j = {}; try { j = JSON.parse(body || '{}'); } catch (e) { return send(400, JSON.stringify({ error: 'JSON xato' })); }
        const r = await api.handle(p.slice(5), j); return send(r.status, JSON.stringify(r.body), undefined, { 'Cache-Control': 'no-store' });
      }
      send(404, JSON.stringify({ error: 'Topilmadi' }));
    } catch (e) { console.error(e); send(500, JSON.stringify({ error: 'Server xatosi' })); }
  });
}

async function main() {
  const env = process.env;
  const token = env.BOT_TOKEN || env.ARAB_BOT_TOKEN;
  if (!token) { console.error('BOT_TOKEN yoʻq — Railway → Variables’ga yangi botning tokenini kiriting'); process.exit(1); }
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_KEY;
  const store = env.SUPABASE_URL && key ? new SupabaseStore(env.SUPABASE_URL, key) : new MemoryStore();
  if (!(env.SUPABASE_URL && key)) console.warn('⚠️ SUPABASE_URL / SUPABASE_SERVICE_KEY yoʻq — maʼlumotlar faqat xotirada (sinov rejimi)');
  const appUrl = env.APP_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}/app` : '');
  if (!appUrl) console.warn('⚠️ APP_URL yoʻq: Railway → Settings → Networking → Generate Domain bosing');

  let A;
  const api = createApi({ store, token, onOrder: o => A && A.notifyOrder(o) });
  A = createArabBot({ token, store, appUrl, cfg: () => api.cfg(), asset: assetPath });
  const bot = A.bot;
  await bot.init();
  const started = new Date().toISOString();
  const server = createServer({ api, info: () => ({ bot: bot.botInfo && bot.botInfo.username, appUrl, started }) });
  const port = +env.PORT || 3000; server.listen(port, () => console.log('HTTP :' + port, appUrl || ''));

  try { await bot.api.setMyCommands([{ command: 'start', description: 'Boshlash' }, { command: 'app', description: 'Ilovani ochish' }]); } catch (e) { }

  /* fon ishlari: ommaviy xabarlar, admin amallari (dinor, qaytarish), saytga «bot ishlayapti» signali */
  let busy = false;
  const tick = async () => { if (busy) return; busy = true;
    try { await A.processMsgs(); } catch (e) { console.error('msgs', e.message); }
    try { const ops = (await store.list('ar_ops', { fresh: true })).filter(o => o.status === 'pending'); const codes = [...new Set(ops.map(o => o.code))];
      for (const c of codes) await api.lock(c, () => api.applyOps(c)); } catch (e) { console.error('ops', e.message); }
    busy = false; };
  setInterval(tick, 10000); setTimeout(tick, 3000);
  /* 2 kun darsga kirmagan oʻquvchiga 3-kuni maskot eslatmasi (Toshkent vaqti 10:00–20:00) */
  const remind = async () => { try { const n = await A.processReminders(); if (n) console.log('eslatma:', n); } catch (e) { console.error('remind', e.message); } };
  setInterval(remind, 30 * 60e3); setTimeout(remind, 60e3);
  const beat = async () => { try { await store.put('ar_cfg', 'bot', { at: new Date().toISOString(), username: bot.botInfo.username, appUrl, started }); } catch (e) { console.error('beat', e.message); } };
  beat(); setInterval(beat, 60000);

  bot.start({ drop_pending_updates: false, onStart: i => console.log('@' + i.username + ' ishga tushdi') });
  const stop = () => { try { bot.stop(); } catch (e) { } server.close(); setTimeout(() => process.exit(0), 500); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { createServer, MASCOTS, assetPath };
