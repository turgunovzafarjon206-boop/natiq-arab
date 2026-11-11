/* Natiq Arab — oʻyin qoidalari (sof mantiq, tarmoqsiz — sinovlar shu faylni tekshiradi).
   Darslar: har bir harf = 5 qism (video · qoidalar · talaffuz kartalari · yakuniy test · lugʻat).
   Jon (yurak): doim 5 ta; xato javob → −1. Jon tugasa qism toʻxtaydi, dinor berilmaydi.
   Takrorlash: 10 savol, har 2 toʻgʻri javob = 1 jon. Bogʻ: har harf = 1 daraxt (5 bosqich). */
const crypto = require('crypto');

const DEF_CFG = {
  appName: 'Natiq Arab', botBtn: 'Arab tili',
  welcomeText: 'Assalomu alaykum! 🌙\nNatiq Academy’ning «Natiq Arab» ilovasiga xush kelibsiz.\nArab tilini oʻyin orqali, qadamma-qadam oʻrganing: darslar, dinor, bogʻ va sovgʻalar sizni kutmoqda.\n\nPastdagi tugmani bosing 👇',
  welcomeImg: '', primary: '#E9A800', accent: '#16A34A',
  maxHearts: 5, reviewQ: 10, heartPer: 2,               // takrorlash: 10 savol, 2 toʻgʻri = 1 jon
  waterQ: 5, waterMin: 3, waterPerDay: 1, waterFruit: 1, // sugʻorish: 5 savol, kamida 3 toʻgʻri
  fruitStart: 3, witherAfter: 4, fruitPrice: 2,          // 5-qismda 3 meva; keyingi 4 daraxt meva solsa — quriydi
  rw: { video: 3, q: 1, card: 1 }, replayReward: false, finalMax: 15,
  notifyChats: '', support: '',
};
const PARTS = [
  { k: 'video', n: 'Video dars' }, { k: 'rules', n: 'Qoidalar' }, { k: 'cards', n: 'Talaffuz' },
  { k: 'final', n: 'Yakuniy test' }, { k: 'vocab', n: 'Lugʻat' },
];
const STAGES = ['', 'Nihol ekildi', 'Unib chiqdi', 'Nihol boʻldi', 'Daraxt boʻldi', 'Meva soldi'];

const sid = () => Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
const cfgOf = c => { const x = Object.assign({}, DEF_CFG, c || {}); x.rw = Object.assign({}, DEF_CFG.rw, (c && c.rw) || {});
  ['maxHearts', 'reviewQ', 'heartPer', 'waterQ', 'waterMin', 'waterPerDay', 'waterFruit', 'fruitStart', 'witherAfter', 'fruitPrice', 'finalMax'].forEach(k => { x[k] = Math.max(0, +x[k] || 0); });
  x.maxHearts = x.maxHearts || 5; x.heartPer = x.heartPer || 2; x.reviewQ = x.reviewQ || 10; x.waterQ = x.waterQ || 5; x.witherAfter = x.witherAfter || 4;
  return x; };

/* Toshkent vaqti (UTC+5) */
const tzDate = (d = new Date()) => new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

const uniq = (arr, k) => { const s = new Set(); return arr.filter(x => !s.has(x[k]) && s.add(x[k])); };
function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sorted = letters => (letters || []).filter(l => !l.hidden).slice().sort((a, b) => (+a.order || 0) - (+b.order || 0) || String(a.id).localeCompare(String(b.id)));

function freshProg(code, extra) {
  return Object.assign({ code, dinor: 0, hearts: DEF_CFG.maxHearts, done: {}, trees: [], full: 0, days: 0, lastDay: '', streak: 0,
    earned: 0, spent: 0, sold: 0, lessons: 0, answers: 0, correct: 0, lang: 'uz', dark: false, sess: null, created: new Date().toISOString() }, extra || {});
}

/* ---------- savollar ---------- */
function normQ(q, id) {
  const opts = (q.opts || []).map(String).filter(s => s.trim() !== '');
  const a = Math.min(Math.max(+q.a || 0, 0), Math.max(opts.length - 1, 0));
  return { id: q.id || id, q: String(q.q || ''), ru: q.ru || '', ar: q.ar || '', say: q.say || '', audio: q.audio || '', img: q.img || '', opts, a };
}
const validQ = q => q && q.opts && q.opts.length >= 2;

