/* Mashq turlari (Duolingo uslubida). Toʻgʻri javob faqat serverda turadi — ilova faqat koʻrsatadi.
   choice    — variant tanlash (matn yoki arabcha)
   listen    — eshitib, toʻgʻri variantni tanlash
   image     — rasmli variantlar
   truefalse — toʻgʻri / notoʻgʻri
   type      — javobni yozish (masalan: eshitgan soʻz tarjimasi)
   build     — soʻzlardan jumla tuzish (tarjima)
   spell     — harflardan soʻz yigʻish (arabcha)
   match     — juftlarini topish
   speak     — ovoz chiqarib aytish (mikrofon) */
const TYPES = ['choice', 'listen', 'image', 'truefalse', 'type', 'build', 'spell', 'match', 'speak'];
const TYPE_NAMES = { choice: 'Variant tanlash', listen: 'Eshitib tanlash', image: 'Rasmni tanlash', truefalse: 'Toʻgʻri / notoʻgʻri', type: 'Javobni yozish',
  build: 'Jumla tuzish', spell: 'Harflardan soʻz', match: 'Juftini topish', speak: 'Talaffuz qilish' };
const TASH = /[ً-ٰٟـ]/g;

function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* solishtirish uchun: harakatlar, urgʻu belgilari, tinish belgilari, apostroflar olib tashlanadi */
function normText(s) {
  return String(s || '').normalize('NFKC').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(TASH, '')
    .toLowerCase().replace(/[ʻʼ‘’`'ʹ]/g, '').replace(/[.,!?؟،;:«»"()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}
/* arabcha soʻzni harflarga ajratish (harakatlari bilan birga) */
const graphemes = s => String(s || '').match(/[^\sً-ٰٟ][ً-ٰٟ]*/g) || [];
const tokens = s => String(s || '').trim().split(/\s+/).filter(Boolean);
const list = v => (Array.isArray(v) ? v : String(v || '').split(/\n|;/)).map(x => String(x).trim()).filter(Boolean);

function normQ(q, id) {
  const type = TYPES.includes(q.type) ? q.type : 'choice';
  const b = { id: q.id || id, type, q: String(q.q || ''), ru: q.ru || '', ar: q.ar || '', say: q.say || '', audio: q.audio || '', img: q.img || '' };
  if (['choice', 'listen', 'image', 'truefalse'].includes(type)) {
    let opts = (q.opts || []).map(String).filter(s => s.trim() !== '');
    if (type === 'truefalse' && opts.length < 2) opts = ['Toʻgʻri', 'Notoʻgʻri'];
    b.opts = opts; b.a = Math.min(Math.max(+q.a || 0, 0), Math.max(opts.length - 1, 0));
    if (q.arOpts) b.arOpts = true;
  } else if (type === 'type') { b.ans = list(q.ans); b.kb = q.kb || (/[؀-ۿ]/.test(b.ans[0] || '') ? 'ar' : 'lat'); }
  else if (type === 'build' || type === 'spell') { b.words = String(q.words || '').trim(); b.extra = String(q.extra || '').trim(); }
  else if (type === 'match') b.pairs = (q.pairs || []).map(p => [String(p[0] || '').trim(), String(p[1] || '').trim()]).filter(p => p[0] && p[1]);
  else if (type === 'speak') b.tr = q.tr || '';
  return b;
}
function validQ(q) {
  if (!q) return false;
  switch (q.type) {
    case 'type': return q.ans.length > 0;
    case 'build': return tokens(q.words).length > 0;
    case 'spell': return graphemes(q.words).length > 1;
    case 'match': return q.pairs.length >= 2 && new Set(q.pairs.map(p => p[1])).size === q.pairs.length;
    case 'speak': return false;   // mikrofon bilan aytish mashqlari oʻchirilgan
    default: return q.opts && q.opts.length >= 2;
  }
}

/* serverdagi element: ochiq qism + maxfiy kalit (k) */
function prep(q, rnd = Math.random) {
  const it = Object.assign({ t: 'q' }, q); delete it.a; delete it.ans; delete it.pairs; delete it.words; delete it.extra;
  switch (q.type) {
    case 'truefalse': it.opts = q.opts.slice(); it.k = q.a; break;
    case 'type': it.k = q.ans; break;
    case 'build': { it.tiles = shuffle([...tokens(q.words), ...tokens(q.extra)], rnd); it.k = q.words; it.rtl = /[؀-ۿ]/.test(q.words); break; }
    case 'spell': { it.tiles = shuffle([...graphemes(q.words), ...graphemes(q.extra)], rnd); it.k = q.words; break; }
    case 'match': { const idx = shuffle(q.pairs.map((_, i) => i), rnd); it.left = q.pairs.map(p => p[0]); it.right = idx.map(i => q.pairs[i][1]); it.k = q.pairs.map((_, i) => idx.indexOf(i)); break; }
    case 'speak': it.k = null; break;
    default: { const idx = shuffle(q.opts.map((_, i) => i), rnd); it.opts = idx.map(i => q.opts[i]); it.k = idx.indexOf(q.a); }
  }
  return it;
}
/* javobni tekshirish → { correct, answer } (answer — ilovada toʻgʻri javobni koʻrsatish uchun) */
function check(it, body) {
  body = body || {};
  switch (it.type) {
    case 'type': { const g = normText(body.text); return { correct: !!g && it.k.some(a => normText(a) === g), answer: it.k[0] }; }
    case 'build': case 'spell': {
      const arr = Array.isArray(body.tiles) ? body.tiles.map(Number).filter(i => i >= 0 && i < it.tiles.length) : [];
      if (new Set(arr).size !== arr.length) return { correct: false, answer: it.k };
      const a = normText(arr.map(i => it.tiles[i]).join(it.type === 'build' ? ' ' : '')), b = normText(it.k);
      return { correct: it.type === 'spell' ? a.replace(/\s/g, '') === b.replace(/\s/g, '') : a === b, answer: it.k };
    }
    case 'match': { const p = Array.isArray(body.pairs) ? body.pairs.map(Number) : []; return { correct: p.length === it.k.length && it.k.every((v, i) => p[i] === v), answer: it.k }; }
    case 'speak': return body.skip ? { skip: true, correct: null } : { correct: true };
    default: { const c = +body.choice; return { correct: c === it.k, answer: it.k }; }
  }
}

module.exports = { TYPES, TYPE_NAMES, normQ, validQ, prep, check, normText, graphemes, tokens, shuffle };
