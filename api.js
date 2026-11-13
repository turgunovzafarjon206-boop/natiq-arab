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

function createApi({ store, token, onOrder = async () => {}, onPay = async () => {}, onNotify = async () => {}, clock = () => new Date() }) {
  const locks = new Map();
  const lock = (k, fn) => { const prev = locks.get(k) || Promise.resolve(); const p = prev.then(fn, fn); const tail = p.catch(() => {}); locks.set(k, tail);
    tail.then(() => { if (locks.get(k) === tail) locks.delete(k); }); return p; };
  let cfgC = null;
  async function cfg(fresh) { if (!fresh && cfgC && Date.now() - cfgC.at < 15000) return cfgC.v; const v = G.cfgOf(await store.get('ar_cfg', 'main')); cfgC = { at: Date.now(), v }; return v; }
  /* «tg:17» — bot orqali yuklangan media (ar_media) havolasiga almashtiriladi; hali yuklanmagan boʻlsa — boʻsh */
  let medC = null;
  async function mediaMap() { if (medC && Date.now() - medC.at < 15000) return medC.m; const m = new Map((await store.list('ar_media', { ttl: 15000 })).filter(x => x.status === 'ready' && x.url).map(x => [String(x.id), x.url])); medC = { at: Date.now(), m }; return m; }
  const resolveTg = (v, M) => typeof v === 'string' ? v.replace(/^tg:(\d+)/, (_, n) => M.get(n) || '') : Array.isArray(v) ? v.map(x => resolveTg(x, M)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveTg(x, M)])) : v;
  /* kurslar: yashirin kurs darslari koʻrinmaydi; kursi yoʻq (yoki oʻchirilgan) dars — «Harflar» kursida */
  let crsC = null;
  async function courses() { const raw = await store.list('ar_courses', { ttl: 30000 }); if (crsC && crsC.raw === raw) return crsC; crsC = { raw, list: G.courseList(raw), hidden: new Set(raw.filter(c => c && c.hidden).map(c => String(c.id))) }; return crsC; }
  let letC = null;
  async function letters() { const raw = await store.list('ar_letters', { ttl: 30000 }); const M = await mediaMap(); const CR = await courses();
    if (letC && letC.raw === raw && letC.m === M && letC.cr === CR) return letC.v; const known = new Set(CR.list.map(c => c.id));
    const v = resolveTg(raw.filter(l => !CR.hidden.has(String(l.course || ''))), M).map(l => { l.course = known.has(String(l.course || '')) ? String(l.course) : G.DEF_COURSE; const P = l.parts || {};   // rasmli variant «tg:5 = olma» → yuklanmagan boʻlsa olib tashlanadi
      ['video', 'rules', 'final', 'vocab'].forEach(k => (P[k] && P[k].tests || []).forEach(q => { if (q && q.type === 'image' && Array.isArray(q.opts)) q.opts = q.opts.map(o => /^\s*=/.test(o) ? '' : o); })); return l; });
    /* bir marta yozilgan ovoz hamma joyda: karta/lugʻatdagi soʻz audiosi shu matnli testlarga ham qoʻyiladi;
       bir necha soʻzli matn (jumla tuzish) — soʻzlar audiosi ketma-ket («|» bilan) */
    const AM = new Map();
    v.forEach(l => { const P = l.parts || {}; [...((P.cards || {}).cards || []), ...((P.vocab || {}).words || [])].forEach(c => { if (c && c.ar && c.audio && !AM.has(c.ar)) AM.set(c.ar, c.audio); }); });
    const fill = t => { t = String(t || '').trim(); if (!t) return ''; if (AM.has(t)) return AM.get(t); const ws = t.split(/\s+/); return ws.length > 1 && ws.every(w => AM.has(w)) ? ws.map(w => AM.get(w)).join('|') : ''; };
    v.forEach(l => { const P = l.parts || {};
      ['video', 'rules', 'final', 'vocab'].forEach(k => (P[k] && P[k].tests || []).forEach(q => { if (q && !q.audio) { const a = fill(q.say); if (a) q.audio = a; } }));
      [...((P.cards || {}).cards || []), ...((P.vocab || {}).words || [])].forEach(c => { if (c && !c.audio) { const a = fill(c.ar); if (a) c.audio = a; } }); });
    letC = { raw, m: M, cr: CR, v }; return v; }
  const openOf = (c, p, CS, L) => new Set(G.courseStates(p, c, CS, L).filter(x => x.open).map(x => x.id));
  const pidOf = code => crypto.createHmac('sha256', String(token || 'natiq')).update('pid:' + code).digest('hex').slice(0, 12);

  /* tezlik: tekshirilgan foydalanuvchi va oʻquvchi holati xotirada; bazaga yozish fonda (navbat bilan) */
  const AUTH_TTL = 30000, PROG_TTL = 10 * 60e3;
  const authC = new Map(), progC = new Map(), pend = new Map();
  async function auth(initData, fresh) {
    const user = verifyInitData(initData, token); if (!user || !user.id) throw new ApiError(401, 'Telegram maʼlumoti tasdiqlanmadi. Ilovani bot orqali qayta oching', 'auth');
    const k = String(user.id); const hit = !fresh && authC.get(k);
    if (hit && Date.now() - hit.at < AUTH_TTL) return { user, tg: hit.tg, c: hit.c };
    const tg = await store.get('ar_tg', user.id); const c = tg && tg.code ? await store.get('ar_codes', tg.code) : null;
    authC.delete(k);
    if (!c || String(c.tgId) !== String(user.id)) throw new ApiError(403, 'Avval botda /start bosing va ID kodingizni kiriting', 'not_linked');
    if (c.status === 'blocked') throw new ApiError(403, 'ID kodingiz bloklangan. Administrator bilan bogʻlaning', 'blocked');
    authC.set(k, { tg, c, at: Date.now() });
    return { user, tg, c };
  }
  async function getProg(code) { const h = progC.get(code); if (h && Date.now() - h.at < PROG_TTL) return h.p;
    const p = await store.get('ar_prog', code); if (p) progC.set(code, { p, at: Date.now() }); return p; }
  async function loadProg(c, user) {
    const C = await cfg(); let p = await getProg(c.id);
    if (!p) { p = G.freshProg(c.id, { hearts: C.maxHearts }); progC.set(c.id, { p, at: Date.now() }); }
    p.name = c.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Oʻquvchi';
    p.tgId = user.id; p.group = c.groupId || ''; p.hideRank = !!c.hideRank;
    return p;
  }
  function flushCode(code) {
    const st = pend.get(code) || {}; pend.set(code, st);
    if (st.busy) { st.dirty = true; return st.busy; }
    st.busy = (async () => { let tries = 0;
      do { st.dirty = false; const h = progC.get(code); if (!h) break;
        try { await store.put('ar_prog', code, JSON.parse(JSON.stringify(h.p))); }
        catch (e) { console.error('saqlash', code, e.message); if (++tries < 5) { st.dirty = true; await new Promise(r => setTimeout(r, 1000 * tries)); } }
      } while (st.dirty); })().finally(() => { st.busy = null; if (st.dirty) flushCode(code); });
    return st.busy;
  }
  const saveProg = (p, wait) => { progC.set(p.code, { p, at: Date.now() }); const pr = flushCode(p.code); return wait ? pr : undefined; };
  const flush = () => Promise.all([...pend.values()].map(st => st.busy).filter(Boolean));
  const drop = code => { progC.delete(code); };

  /* admin amallari: dinor qoʻshish, jon, qaytarish (refund), qayta boshlash */
  async function applyOps(code, prog) {
    const ops = (await store.find('ar_ops', 'code', code)).filter(o => o.status === 'pending').sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    if (!ops.length) return 0;
    const C = await cfg(); let p = prog || await getProg(code) || G.freshProg(code, { hearts: C.maxHearts });
    for (const o of ops) { const okk = G.applyOp(p, o, C); await store.put('ar_ops', o.id, Object.assign({}, o, { status: okk ? 'done' : 'error', doneAt: clock().toISOString() }));
      if (okk && o.msg) { try { await onNotify(code, String(o.msg)); } catch (e) { console.error('xabar', code, e.message); } }
      if (o.payId) { const py = await store.get('ar_pays', o.payId); if (py) await store.put('ar_pays', py.id, Object.assign(py, { status: o.type === 'dinor' ? 'ok' : 'rejected', doneAt: clock().toISOString() })); }
      if (o.type === 'refund' && o.orderId) { const ord = await store.get('ar_orders', o.orderId); if (ord) await store.put('ar_orders', ord.id, Object.assign(ord, { status: 'refunded', refundedAt: clock().toISOString() })); } }
    if (!prog) await saveProg(p, true); return ops.length;
  }

  function meView(c, p, C, L, groups, CS) {
    const S = G.sorted(L); const g = (groups || []).find(x => x.id === c.groupId) || null; const tester = !!c.tester;
    const cst = G.courseStates(p, c, CS, L); const open = new Set(cst.filter(x => x.open).map(x => x.id));
    const path = CS.flatMap(cr => S.filter(l => G.courseOf(l) === cr.id)).map(l => { const d = (p.done || {})[l.id] || 0;
      return { id: l.id, course: G.courseOf(l), letter: l.letter || '', name: l.name || '', tr: l.tr || '', done: d,
        parts: G.PARTS.map((P, i) => ({ p: i + 1, k: P.k, n: P.n, ok: G.hasContent(l, i + 1, C, L), open: G.unlocked(p, L, l.id, i + 1, tester, open) })) }; });
    return {
      user: { name: p.name, code: c.id, pid: pidOf(c.id), phone: c.tgPhone || '', tester, noVideo: !!c.noVideo && !tester, group: g ? { name: g.name || '', days: g.days || [], time: g.time || '', dur: g.dur || '', meet: g.meet || '', note: g.note || '' } : null },
      cfg: { appName: C.appName, primary: C.primary, accent: C.accent, fruitPrice: C.fruitPrice, maxHearts: C.maxHearts, rw: C.rw, reviewQ: C.reviewQ, heartPer: C.heartPer,
        waterQ: C.waterQ, waterMin: C.waterMin, waterFruit: C.waterFruit, witherAfter: C.witherAfter, fruitStart: C.fruitStart, treeVideo: C.treeVideo || '', support: C.support || '', replayReward: !!C.replayReward },
      prog: { dinor: p.dinor || 0, hearts: p.hearts || 0, days: p.days || 0, lastDay: p.lastDay || '', streak: p.streak || 0, lessons: p.lessons || 0, earned: p.earned || 0, sold: p.sold || 0, spent: p.spent || 0, lang: p.lang || 'uz', dark: !!p.dark },
      courses: cst, path, cur: G.current(p, L, open, CS), garden: G.garden(p, C), sess: p.sess ? G.sessPublic(p.sess) : null,
    };
  }

  /* barcha oʻquvchilar (xotiradagi eng yangi holati bilan) */
  async function allProgs() { const L = await store.list('ar_prog', { ttl: 15000 }); const M = new Map(L.map(p => [p.code || p.id, p]));
    for (const [k, h] of progC) M.set(k, Object.assign({}, M.get(k) || {}, h.p)); return [...M.values()].filter(p => p && p.code); }
  const byPid = (P, pid) => P.find(x => pidOf(x.code) === String(pid || '')) || null;
  const followersOf = (P, code) => P.filter(x => !x.hideRank && x.code !== code && (x.follows || []).includes(code));
  const followingOf = (P, t) => { const F = new Set(t.follows || []); return P.filter(x => F.has(x.code) && !x.hideRank); };
  const plansOf = C => (Array.isArray(C.dinorPlans) ? C.dinorPlans : []).map(x => ({ dinor: Math.round(+x.dinor || 0), sum: Math.round(+x.sum || 0) })).filter(x => x.dinor > 0 && x.sum > 0);
  const H = {
    async me({ c, user }) {
      return lock(c.id, async () => { const p = await loadProg(c, user); await applyOps(c.id, p); await saveProg(p);
        const [C, L, groups, CR] = await Promise.all([cfg(), letters(), store.list('ar_groups', { ttl: 30000 }), courses()]); return meView(c, p, C, L, groups, CR.list); });
    },
    async lesson({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg(); const L = await letters();
        const r = G.startLesson(p, L, String(b.lid || ''), +b.part, C, { tester: !!c.tester, noVideo: !!c.noVideo, open: openOf(c, p, (await courses()).list, L) }); if (r.error) throw new ApiError(400, r.error, r.code);
        await saveProg(p); return { sess: G.sessPublic(r.sess), hearts: p.hearts }; });
    },
    async review({ c, user }, b) {
      return lock(c.id, async () => { const p = await loadProg(c, user); const C = await cfg(); const L = await letters();
        const mode = b.mode === 'water' ? 'water' : 'heart';
        const r = G.startReview(p, L, mode, C, { lid: String(b.lid || ''), open: openOf(c, p, (await courses()).list, L) }); if (r.error) throw new ApiError(400, r.error, r.code);
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
    async rating({ c }, b) { return G.rating(await allProgs(), c.id, 50, pidOf, String(b.q || '').slice(0, 40)); },
    /* boshqa oʻquvchi profili: dinor, tugatgan darslar, mevalar, sotib olgan buyumlari, obunachilar */
    async profile({ c, user }, b) {
      const P = await allProgs(); const me = await getProg(c.id) || {}; const t = b.me ? P.find(x => x.code === c.id) || Object.assign({ code: c.id }, me) : byPid(P, b.pid);
      if (!t) throw new ApiError(404, 'Profil topilmadi'); const isMe = t.code === c.id;
      if (t.hideRank && !isMe) throw new ApiError(403, 'Bu profil yashirilgan');
      const fl = followersOf(P, t.code); const O = (await store.find('ar_orders', 'code', t.code)).filter(o => !['refunded', 'refund', 'cancelled'].includes(o.status));
      const PR = new Map((await store.list('ar_products', { ttl: 20000 })).map(x => [x.id, x]));
      const items = O.sort((a, b2) => String(b2.at).localeCompare(String(a.at))).slice(0, 30).map(o => ({ name: o.productName || '', img: (PR.get(o.productId) || {}).img || '', at: String(o.at || '').slice(0, 10) }));
      const trees = t.trees || [];
      return { pid: pidOf(t.code), name: t.name || 'Oʻquvchi', me: isMe, dinor: +t.dinor || 0, lessons: t.lessons || 0, trees: trees.length, fruit: trees.reduce((a, x) => a + (x.fruit || 0), 0), sold: t.sold || 0,
        days: t.days || 0, streak: t.streak || 0, items, followers: fl.length, following: followingOf(P, t).length, iFollow: (me.follows || []).includes(t.code) };
    },
    async follow({ c, user }, b) {
      return lock(c.id, async () => { const P = await allProgs(); const t = byPid(P, b.pid); if (!t || t.hideRank) throw new ApiError(404, 'Profil topilmadi');
        if (t.code === c.id) throw new ApiError(400, 'Oʻzingizga obuna boʻlib boʻlmaydi');
        const p = await loadProg(c, user); const F = new Set(p.follows || []);
        if (b.on === false) F.delete(t.code); else { if (F.size >= 500) throw new ApiError(400, 'Obunalar soni chegarasiga yetdingiz'); F.add(t.code); }
        p.follows = [...F]; await saveProg(p);
        return { iFollow: F.has(t.code), followers: followersOf(await allProgs(), t.code).length }; });
    },
    async follows({ c }, b) {
      const P = await allProgs(); const t = b.pid ? byPid(P, b.pid) : P.find(x => x.code === c.id); if (!t) throw new ApiError(404, 'Profil topilmadi');
      if (t.hideRank && t.code !== c.id) throw new ApiError(403, 'Bu profil yashirilgan');
      const me = P.find(x => x.code === c.id) || {}; const mine = new Set(me.follows || []);
      const L = (b.kind === 'following' ? followingOf(P, t) : followersOf(P, t.code)).map(x => ({ pid: pidOf(x.code), name: x.name || 'Oʻquvchi', dinor: +x.dinor || 0, lessons: x.lessons || 0, me: x.code === c.id, iFollow: mine.has(x.code) }))
        .sort((a, b2) => b2.dinor - a.dinor); const q = String(b.q || '').trim().toLowerCase();
      return { kind: b.kind === 'following' ? 'following' : 'followers', name: t.name || '', items: (q ? L.filter(x => x.name.toLowerCase().includes(q)) : L).slice(0, 300), total: L.length };
    },
    /* dinor sotib olish: tarif → kartaga toʻlov → chek rasmi → admin tasdiqlaydi (dinorni pulga almashtirib boʻlmaydi) */
    async plans({ c }) { const C = await cfg();
      const mine = (await store.find('ar_pays', 'code', c.id)).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
      return { plans: plansOf(C), card: C.payCard || '', holder: C.payName || '', note: C.payNote || '', items: mine.map(x => ({ id: x.id, dinor: x.dinor, sum: x.sum, status: x.status, at: x.at, reason: x.reason || '' })) };
    },
    async pay({ c, user }, b) {
      const C = await cfg(); const pl = plansOf(C)[+b.plan]; if (!pl) throw new ApiError(400, 'Tarifni tanlang');
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.img || '')); if (!m) throw new ApiError(400, 'Chek rasmini yuklang');
      const buf = Buffer.from(m[2], 'base64'); if (buf.length < 2000) throw new ApiError(400, 'Rasm juda kichik — chekni aniq suratga oling'); if (buf.length > 3.5 * 1048576) throw new ApiError(400, 'Rasm juda katta (3 MB gacha)');
      const pend = (await store.find('ar_pays', 'code', c.id)).filter(x => x.status === 'new'); if (pend.length >= 3) throw new ApiError(400, 'Oldingi toʻlovlaringiz tekshirilmoqda — admin tasdiqlashini kuting');
      const id = G.uid(); const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg'; const path = 'pay/' + id + crypto.randomBytes(6).toString('hex') + '.' + ext;
      await store.upload('arab', path, buf, m[1]); const img = store.publicUrl ? store.publicUrl('arab', path) : path;
      const p = await getProg(c.id) || {};
      const x = { code: c.id, tgId: user.id, name: p.name || c.name || '', username: user.username || '', dinor: pl.dinor, sum: pl.sum, img, status: 'new', at: clock().toISOString() };
      await store.put('ar_pays', id, x); try { await onPay(Object.assign({ id }, x)); } catch (e) { }
      return { ok: true, item: { id, dinor: x.dinor, sum: x.sum, status: x.status, at: x.at } };
    },
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
        p.dinor -= price; p.spent = (p.spent || 0) + price; await saveProg(p, true);
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
      const a = await auth(body && body.initData, name === 'me');
      const k = a.user.id; const now = Date.now(); const h = (hits.get(k) || []).filter(t => now - t < 10000); h.push(now); hits.set(k, h);
      if (h.length > 40) throw new ApiError(429, 'Juda tez — biroz kuting');
      return { status: 200, body: await H[name](a, body || {}) };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, body: { error: e.message, code: e.code } };
      console.error('api', name, e); return { status: 500, body: { error: 'Server xatosi: ' + e.message } };
    }
  }
  return { handle, applyOps, lock, cfg, auth, flush, drop };
}

module.exports = { createApi, verifyInitData, signInitData, ApiError };