/* lugʻatdan avtomatik savollar (admin test yozmagan boʻlsa) */
function wordQs(words, lid, pool, rnd = Math.random) {
  const W = (words || []).filter(w => w && w.ar && w.uz); const all = (pool && pool.length ? pool : W).filter(w => w && w.ar && w.uz);
  const out = [];
  W.forEach((w, i) => {
    const others = uniq(uniq(shuffle(all.filter(x => x.uz !== w.uz && x.ar !== w.ar), rnd), 'uz'), 'ar').slice(0, 3); if (!others.length) return;
    const o1 = shuffle([w.uz, ...others.map(x => x.uz)], rnd);
    out.push({ id: `${lid}:w:${i}:a`, q: 'Bu soʻz qanday tarjima qilinadi?', ru: 'Как переводится это слово?', ar: w.ar, say: w.audio ? '' : w.ar, audio: w.audio || '', img: '', opts: o1, a: o1.indexOf(w.uz) });
    const o2 = shuffle([w.ar, ...others.map(x => x.ar)], rnd);
    out.push({ id: `${lid}:w:${i}:b`, q: `«${w.uz}» arabcha qanday boʻladi?`, ru: w.ru ? `Как по-арабски «${w.ru}»?` : '', ar: '', say: '', audio: '', img: '', opts: o2, a: o2.indexOf(w.ar), arOpts: true });
  });
  return out;
}
/* talaffuz kartalaridan eshitish savollari (takrorlash uchun) */
function cardQs(cards, lid, rnd = Math.random) {
  const C = uniq((cards || []).filter(c => c && c.ar), 'ar'); if (C.length < 2) return [];
  return C.map((c, i) => { const o = shuffle([c.ar, ...shuffle(C.filter(x => x.ar !== c.ar), rnd).slice(0, 3).map(x => x.ar)], rnd);
    return { id: `${lid}:c:${i}`, q: 'Qaysi biri eshitildi?', ru: 'Что прозвучало?', ar: '', say: c.audio ? '' : c.ar, audio: c.audio || '', img: '', opts: o, a: o.indexOf(c.ar), arOpts: true }; });
}

/* harfning p-qismidagi savollar (admin yozgani) */
function partTests(L, p) { const P = (L.parts || {})[PARTS[p - 1].k] || {}; return (P.tests || []).map((q, i) => normQ(q, `${L.id}:${p}:${i}`)).filter(validQ); }

function allWords(letters) { const out = []; sorted(letters).forEach(L => (((L.parts || {}).vocab || {}).words || []).forEach(w => out.push(w))); return out; }

/* qism tarkibi (ketma-ket elementlar) */
function partItems(L, p, cfg, letters, rnd = Math.random) {
  const P = (L.parts || {})[PARTS[p - 1].k] || {}; const items = [];
  if (p === 1) { if (P.video) items.push({ t: 'video', url: P.video, title: P.title || '', desc: P.desc || '' }); items.push(...partTests(L, 1)); }
  if (p === 2) { if (P.text) items.push({ t: 'rule', title: P.title || '', text: P.text, ru: P.ru || '', img: P.img || '' }); items.push(...partTests(L, 2)); }
  if (p === 3) (P.cards || []).filter(c => c && c.ar).forEach(c => items.push({ t: 'card', ar: c.ar, tr: c.tr || '', uz: c.uz || '', ru: c.ru || '', audio: c.audio || '', img: c.img || '' }));
  if (p === 4) {
    let qs = partTests(L, 4);
    if (!qs.length) { const V = (L.parts || {}).vocab || {};
      qs = [...partTests(L, 1), ...partTests(L, 2), ...partTests(L, 5), ...cardQs((L.parts.cards || {}).cards, L.id, rnd), ...(partTests(L, 5).length ? [] : wordQs(V.words, L.id, allWords(letters), rnd))]; }
    items.push(...shuffle(qs, rnd).slice(0, cfg.finalMax || 15));
  }
  if (p === 5) { const W = (P.words || []).filter(w => w && w.ar);
    if (W.length) items.push({ t: 'words', words: W.map(w => ({ ar: w.ar, tr: w.tr || '', uz: w.uz || '', ru: w.ru || '', audio: w.audio || '', img: w.img || '' })) });
    const T = partTests(L, 5); items.push(...(T.length ? T : wordQs(W, L.id, allWords(letters), rnd))); }
  return items;
}
const hasContent = (L, p, cfg, letters) => partItems(L, p, cfg || DEF_CFG, letters, () => 0.5).length > 0;

