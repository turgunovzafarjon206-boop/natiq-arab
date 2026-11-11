/* Mini App API: har bir soʻrov Telegram initData (HMAC) bilan tasdiqlanadi.
   Javoblar, dinor va jonlar faqat serverda hisoblanadi — ilova faqat koʻrsatadi. */
const crypto = require('crypto');
const G = require('./game');

function verifyInitData(initData, token, maxAgeSec = 3 * 86400) {
  const p = new URLSearchParams(initData || ''); const hash = p.get('hash'); if (!hash || !token) return null;
  p.delete('hash');
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const age = Date.now() / 1000 - (+p.get('auth_date') || 0); if (age > maxAgeSec) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch (e) { return null; }
}
/* sinov uchun: initData yasash */
function signInitData(user, token, authDate = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAE' + crypto.randomBytes(4).toString('hex'), user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex')); return p.toString();
}

const digits = s => String(s || '').replace(/\D/g, '');
class ApiError extends Error { constructor(status, msg, code) { super(msg); this.status = status; this.code = code; } }

function createApi({ store, token, onOrder = async () => {}, clock = () => new Date() }) {
  const locks = new Map();
  const lock = (k, fn) => { const prev = locks.get(k) || Promise.resolve(); const p = prev.then(fn, fn); const tail = p.catch(() => {}); locks.set(k, tail);
    tail.then(() => { if (locks.get(k) === tail) locks.delete(k); }); return p; };
  let cfgC = null;
  async function cfg(fresh) { if (!fresh && cfgC && Date.now() - cfgC.at < 15000) return cfgC.v; const v = G.cfgOf(await store.get('ar_cfg', 'main')); cfgC = { at: Date.now(), v }; return v; }
  const letters = () => store.list('ar_letters', { ttl: 30000 });

  async function auth(initData) {
    const user = verifyInitData(initData, token); if (!user || !user.id) throw new ApiError(401, 'Telegram maʼlumoti tasdiqlanmadi. Ilovani bot orqali qayta oching', 'auth');
    const tg = await store.get('ar_tg', user.id); const c = tg && tg.code ? await store.get('ar_codes', tg.code) : null;
    if (!c || String(c.tgId) !== String(user.id)) throw new ApiError(403, 'Avval botda /start bosing va ID kodingizni kiriting', 'not_linked');
    if (c.status === 'blocked') throw new ApiError(403, 'ID kodingiz bloklangan. Administrator bilan bogʻlaning', 'blocked');
    return { user, tg, c };
  }
  async function loadProg(c, user) {
    const C = await cfg(); let p = await store.get('ar_prog', c.id);
    if (!p) p = G.freshProg(c.id, { hearts: C.maxHearts });
    p.name = c.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Oʻquvchi';
    p.tgId = user.id; p.group = c.groupId || ''; p.hideRank = !!c.hideRank;
    return p;
  }
  const saveProg = p => store.put('ar_prog', p.code, p);

  /* admin amallari: dinor qoʻshish, jon, qaytarish (refund), qayta boshlash */
  async function applyOps(code, prog) {
    const ops = (await store.find('ar_ops', 'code', code)).filter(o => o.status === 'pending').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    if (!ops.length) return 0;
    const C = await cfg(); let p = prog || await store.get('ar_prog', code) || G.freshProg(code, { hearts: C.maxHearts });
    for (const o of ops) { const okk = G.applyOp(p, o, C); await store.put('ar_ops', o.id, Object.assign({}, o, { status: okk ? 'done' : 'error', doneAt: clock().toISOString() }));
      if (o.type === 'refund' && o.orderId) { const ord = await store.get('ar_orders', o.orderId); if (ord) await store.put('ar_orders', ord.id, Object.assign(ord, { status: 'refunded', refundedAt: clock().toISOString() })); } }
    if (!prog) await saveProg(p); return ops.length;
  }

  function meView(c, p, C, L, groups) {
    const S = G.sorted(L); const g = (groups || []).find(x => x.id === c.groupId) || null; const tester = !!c.tester;
    const path = S.map(l => { const d = (p.done || {})[l.id] || 0;
      return { id: l.id, letter: l.letter || '', name: l.name || '', tr: l.tr || '', done: d,
        parts: G.PARTS.map((P, i) => ({ p: i + 1, k: P.k, n: P.n, ok: G.hasContent(l, i + 1, C, L), open: G.unlocked(p, L, l.id, i + 1, tester) })) }; });
    return {
      user: { name: p.name, code: c.id, phone: c.tgPhone || '', tester, group: g ? { name: g.name || '', days: g.days || [], time: g.time || '', dur: g.dur || '', meet: g.meet || '', note: g.note || '' } : null },
      cfg: { appName: C.appName, primary: C.primary, accent: C.accent, fruitPrice: C.fruitPrice, maxHearts: C.maxHearts, rw: C.rw, reviewQ: C.reviewQ, heartPer: C.heartPer,
        waterQ: C.waterQ, waterMin: C.waterMin, waterFruit: C.waterFruit, witherAfter: C.witherAfter, fruitStart: C.fruitStart, treeVideo: C.treeVideo || '', support: C.support || '', replayReward: !!C.replayReward },
      prog: { dinor: p.dinor || 0, hearts: p.hearts || 0, days: p.days || 0, streak: p.streak || 0, lessons: p.lessons || 0, earned: p.earned || 0, sold: p.sold || 0, spent: p.spent || 0, lang: p.lang || 'uz', dark: !!p.dark },
      path, cur: G.current(p, L), garden: G.garden(p, C), sess: p.sess ? G.sessPublic(p.sess) : null,
    };
  }

  const H = {
    async me({ c, user }) {
      return lock(c.id, async () => { const p = await loadProg(c, user); await applyOps(c.id, p); await saveProg(p);
        const [C, L, groups] = await Promise.all([cfg(), letters(), store.list('ar_groups', { ttl: 30000 })]); return meView(c, p, C, L, groups); });
    },
    async lesson({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg(); const L = await letters();
        const r = G.startLesson(p, L, String(b.lid || ''), +b.part, C, { tester: !!c.tester }); if (r.error) throw new ApiError(400, r.error, r.code);
        await saveProg(p); return { sess: G.sessPublic(r.sess), hearts: p.hearts }; });
    },
    async review({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg(); const L = await letters();
        const mode = b.mode === 'water' ? 'water' : 'heart';
        const r = G.startReview(p, L, mode, C, { lid: String(b.lid || '') }); if (r.error) throw new ApiError(400, r.error, r.code);
        await saveProg(p); if (r.refilled) return { refilled: true, hearts: p.hearts };
        return { sess: G.sessPublic(r.sess), hearts: p.hearts }; });
    },
    async step({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg();
        const r = G.step(p, b, C, clock()); if (r.error && r.code !== 'sync') throw new ApiError(400, r.error, r.code);
        await saveProg(p); if (r.end) r.garden = G.garden(p, C); r.dinor = p.dinor; return r; });
    },
    async quit({ c, user }) {
      return lock(c.id, async () => { const p = await loadProg(c, user); p.sess = null; await saveProg(p); return { ok: true, hearts: p.hearts }; });
    },
    async sell({ c, user }) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg(); const r = G.sell(p, C); if (r.error) throw new ApiError(400, r.error);
        await saveProg(p); r.garden = G.garden(p, C); return r; });
    },
    async rating({ c }) { const R = G.rating(await store.list('ar_prog', { ttl: 15000 }), c.id, 50); return R; },
    async market() {
      const P = (await store.list('ar_products', { ttl: 20000 })).filter(x => x.active !== false)
        .sort((a, b) => (+a.order || 0) - (+b.order || 0) || (+a.price || 0) - (+b.price || 0));
      return { items: P.map(x => ({ id: x.id, name: x.name || '', desc: x.desc || '', img: x.img || '', price: +x.price || 0, stock: x.stock === '' || x.stock == null ? null : +x.stock })) };
    },
    async buy({ c, user }, b) {
      const ph = digits(b.phone); if (ph.length < 9 || ph.length > 15) throw new ApiError(400, 'Telefon raqamni toʻgʻri kiriting');
      return lock(c.id, async () => {
        const pr = await store.get('ar_products', String(b.pid || '')); if (!pr || pr.active === false) throw new ApiError(404, 'Mahsulot topilmadi');
        const price = +pr.price || 0; const stock = pr.stock === '' || pr.stock == null ? null : +pr.stock;
        if (stock !== null && stock <= 0) throw new ApiError(400, 'Mahsulot tugagan');
        const p = await loadProg(c, user); if ((p.dinor || 0) < price) throw new ApiError(400, `Dinor yetarli emas: ${price} kerak, sizda ${p.dinor || 0}`, 'poor');
        p.dinor -= price; p.spent = (p.spent || 0) + price; await saveProg(p);
        const id = G.uid(); const at = clock().toISOString();
        const ord = { code: c.id, tgId: user.id, name: p.name, username: user.username || '', phone: (ph.length === 9 ? '+998' : '+') + ph, productId: pr.id, productName: pr.name || '', price, status: 'new', at, note: String(b.note || '').slice(0, 300) };
        await store.put('ar_orders', id, ord);
        if (stock !== null) await store.put('ar_products', pr.id, Object.assign(pr, { stock: stock - 1 }));
        try { await onOrder(Object.assign({ id }, ord)); } catch (e) { }
        return { ok: true, order: Object.assign({ id }, ord), dinor: p.dinor };
      });
    },
    async orders({ c }) {
      const O = (await store.find('ar_orders', 'code', c.id)).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30);
      return { items: O.map(o => ({ id: o.id, productName: o.productName, price: o.price, status: o.status, at: o.at })) };
    },
    async settings({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user);
        if (['uz', 'cy', 'ru'].includes(b.lang)) p.lang = b.lang; if (typeof b.dark === 'boolean') p.dark = b.dark;
        await saveProg(p); return { lang: p.lang, dark: p.dark }; });
    },
  };

  const hits = new Map();
  async function handle(name, body) {
    try {
      if (!Object.prototype.hasOwnProperty.call(H, name)) throw new ApiError(404, 'Topilmadi');
      const a = await auth(body && body.initData);
      const k = a.user.id; const now = Date.now(); const h = (hits.get(k) || []).filter(t => now - t < 10000); h.push(now); hits.set(k, h);
      if (h.length > 40) throw new ApiError(429, 'Juda tez — biroz kuting');
      return { status: 200, body: await H[name](a, body || {}) };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, body: { error: e.message, code: e.code } };
      console.error('api', name, e); return { status: 500, body: { error: 'Server xatosi: ' + e.message } };
    }
  }
  return { handle, applyOps, lock, cfg, auth };
}

module.exports = { createApi, verifyInitData, signInitData, ApiError };