/* ---------- ochilish tartibi ---------- */
function unlocked(prog, letters, lid, p, tester) {
  if (tester) return true;
  const S = sorted(letters); const k = S.findIndex(l => l.id === lid); if (k < 0) return false;
  const done = (prog.done || {})[lid] || 0;
  if (p <= done + 1 && p > 1) return true;
  if (p === 1) return k === 0 || ((prog.done || {})[S[k - 1].id] || 0) >= 5 || done >= 1;
  return false;
}
/* hozirgi (keyingi) qism */
function current(prog, letters) {
  for (const L of sorted(letters)) { const d = (prog.done || {})[L.id] || 0; if (d < 5) return { lid: L.id, part: d + 1 }; }
  return null;
}

/* ---------- jon / faol kun ---------- */
function markDay(prog, now = new Date()) {
  const d = tzDate(now); if (prog.lastDay === d) return false;
  prog.streak = prog.lastDay && dayDiff(prog.lastDay, d) === 1 ? (prog.streak || 0) + 1 : 1;
  prog.days = (prog.days || 0) + 1; prog.lastDay = d; return true;
}

/* takrorlash savollari: oʻtilgan joygacha (bajarilgan qismlar + hozirgi ochiq qism) */
function reviewPool(prog, letters, cfg, rnd = Math.random) {
  const pool = []; const W = allWords(letters);
  for (const L of sorted(letters)) {
    const d = (prog.done || {})[L.id] || 0; const upto = Math.min(5, d + 1);
    for (let p = 1; p <= upto; p++) {
      const T = partTests(L, p); pool.push(...T);
      if (p === 3) pool.push(...cardQs(((L.parts || {}).cards || {}).cards, L.id, rnd));
      if (p === 5 && !T.length) pool.push(...wordQs(((L.parts || {}).vocab || {}).words, L.id, W, rnd));
    }
    if (d < 5) break;
  }
  const seen = new Set(); return pool.filter(q => validQ(q) && !seen.has(q.id) && seen.add(q.id));
}

/* ---------- sessiya ---------- */
function pub(it) { const x = Object.assign({}, it); delete x.a; delete x.id; return x; }
function prepQ(q, rnd) {   // variantlarni aralashtiramiz — toʻgʻri javob indeksi faqat serverda
  const idx = shuffle(q.opts.map((_, i) => i), rnd);
  return Object.assign({}, q, { t: 'q', opts: idx.map(i => q.opts[i]), a: idx.indexOf(q.a) });
}
function sessPublic(s) {
  return { sid: s.sid, mode: s.mode, lid: s.lid, part: s.part, title: s.title, i: s.i, n: s.items.length, gain: s.gain, ok: s.ok, replay: !!s.replay, pay: !!s.pay,
    items: s.items.map(pub), tree: s.tree || null };
}

function startLesson(prog, letters, lid, part, cfg, opts = {}) {
  cfg = cfgOf(cfg); const rnd = opts.rnd || Math.random; part = +part;
  const L = (letters || []).find(l => l.id === lid); if (!L || part < 1 || part > 5) return { error: 'Dars topilmadi' };
  if (!unlocked(prog, letters, lid, part, opts.tester)) return { error: 'Bu qism hali ochilmagan — avvalgi qismlarni tugating' };
  if ((prog.hearts || 0) <= 0) return { error: 'Jonlaringiz tugagan. Takrorlash orqali jon yigʻing', code: 'no_hearts' };
  const items = partItems(L, part, cfg, letters, rnd).map(it => it.t ? it : prepQ(it, rnd));
  if (!items.length) return { error: 'Bu qism hali tayyorlanmoqda', code: 'empty' };
  const replay = ((prog.done || {})[lid] || 0) >= part;
  const s = { sid: sid(), mode: 'lesson', lid, part, title: `${L.letter || ''} ${L.name || ''} · ${PARTS[part - 1].n}`.trim(), items, i: 0, gain: 0, ok: 0, bad: 0,
    replay, pay: !replay || !!cfg.replayReward, at: Date.now() };
  prog.sess = s; return { sess: s };
}

function startReview(prog, letters, mode, cfg, opts = {}) {
  cfg = cfgOf(cfg); const rnd = opts.rnd || Math.random;
  if (mode === 'water') {
    const t = (prog.trees || []).find(x => x.lid === opts.lid); if (!t) return { error: 'Daraxt topilmadi' };
    const w = waterState(prog, t, cfg); if (!w.can) return { error: w.why };
  } else if ((prog.hearts || 0) >= cfg.maxHearts) return { error: 'Jonlaringiz toʻla ❤️', code: 'full' };
  const pool = reviewPool(prog, letters, cfg, rnd);
  const n = mode === 'water' ? cfg.waterQ : cfg.reviewQ;
  if (!pool.length) { if (mode !== 'water') { prog.hearts = cfg.maxHearts; return { refilled: true }; } return { error: 'Takrorlash uchun savollar hali yoʻq' }; }
  let qs = shuffle(pool, rnd); while (qs.length < n && pool.length) qs = qs.concat(shuffle(pool, rnd)); qs = qs.slice(0, n);
  const s = { sid: sid(), mode, lid: opts.lid || '', part: 0, title: mode === 'water' ? 'Sugʻorish' : 'Takrorlash', items: qs.map(q => prepQ(q, rnd)), i: 0, gain: 0, ok: 0, bad: 0, pay: false, at: Date.now() };
  prog.sess = s; return { sess: s };
}

/* bitta qadam: javob / koʻrdim / eshitdim / davom */
function step(prog, body, cfg, now = new Date()) {
  cfg = cfgOf(cfg); const s = prog.sess;
  if (!s || s.sid !== body.sid) return { error: 'Sessiya tugagan — qaytadan boshlang', code: 'no_sess' };
  if (+body.i !== s.i) return { error: 'Sinxron emas', code: 'sync', i: s.i, hearts: prog.hearts, gain: s.gain };
  const it = s.items[s.i]; const res = { i: s.i };
  if (it.t === 'q') {
    const c = +body.choice; const right = c === it.a; res.correct = right; res.answer = it.a; prog.answers = (prog.answers || 0) + 1;
    if (right) { s.ok++; prog.correct = (prog.correct || 0) + 1; if (s.pay) s.gain += cfg.rw.q; }
    else { s.bad++; if (s.mode === 'lesson') prog.hearts = Math.max(0, (prog.hearts || 0) - 1); }
  } else if (it.t === 'video') { if (s.pay) s.gain += cfg.rw.video; }
  else if (it.t === 'card') { if (s.pay) s.gain += cfg.rw.card; }
  s.i++; res.hearts = prog.hearts; res.gain = s.gain;
  if (s.mode === 'lesson' && prog.hearts <= 0) {           // jon tugadi — qism toʻxtaydi, dinor berilmaydi
    res.fail = true; res.lost = s.gain; prog.sess = null; prog.fails = (prog.fails || 0) + 1; return res;
  }
  if (s.i >= s.items.length) res.end = finish(prog, cfg, now);
  return res;
}

function finish(prog, cfg, now = new Date()) {
  const s = prog.sess; prog.sess = null; markDay(prog, now);
  const out = { mode: s.mode, ok: s.ok, total: s.items.filter(x => x.t === 'q').length, gain: 0 };
  if (s.mode === 'lesson') {
    out.gain = s.gain; prog.dinor = (prog.dinor || 0) + s.gain; prog.earned = (prog.earned || 0) + s.gain;
    const before = (prog.done || {})[s.lid] || 0; prog.done = prog.done || {};
    if (s.part > before) prog.done[s.lid] = s.part;
    if (s.part === 5 && before < 5) prog.lessons = (prog.lessons || 0) + 1;
    out.tree = grow(prog, s.lid, prog.done[s.lid], cfg); out.part = s.part; out.replay = !!s.replay;
  } else if (s.mode === 'heart') {
    const add = Math.min(Math.floor(s.ok / cfg.heartPer), cfg.maxHearts - (prog.hearts || 0));
    prog.hearts = (prog.hearts || 0) + Math.max(0, add); out.hearts = Math.max(0, add);
  } else if (s.mode === 'water') {
    out.watered = s.ok >= cfg.waterMin; out.need = cfg.waterMin;
    if (out.watered) out.tree = water(prog, s.lid, cfg, now);
  }
  out.dinor = prog.dinor; out.heartsNow = prog.hearts; return out;
}

/* ---------- bogʻ ---------- */
function grow(prog, lid, stage, cfg) {
  prog.trees = prog.trees || []; let t = prog.trees.find(x => x.lid === lid);
  if (!t) { t = { lid, stage: 0, fruit: 0, base: 0, at: new Date().toISOString() }; prog.trees.push(t); }
  const was = t.stage; t.stage = Math.max(t.stage || 0, Math.min(5, stage));
  if (t.stage === 5 && !t.full) { t.full = true; prog.full = (prog.full || 0) + 1; t.base = prog.full; t.fruit = (t.fruit || 0) + cfg.fruitStart; }
  return { lid, stage: t.stage, grew: t.stage > was, fruit: t.fruit, msg: STAGES[t.stage] };
}
const isDry = (prog, t, cfg) => !!t.full && ((prog.full || 0) - (t.base || 0)) >= cfgOf(cfg).witherAfter;
function waterState(prog, t, cfg, now = new Date()) {
  cfg = cfgOf(cfg);
  if (!t.full) return { can: false, why: 'Daraxt hali oʻsmoqda — harfning 5 qismini tugating' };
  if (isDry(prog, t, cfg)) return { can: true, dry: true };
  if (!cfg.waterPerDay || !cfg.waterFruit) return { can: false, why: 'Daraxt yashnab turibdi 🌳' };
  const d = tzDate(now); const used = t.wDay === d ? (t.wN || 0) : 0;
  if (used >= cfg.waterPerDay) return { can: false, why: 'Bugun sugʻorildi — ertaga yana sugʻoring' };
  return { can: true, dry: false };
}
function water(prog, lid, cfg, now = new Date()) {
  const t = (prog.trees || []).find(x => x.lid === lid); if (!t) return null;
  const dry = isDry(prog, t, cfg); const d = tzDate(now);
  t.base = prog.full || 0;                                   // qayta tiriladi — hisob yangidan
  if (!dry) { t.fruit = (t.fruit || 0) + cfg.waterFruit; t.wN = (t.wDay === d ? (t.wN || 0) : 0) + 1; t.wDay = d; }
  t.wAt = now.toISOString();
  return { lid, revived: dry, fruit: t.fruit, added: dry ? 0 : cfg.waterFruit };
}
function garden(prog, cfg) {
  cfg = cfgOf(cfg); const T = (prog.trees || []).map(t => Object.assign({}, t, { dry: isDry(prog, t, cfg), water: waterState(prog, t, cfg) }));
  return { trees: T, count: T.length, fruit: T.reduce((a, t) => a + (t.fruit || 0), 0), sellable: T.filter(t => !t.dry).reduce((a, t) => a + (t.fruit || 0), 0), dry: T.filter(t => t.dry).length };
}
function sell(prog, cfg) {
  cfg = cfgOf(cfg); let n = 0;
  (prog.trees || []).forEach(t => { if (!isDry(prog, t, cfg) && t.fruit > 0) { n += t.fruit; t.fruit = 0; } });
  if (!n) return { error: 'Sotish uchun meva yoʻq (quragan daraxt mevasini sotish uchun avval uni sugʻoring)' };
  const gain = n * cfg.fruitPrice; prog.dinor = (prog.dinor || 0) + gain; prog.sold = (prog.sold || 0) + n; prog.earned = (prog.earned || 0) + gain;
  return { sold: n, gain, dinor: prog.dinor };
}

/* ---------- reyting ---------- */
function rating(progs, myCode, limit = 50) {
  const R = (progs || []).filter(p => p && p.code && !p.hideRank).map(p => ({ code: p.code, name: p.name || 'Oʻquvchi', dinor: +p.dinor || 0, lessons: p.lessons || 0, trees: (p.trees || []).length }))
    .sort((a, b) => b.dinor - a.dinor || b.lessons - a.lessons || a.name.localeCompare(b.name));
  R.forEach((r, i) => { r.rank = i + 1; });
  const mine = R.find(r => r.code === myCode) || null;
  const strip = r => ({ rank: r.rank, name: r.name, dinor: r.dinor, lessons: r.lessons, trees: r.trees, me: r.code === myCode });
  return { top: R.slice(0, limit).map(strip), me: mine ? strip(mine) : null, total: R.length };
}

/* ---------- admin amallari (ar_ops) ---------- */
function applyOp(prog, op, cfg) {
  cfg = cfgOf(cfg); const n = Math.round(+op.n || 0);
  if (op.type === 'dinor' || op.type === 'refund') { prog.dinor = Math.max(0, (prog.dinor || 0) + n); if (op.type === 'refund') prog.spent = Math.max(0, (prog.spent || 0) - n); }
  else if (op.type === 'hearts') prog.hearts = Math.min(cfg.maxHearts, Math.max(0, n));
  else if (op.type === 'reset') { const keep = { code: prog.code, name: prog.name, tgId: prog.tgId, lang: prog.lang, dark: prog.dark };
    Object.keys(prog).forEach(k => delete prog[k]); Object.assign(prog, freshProg(keep.code), keep); }
  else return false;
  return true;
}

module.exports = { DEF_CFG, PARTS, STAGES, cfgOf, tzDate, shuffle, sorted, freshProg, normQ, wordQs, cardQs, partItems, partTests, hasContent, unlocked, current,
  markDay, reviewPool, startLesson, startReview, step, finish, grow, isDry, waterState, water, garden, sell, rating, applyOp, sessPublic, uid: sid };
