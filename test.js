/* Natiq Arab sinovlari: node test/run.js  (Telegram va Supabase taqlidi bilan) */
const http = require('http');
const { MemoryStore } = require('./store');
const G = require('./game');
const { createApi, verifyInitData, signInitData } = require('./api');
const { createArabBot, normCode } = require('./bot');
const { createServer } = require('./index');

const TOKEN = '777000:ARAB_TEST_TOKEN';
let BIG_FAKE = null;
let fails = 0; const ok = (name, cond, got) => { if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  ✗ ' + name + (got !== undefined ? '  got: ' + JSON.stringify(got) : '')); } };
const Q = (q, opts, a, x = {}) => Object.assign({ q, opts, a }, x);

/* toʻgʻri / notoʻgʻri javob (mashq turiga qarab) */
function tileIdx(tiles, parts) { const used = new Set(); return parts.map(t => { const i = tiles.findIndex((x, j) => x === t && !used.has(j)); used.add(i); return i; }); }
function R(it) {
  switch (it.type) {
    case 'type': return { text: it.k[0] };
    case 'build': return { tiles: tileIdx(it.tiles, G.Q.tokens(it.k)) };
    case 'spell': return { tiles: tileIdx(it.tiles, G.Q.graphemes(it.k)) };
    case 'match': return { pairs: it.k };
    case 'speak': return { self: true };
    default: return { choice: it.k };
  }
}
function W(it) {
  switch (it.type) { case 'type': return { text: 'qqq' }; case 'build': case 'spell': return { tiles: [] }; case 'match': return { pairs: it.k.map(() => -1) }; case 'speak': return { skip: true };
    default: return { choice: (it.k + 1) % it.opts.length }; }
}

function seed() {
  const L = (id, order, letter, name) => ({ id, order, letter, name, tr: name.toLowerCase(), parts: {
    video: { video: 'https://youtu.be/dQw4w9WgXcQ', title: name + ' harfi', tests: [Q(`«${name}» qaysi?`, [letter, 'ج', 'د'], 0), Q('2+2?', ['3', '4'], 1)] },
    rules: { text: name + ' harfi haqida qoida', tests: [Q('Qoida savoli', ['A', 'B', 'C'], 2)] },
    cards: { cards: [{ ar: letter + 'َ', tr: 'a' }, { ar: letter + 'ِ', tr: 'i' }, { ar: letter + 'ُ', tr: 'u' }] },
    final: { tests: [] },
    vocab: { words: [{ ar: 'بَاب', uz: 'eshik', ru: 'дверь' }, { ar: 'بَيْت', uz: 'uy', ru: 'дом' }, { ar: 'كِتَاب', uz: 'kitob' }], tests: [] },
  } });
  return {
    ar_cfg: [{ id: 'main', fruitPrice: 5, notifyChats: '-100500', welcomeText: 'Salom {ism}!' }],
    ar_letters: [L('l1', 1, 'ا', 'Alif'), L('l2', 2, 'ب', 'Ba'), L('l3', 3, 'ت', 'Ta'), L('l4', 4, 'ث', 'Sa'), L('l5', 5, 'ج', 'Jim'), L('l6', 6, 'ح', 'Ha')],
    ar_codes: [{ id: 'A7K3P9', name: 'Aziza Karimova', phone: '+998901234567', groupId: 'g1', status: 'new' }, { id: 'B2C3D4', name: 'Ali', status: 'new' },
      { id: 'BLK111', name: 'Bloklangan', status: 'blocked' }, { id: 'TEST01', name: 'Tester', status: 'new', tester: true }],
    ar_groups: [{ id: 'g1', name: 'Kechki guruh', days: ['Du', 'Cho', 'Ju'], time: '20:00', meet: 'https://meet.google.com/abc-defg-hij' }],
    ar_products: [{ id: 'p1', name: 'Natiq kitobi', price: 10, stock: 2, active: true }, { id: 'p2', name: 'Qimmat', price: 100000, active: true }, { id: 'p3', name: 'Yashirin', price: 1, active: false }],
  };
}

/* ---------- 1. oʻyin mantiqi ---------- */
function gameTests() {
  console.log('Oʻyin mantiqi');
  const S = seed(); const L = S.ar_letters; const C = G.cfgOf(S.ar_cfg[0]); const p = G.freshProg('X');
  ok('ID normallash (kirill, boʻsh joy)', normCode(' а7к-3р9 ') === 'A7K3P9', normCode(' а7к-3р9 '));
  ok('1-harf 1-qism ochiq', G.unlocked(p, L, 'l1', 1));
  ok('1-harf 2-qism yopiq', !G.unlocked(p, L, 'l1', 2));
  ok('2-harf yopiq', !G.unlocked(p, L, 'l2', 1));
  let r = G.startLesson(p, L, 'l1', 2, C); ok('yopiq qism boshlanmaydi', !!r.error);
  r = G.startLesson(p, L, 'l1', 1, C, { rnd: () => 0.3 }); const s = r.sess;
  ok('1-qism: video + 2 test', s && s.items.length === 3 && s.items[0].t === 'video', s && s.items.map(i => i.t));
  ok('ochiq maʼlumotda javob yoʻq', G.sessPublic(s).items.every(i => i.a === undefined));
  let x = G.step(p, { sid: s.sid, i: 0 }, C); ok('video +3', x.gain === 3, x);
  x = G.step(p, { sid: s.sid, i: 1, ...R(s.items[1]) }, C); ok('toʻgʻri javob +1', x.correct && x.gain === 4, x);
  x = G.step(p, { sid: s.sid, i: 2, ...W(s.items[2]) }, C); ok('xato javob: jon −1', !x.correct && p.hearts === 4, x);
  ok('qism tugadi, dinor berildi', x.end && x.end.gain === 4 && p.dinor === 4, x.end);
  ok('bogʻda nihol ekildi', x.end.tree && x.end.tree.stage === 1 && x.end.tree.msg === 'Nihol ekildi', x.end.tree);
  ok('faol kun = 1', p.days === 1);
  ok('2-qism ochildi', G.unlocked(p, L, 'l1', 2));
  // jon tugashi
  p.hearts = 1; r = G.startLesson(p, L, 'l1', 2, C); const s2 = r.sess; const d0 = p.dinor;
  x = G.step(p, { sid: s2.sid, i: 0 }, C);    // qoida
  x = G.step(p, { sid: s2.sid, i: 1, ...W(s2.items[1]) }, C);
  ok('jon tugadi → qism toʻxtadi', x.fail && p.hearts === 0 && !p.sess, x);
  ok('dinor berilmadi', p.dinor === d0 && (p.done.l1 || 0) === 1);
  r = G.startLesson(p, L, 'l1', 2, C); ok('jonsiz dars boshlanmaydi', r.code === 'no_hearts', r);
  // takrorlash: 10 savol, 2 toʻgʻri = 1 jon
  r = G.startReview(p, L, 'heart', C); const rv = r.sess;
  ok('takrorlash 10 savol', rv && rv.items.length === 10, rv && rv.items.length);
  ok('takrorlash savollari oʻtilgan joygacha', rv.items.every(q => /^l1:/.test(q.id)), rv.items.map(q => q.id));
  for (let i = 0; i < 10; i++) x = G.step(p, { sid: rv.sid, i, ...(i < 7 ? R(rv.items[i]) : W(rv.items[i])) }, C);
  ok('7 toʻgʻri → 3 jon', x.end && x.end.hearts === 3 && p.hearts === 3, x.end);
  ok('takrorlashda xato jonni olmaydi', p.hearts === 3);
  // butun harfni tugatish → daraxt meva soladi
  const pass = (lid, part) => { const z = G.startLesson(p, L, lid, part, C); if (z.error) return z; let y; const ss = z.sess;
    for (let i = 0; i < ss.items.length; i++) y = G.step(p, { sid: ss.sid, i, ...R(ss.items[i]) }, C); return y; };
  for (let k = 2; k <= 5; k++) x = pass('l1', k);
  ok('5-qism: 3 ta meva', x.end && x.end.tree.stage === 5 && x.end.tree.fruit === 3, x.end && x.end.tree);
  ok('1 ta dars tugadi', p.lessons === 1 && p.done.l1 === 5);
  ok('2-harf ochildi', G.unlocked(p, L, 'l2', 1));
  ok('3-qism kartalari +1 dan', (() => { const z = G.startLesson(p, L, 'l1', 3, Object.assign({}, C, { replayReward: true })); return z.sess.items.length === 3 && z.sess.items.every(i => i.t === 'card'); })());
  p.sess = null;
  const rp = pass('l1', 1); ok('takroriy qism — dinorsiz', rp.end && rp.end.gain === 0 && rp.end.replay, rp.end);
  ok('4-qism avtomatik yakuniy test', G.partItems(L[0], 4, C, L).length >= 5);
  { const it = G.partItems(L[0], 5, C, L); const ty = new Set(it.slice(1).map(q => q.type));
  ok('5-qism: soʻzlar + har xil mashqlar (variant, eshitish, yozish, harf, juft)', it[0].t === 'words' && ['choice', 'listen', 'type', 'spell', 'match'].every(t => ty.has(t)), [...ty]); }
  // quriydi: keyingi 4 ta daraxt meva solsa
  for (const lid of ['l2', 'l3', 'l4']) for (let k = 1; k <= 5; k++) pass(lid, k);
  let gd = G.garden(p, C); ok('3 ta keyin hali quramagan', gd.dry === 0, gd.trees.map(t => [t.lid, t.dry]));
  for (let k = 1; k <= 5; k++) pass('l5', k);
  gd = G.garden(p, C); ok('4 ta daraxt meva solgach 1-daraxt quridi', gd.trees.find(t => t.lid === 'l1').dry && gd.dry === 1, gd.trees.map(t => [t.lid, t.dry]));
  const sold0 = p.dinor; const sl = G.sell(p, C);
  ok('quragan daraxt mevasi sotilmaydi', sl.sold === 12 && p.dinor === sold0 + 12 * 5, sl);
  ok('quragan daraxtda meva qoldi', p.trees.find(t => t.lid === 'l1').fruit === 3);
  r = G.startReview(p, L, 'water', C, { lid: 'l1' }); const wv = r.sess;
  ok('sugʻorish: 5 savol', wv && wv.items.length === 5);
  for (let i = 0; i < 5; i++) x = G.step(p, { sid: wv.sid, i, ...(i < 2 ? R(wv.items[i]) : W(wv.items[i])) }, C);
  ok('2/5 — sugʻorilmadi', x.end && !x.end.watered && G.isDry(p, p.trees[0], C), x.end);
  r = G.startReview(p, L, 'water', C, { lid: 'l1' }); for (let i = 0; i < 5; i++) x = G.step(p, { sid: r.sess.sid, i, ...R(r.sess.items[i]) }, C);
  ok('5/5 — qayta tirildi', x.end.watered && x.end.tree.revived && !G.isDry(p, p.trees[0], C), x.end);
  r = G.startReview(p, L, 'water', C, { lid: 'l2' }); for (let i = 0; i < 5; i++) x = G.step(p, { sid: r.sess.sid, i, ...R(r.sess.items[i]) }, C);
  ok('tirik daraxtni sugʻorish +1 meva', x.end.watered && x.end.tree.added === 1, x.end.tree);
  r = G.startReview(p, L, 'water', C, { lid: 'l2' }); ok('kuniga 1 marta', !!r.error, r);
  const rt = G.rating([p, { code: 'Y', name: 'Boy', dinor: 99999 }, { code: 'Z', name: 'Kam', dinor: 1 }], 'X');
  ok('reyting: dinor boʻyicha', rt.top[0].name === 'Boy' && rt.me.rank === 2 && rt.me.me, rt);
  const op = G.freshProg('Q'); G.applyOp(op, { type: 'dinor', n: 50 }, C); G.applyOp(op, { type: 'hearts', n: 2 }, C);
  ok('admin amali: dinor va jon', op.dinor === 50 && op.hearts === 2);
}


/* ---------- mashq turlari ---------- */
function quizTests() {
  console.log('Mashq turlari');
  const Q = G.Q; const rnd = () => 0.42;
  ok('normText: harakat, alif, urgʻu, apostrof', Q.normText('  أَبٌ ') === 'اب' && Q.normText('Bāb!') === 'bab' && Q.normText('ʻayn') === 'ayn' && Q.normText('Oʻzbek') === Q.normText("O'zbek"));
  ok('harflarga ajratish', Q.graphemes('بَاب').length === 3 && Q.graphemes('بَاب')[0] === 'بَ');
  const mk = (q, b) => { const n = Q.normQ(q, 'x'); const it = Q.prep(n, rnd); return { n, it, pub: G.sessPublic({ items: [it] }).items[0], r: b && Q.check(it, b) }; };
  let t = mk({ type: 'choice', q: 'S', opts: ['a', 'b', 'c'], a: 1 }); ok('choice: kalit yashirin', t.pub.k === undefined && t.pub.a === undefined && Q.check(t.it, R(t.it)).correct && !Q.check(t.it, W(t.it)).correct);
  t = mk({ type: 'truefalse', q: 'Bu ب', a: 0 }); ok('truefalse: Toʻgʻri/Notoʻgʻri', t.it.opts.join() === 'Toʻgʻri,Notoʻgʻri' && Q.check(t.it, { choice: 0 }).correct && !Q.check(t.it, { choice: 1 }).correct);
  t = mk({ type: 'type', q: 'Yozing', say: 'بَاب', ans: 'eshik; darvoza' });
  ok('type: bir nechta javob, katta-kichik harf farqsiz', Q.check(t.it, { text: ' Eshik ' }).correct && Q.check(t.it, { text: 'darvoza' }).correct && !Q.check(t.it, { text: 'uy' }).correct && t.pub.k === undefined, t.it);
  t = mk({ type: 'type', ans: ['بَاب'] }); ok('type: arabcha harakatsiz ham qabul', Q.check(t.it, { text: 'باب' }).correct && t.it.kb === 'ar');
  t = mk({ type: 'build', q: 'Tarjima', ar: 'هَذَا بَيْت', words: 'Bu uy', extra: 'kitob ota' });
  ok('build: plitkalar aralash, toʻgʻri tartib', t.it.tiles.length === 4 && Q.check(t.it, R(t.it)).correct && !Q.check(t.it, { tiles: R(t.it).tiles.slice().reverse() }).correct, t.it.tiles);
  ok('build: bir plitka ikki marta — xato', !Q.check(t.it, { tiles: [0, 0] }).correct);
  t = mk({ type: 'spell', say: 'بَاب', words: 'بَاب', extra: 'ت ج' });
  ok('spell: harflardan soʻz', t.it.tiles.length === 5 && Q.check(t.it, R(t.it)).correct && !Q.check(t.it, { tiles: [0, 1] }).correct, t.it.tiles);
  t = mk({ type: 'match', pairs: [['بَاب', 'eshik'], ['بَيْت', 'uy'], ['قَلَم', 'qalam']] });
  ok('match: juftlar', t.it.left.length === 3 && t.it.right.length === 3 && Q.check(t.it, R(t.it)).correct && !Q.check(t.it, { pairs: [0, 0, 0] }).correct && t.pub.k === undefined);
  ok('match: bir xil javob — notoʻgʻri test', !Q.validQ(Q.normQ({ type: 'match', pairs: [['a', 'x'], ['b', 'x']] })));
  t = mk({ type: 'speak', ar: 'بَاب', tr: 'bāb' }); ok('speak: aytdim / oʻtkazib yuborish', Q.check(t.it, { self: true }).correct && Q.check(t.it, { skip: true }).skip);
  // jon olmaydi: oʻtkazib yuborish
  const p = G.freshProg('Z'); const LL = [{ id: 'a', order: 1, letter: 'ا', name: 'A', parts: { video: { tests: [{ type: 'speak', ar: 'أَ' }, { type: 'choice', q: 's', opts: ['x', 'y'], a: 0 }] } } }];
  const st = G.startLesson(p, LL, 'a', 1, {}).sess; const sp = st.items.findIndex(i => i.type === 'speak');
  for (let i = 0; i < st.items.length; i++) { const x = G.step(p, Object.assign({ sid: st.sid, i }, i === sp ? { skip: true } : R(st.items[i])), {}); if (i === sp) ok('speak oʻtkazildi: jon va dinor oʻzgarmadi', x.skip && p.hearts === 5); }
  ok('qism yakunlandi (1 dinor)', p.done.a === 1 && p.dinor === 1, p);
}

/* ---------- 2. bot ---------- */
async function botTests(store) {
  console.log('Telegram bot');
  const calls = [];
  const { bot, processMsgs, notifyOrder } = createArabBot({ token: TOKEN, store, appUrl: 'https://arab.example/app',
    botOpts: { botInfo: { id: 7, is_bot: true, first_name: 'Natiq Arab', username: 'natiq_arab_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } } });
  let styleFail = false;
  bot.api.config.use(async (prev, method, payload) => {
    calls.push({ method, payload: JSON.parse(JSON.stringify(payload || {})) });
    if (styleFail && JSON.stringify(payload).includes('"style"')) throw new Error('Bad Request: unknown field style');
    return { ok: true, result: method === 'sendMessage' || method === 'sendPhoto' ? { message_id: calls.length, date: 0, chat: { id: payload.chat_id, type: 'private' } } : true };
  });
  let uid = 1;
  const user = (id, first) => ({ id, is_bot: false, first_name: first });
  const msg = (from, extra) => ({ update_id: uid++, message: Object.assign({ message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: from.id, type: 'private' }, from }, extra) });
  const txt = (from, text) => msg(from, Object.assign({ text }, text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}));
  const last = () => calls[calls.length - 1];
  const sent = m => calls.filter(c => c.method === m);
  const U1 = user(111, 'Aziza'), U2 = user(222, 'Begona'), U3 = user(333, 'Ali');

  await bot.handleUpdate(txt(U1, '/start'));
  ok('/start → telefon soʻraladi', last().payload.reply_markup.keyboard[0][0].request_contact === true, last());
  await bot.handleUpdate(txt(U1, 'A7K3P9'));
  ok('telefonsiz kod qabul qilinmaydi', last().payload.reply_markup && last().payload.reply_markup.keyboard, last());
  await bot.handleUpdate(msg(U1, { contact: { phone_number: '998901112233', first_name: 'Boshqa', user_id: 999 } }));
  ok('begona kontakt rad etiladi', /oʻzingizning/.test(last().payload.text));
  await bot.handleUpdate(msg(U1, { contact: { phone_number: '998901234567', first_name: 'Aziza', user_id: 111 } }));
  ok('telefon → ID soʻraladi', /6 xonali ID/.test(last().payload.text));
  await bot.handleUpdate(txt(U1, 'ZZZZZZ'));
  ok('notoʻgʻri ID', /topilmadi/.test(last().payload.text));
  await bot.handleUpdate(txt(U1, 'BLK111'));
  ok('bloklangan ID', /bloklangan/.test(last().payload.text));
  await bot.handleUpdate(txt(U1, 'a7k 3p9'));
  const c1 = await store.get('ar_codes', 'A7K3P9');
  ok('ID faollashdi va akkauntga biriktirildi', c1.status === 'active' && c1.tgId === 111 && c1.tgPhone === '+998901234567' && c1.phoneOk === true, c1);
  const wel = sent('sendMessage').filter(c => c.payload.reply_markup && c.payload.reply_markup.inline_keyboard).pop();
  ok('xush kelibsiz: koʻk «Arab tili» web_app tugmasi', wel && wel.payload.reply_markup.inline_keyboard[0][0].web_app.url === 'https://arab.example/app' && wel.payload.reply_markup.inline_keyboard[0][0].style === 'primary', wel);
  ok('xabarda ism', wel && /Salom Aziza Karimova/.test(wel.payload.text), wel && wel.payload.text);
  ok('menyu tugmasi: Arab tili', sent('setChatMenuButton').some(c => c.payload.menu_button.type === 'web_app' && c.payload.menu_button.text === 'Arab tili'));
  // boshqa akkaunt
  await bot.handleUpdate(txt(U2, '/start'));
  await bot.handleUpdate(msg(U2, { contact: { phone_number: '998935551122', user_id: 222 } }));
  await bot.handleUpdate(txt(U2, 'A7K3P9'));
  ok('boshqa akkauntdan foydalanib boʻlmaydi', /boshqa Telegram akkauntga/.test(last().payload.text), last().payload.text);
  const c1b = await store.get('ar_codes', 'A7K3P9');
  ok('urinish qayd etildi (admin koʻradi)', c1b.tgId === 111 && c1b.tries.length === 1 && c1b.tries[0].tgId === 222);
  // admin ruxsat beradi
  await store.patch('ar_codes', 'A7K3P9', { allowRebind: true });
  await bot.handleUpdate(txt(U2, 'A7K3P9'));
  const c1c = await store.get('ar_codes', 'A7K3P9');
  ok('ruxsatdan soʻng yangi akkauntga oʻtdi', c1c.tgId === 222 && !c1c.allowRebind && c1c.history.length === 1 && c1c.history[0].tgId === 111, c1c);
  ok('eski akkaunt uzildi', (await store.get('ar_tg', 111)).code === null);
  ok('eski akkaunt menyusi tiklandi', sent('setChatMenuButton').some(c => c.payload.chat_id === 111 && c.payload.menu_button.type === 'default'));
  // yana qaytarib beramiz (API sinovlari uchun)
  await store.patch('ar_codes', 'A7K3P9', { allowRebind: true }); await bot.handleUpdate(txt(U1, 'A7K3P9'));
  ok('qaytadan U1 ga', (await store.get('ar_codes', 'A7K3P9')).tgId === 111);
  // koʻp urinish
  await bot.handleUpdate(txt(U3, '/start')); await bot.handleUpdate(msg(U3, { contact: { phone_number: '+998977777777', user_id: 333 } }));
  for (let i = 0; i < 6; i++) await bot.handleUpdate(txt(U3, 'QQQQQ' + i));
  await bot.handleUpdate(txt(U3, 'B2C3D4'));
  ok('6 ta xato urinishdan soʻng bloklanadi', /Juda koʻp/.test(last().payload.text));
  await store.patch('ar_tg', 333, { fails: [] }); await bot.handleUpdate(txt(U3, 'TEST01'));
  ok('tester ID faollashdi', (await store.get('ar_codes', 'TEST01')).tgId === 333);
  // /start faol foydalanuvchiga — darhol tugma
  const n0 = calls.length; await bot.handleUpdate(txt(U1, '/start'));
  ok('faol foydalanuvchi /start → tugma', calls.slice(n0).some(c => c.payload.reply_markup && c.payload.reply_markup.inline_keyboard));
  // style qoʻllanmasa — oddiy tugma
  styleFail = true; const n1 = calls.length; await bot.handleUpdate(txt(U1, '/app')); styleFail = false;
  ok('eski Telegram: tugma rangsiz qayta yuboriladi', calls.slice(n1).filter(c => c.method === 'sendMessage').length >= 2);
  // rasm bilan
  await store.patch('ar_cfg', 'main', { welcomeImg: 'https://img.example/w.jpg' });
  await bot.handleUpdate(txt(U1, '/app'));
  ok('rasm + matn + tugma', sent('sendPhoto').some(c => c.payload.photo === 'https://img.example/w.jpg' && c.payload.reply_markup.inline_keyboard));
  // ommaviy xabar
  await store.put('ar_msgs', 'm1', { text: 'Bugun jonli dars!', target: 'group', groupId: 'g1', btn: true, status: 'pending' });
  await store.put('ar_msgs', 'm2', { text: 'Hammaga', target: 'all', status: 'pending', img: 'https://img.example/a.jpg' });
  await processMsgs();
  const m1 = await store.get('ar_msgs', 'm1'), m2 = await store.get('ar_msgs', 'm2');
  ok('guruhga xabar (1 kishi)', m1.status === 'done' && m1.sent === 1, m1);
  ok('hammaga xabar (2 faol)', m2.status === 'done' && m2.sent === 2, m2);

  // maskot eslatmasi: 2 kun kirmasa — 3-kuni
  {
    const path = require('path'); const fs = require('fs');
    const clock = () => new Date('2026-11-12T07:00:00Z');   // Toshkent 12:00
    const B = createArabBot({ token: TOKEN, store, appUrl: 'https://arab.example/app', clock, asset: f => { const x = path.join(__dirname, f); return fs.existsSync(x) ? x : null; },
      botOpts: { botInfo: { id: 7, is_bot: true, first_name: 'N', username: 'natiq_arab_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } } });
    const C2 = []; B.bot.api.config.use(async (prev, method, payload) => { C2.push({ method, payload }); return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, photo: [{ file_id: 'F1', width: 1, height: 1, file_unique_id: 'u' }] } }; });
    await store.patch('ar_prog', 'A7K3P9', { lastDay: '2026-11-10' });     // 1 kun oʻtdi
    let n = await B.processReminders(); ok('1 kun kirmasa — eslatma yoʻq', n === 0, n);
    await store.patch('ar_prog', 'A7K3P9', { lastDay: '2026-11-09' });     // 10 va 11 kirmadi → 12-da
    await store.patch('ar_cfg', 'main', { remindText: '{ism}, {kun} kundan beri kirmading!' });
    n = await B.processReminders();
    const ph = C2.filter(c => c.method === 'sendPhoto');
    ok('3-kuni maskot rasmi + admin matni + ilova tugmasi', n >= 1 && ph.some(c => c.payload.chat_id === 111 && /Aziza, 3 kundan beri kirmading!/.test(c.payload.caption) && c.payload.reply_markup.inline_keyboard), ph.map(c => c.payload.caption));
    n = await B.processReminders(); ok('bir marta yuboriladi (takrorlanmaydi)', !C2.slice(ph.length).some(c => c.method === 'sendPhoto' && c.payload.chat_id === 111));
    await store.patch('ar_cfg', 'main', { remindOn: false }); await store.patch('ar_tg', 111, { remindFor: null });
    n = await B.processReminders(); ok('admin oʻchirsa — yuborilmaydi', n === 0); await store.patch('ar_cfg', 'main', { remindOn: true });
    const late = createArabBot({ token: TOKEN, store, appUrl: '', clock: () => new Date('2026-11-12T18:00:00Z'), botOpts: { botInfo: { id: 7, is_bot: true, first_name: 'N', username: 'x', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } } });
    ok('kechasi (23:00) yuborilmaydi', (await late.processReminders()) === 0);
    await store.del('ar_prog', 'A7K3P9');
  }

  // admin: bot orqali media yuklash (saytda «📲 Bot» → #raqam)
  {
    await store.put('ar_media', '7', { kind: 'audio', label: 'Bā · Talaffuz · 1-karta', status: 'wait' });
    await store.put('ar_media', '8', { kind: 'video', label: 'Bā · Video dars', status: 'wait' });
    await store.patch('ar_cfg', 'main', { mediaAdmins: '555' });
    const A2 = createArabBot({ token: TOKEN, store, appUrl: 'https://arab.example/app', adminIds: ['999'], fetchImpl: async url => ({ ok: /file\/bot777000:ARAB_TEST_TOKEN\/voice\/f1\.oga$/.test(url), status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer }),
      botOpts: { botInfo: { id: 7, is_bot: true, first_name: 'N', username: 'natiq_arab_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } } });
    const C3 = []; A2.bot.api.config.use(async (prev, method, payload) => { C3.push({ method, payload: JSON.parse(JSON.stringify(payload || {})) });
      return { ok: true, result: method === 'getFile' ? { file_id: 'F', file_unique_id: 'u', file_path: 'voice/f1.oga' } : method === 'answerCallbackQuery' ? true : { message_id: 1, date: 0, chat: { id: 555, type: 'private' } } }; });
    const ADM = user(555, 'Admin'), STR = user(777, 'Begona');
    const L3 = () => C3[C3.length - 1];
    await A2.bot.handleUpdate(txt(ADM, '/start'));
    ok('admin /start → «📤 Media yuklash» tugmasi', C3.some(c => c.payload.reply_markup && c.payload.reply_markup.keyboard && c.payload.reply_markup.keyboard[0][0].text === '📤 Media yuklash'));
    await A2.bot.handleUpdate(txt(ADM, '📤 Media yuklash'));
    ok('kutilayotgan raqamlar roʻyxati', L3().payload.reply_markup.inline_keyboard.length === 2 && /#8/.test(L3().payload.reply_markup.inline_keyboard[0][0].text), L3().payload);
    await A2.bot.handleUpdate({ update_id: uid++, callback_query: { id: 'q1', from: ADM, chat_instance: 'x', data: 'ms:7', message: { message_id: 3, date: 0, chat: { id: 555, type: 'private' } } } });
    ok('raqam tanlandi → «audio yoki ovozli xabar yuboring»', /#7/.test(L3().payload.text) && /ovozli xabar/.test(L3().payload.text), L3().payload.text);
    await A2.bot.handleUpdate(msg(ADM, { video: { file_id: 'V', file_unique_id: 'v', width: 1, height: 1, duration: 1, file_size: 100 } }));
    ok('notoʻgʻri tur rad etiladi', /kerak/.test(L3().payload.text));
    await A2.bot.handleUpdate(msg(ADM, { voice: { file_id: 'F', file_unique_id: 'u', duration: 2, mime_type: 'audio/ogg', file_size: 4 } }));
    const md = await store.get('ar_media', '7');
    ok('ovozli xabar yuklandi va saqlandi', md.status === 'ready' && /\/arab\/tg\/7-\d+\.ogg$/.test(md.url) && md.src === 'voice' && store.files['arab/' + md.path], md);
    ok('admin raqamni yozsa ham tanlanadi', await (async () => { await A2.bot.handleUpdate(txt(ADM, '#8')); return /#8/.test(C3.filter(c => c.method === 'sendMessage').pop().payload.text); })());

    // katta fayl (>20 MB): MTProto bilan — Telegramda qoladi, /m/N orqali oqim
    {
      const FAKE = Buffer.from('0123456789abcdefghij'.repeat(10));
      const big = { media: async id => ({ id }), sizeOf: () => FAKE.length, async *range(id, a, b) { yield FAKE.subarray(a, b + 1); } };
      await store.put('ar_media', '9', { kind: 'video', label: 'Katta video', status: 'wait' });
      const A3 = createArabBot({ token: TOKEN, store, appUrl: 'https://arab.example/app', adminIds: ['999'], big, botOpts: A2.bot.botInfo ? { botInfo: A2.bot.botInfo } : undefined });
      const C4 = []; A3.bot.api.config.use(async (prev, method, payload) => { C4.push({ method, payload: JSON.parse(JSON.stringify(payload || {})) }); return { ok: true, result: { message_id: 1, date: 0, chat: { id: 999, type: 'private' } } }; });
      const ENV = user(999, 'Env');
      await A3.bot.handleUpdate(txt(ENV, '9'));
      ok('katta fayl: «hajmi cheklanmagan»', /hajmi cheklanmagan/.test(C4[C4.length - 1].payload.text));
      await A3.bot.handleUpdate(msg(ENV, { video: { file_id: 'BIG', file_unique_id: 'b', width: 1, height: 1, duration: 60, mime_type: 'video/mp4', file_size: 300 * 1048576 } }));
      const bm = await store.get('ar_media', '9');
      ok('300 MB video qabul qilindi (Telegramda, /m/9)', bm.status === 'ready' && bm.url === 'https://arab.example/m/9' && bm.big && bm.msgId, bm);
      await store.put('ar_media', '10', { kind: 'video', label: 'Yana', status: 'wait' });
      await A2.bot.handleUpdate(txt(ADM, '10')); await A2.bot.handleUpdate(msg(ADM, { video: { file_id: 'B2', file_unique_id: 'b2', width: 1, height: 1, duration: 60, file_size: 30 * 1048576 } }));
      ok('MTProto sozlanmagan boʻlsa — tushuntirish', /TG_API_ID/.test(C3[C3.length - 1].payload.text));
      await store.put('ar_media', '9', Object.assign(bm, { size: FAKE.length }));
      BIG_FAKE = big;
    }
    await A2.bot.handleUpdate(txt(STR, '/media')); ok('begona odamga media yoʻq', /faqat adminlar/.test(L3().payload.text));
    ok('ADMIN_IDS orqali ham admin', await (async () => { await A2.bot.handleUpdate(txt(user(999, 'Env'), '/media')); return /Qaysi raqamga/.test(L3().payload.text); })());
  }
  await notifyOrder({ productName: 'Kitob', price: 10, name: 'Aziza', code: 'A7K3P9', phone: '+998901234567' });
  ok('operatorga buyurtma xabari', sent('sendMessage').some(c => c.payload.chat_id === '-100500' && /Yangi buyurtma/.test(c.payload.text)));
}

/* ---------- 3. API (HTTP) ---------- */
async function apiTests(store) {
  console.log('Mini App API');
  const orders = [];
  const api = createApi({ store, token: TOKEN, onOrder: async o => orders.push(o) });
  const srv = createServer({ api, store, big: BIG_FAKE, appHtml: () => '<html>app</html>' }); await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const call = (name, body, initData) => new Promise((res, rej) => {
    const data = JSON.stringify(Object.assign({ initData }, body || {}));
    const rq = http.request({ port, path: '/api/' + name, method: name === 'GET' ? 'GET' : 'POST', headers: { 'content-type': 'application/json' } }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, body: JSON.parse(b || '{}') })); });
    rq.on('error', rej); rq.end(data); });
  const get = p => new Promise(res => http.get({ port, path: p }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ status: r.statusCode, body: b, type: r.headers['content-type'] })); }));
  const ID1 = signInitData({ id: 111, first_name: 'Aziza' }, TOKEN);
  const ID2 = signInitData({ id: 222, first_name: 'Begona' }, TOKEN);
  const IDT = signInitData({ id: 333, first_name: 'Ali' }, TOKEN);
  ok('initData tekshiruvi', verifyInitData(ID1, TOKEN).id === 111 && !verifyInitData(ID1, 'boshqa:token') && !verifyInitData(ID1.replace('Aziza', 'Hacker'), TOKEN));
  ok('eski initData rad etiladi', !verifyInitData(signInitData({ id: 1 }, TOKEN, Math.floor(Date.now() / 1000) - 4 * 86400), TOKEN));
  ok('/app sahifasi', (await get('/app')).type.startsWith('text/html'));
  ok('«/» ham ilovani ochadi (BotFather «Ochish»)', (await get('/')).type.startsWith('text/html'));
  ok('/health', JSON.parse((await get('/health')).body).ok === true);
  { const r1 = await new Promise(res => http.get({ port, path: '/m/9', headers: { Range: 'bytes=10-19' } }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ st: r.statusCode, b, cr: r.headers['content-range'], ct: r.headers['content-type'] })); }));
    ok('katta media oqimi: Range 206', r1.st === 206 && r1.b === 'abcdefghij' && r1.cr === 'bytes 10-19/200' && r1.ct === 'video/mp4', r1);
    const r2 = await new Promise(res => http.get({ port, path: '/m/9' }, r => { let n = 0; r.on('data', c => n += c.length); r.on('end', () => res({ st: r.statusCode, n })); }));
    ok('katta media: toʻliq 200', r2.st === 200 && r2.n === 200, r2); }

  { const m = await get('/mascot-bravo.webp'); ok('maskot rasmi beriladi', m.status === 200 && m.type === 'image/webp'); ok('notanish fayl — 404', (await get('/mascot-xxx.webp')).status === 404 && (await get('/mascot-../index.js')).status === 404); }
  let r = await call('me', {}, 'yolgon');
  ok('soxta initData → 401', r.status === 401);
  r = await call('me', {}, ID2);
  ok('kodsiz akkaunt → 403 not_linked', r.status === 403 && r.body.code === 'not_linked', r);
  r = await call('me', {}, ID1);
  ok('me: ism, guruh, yoʻl', r.status === 200 && r.body.user.name === 'Aziza Karimova' && r.body.user.group.meet.includes('meet.google') && r.body.path.length === 6, r.body.user);
  ok('me: 5 jon, 0 dinor', r.body.prog.hearts === 5 && r.body.prog.dinor === 0);
  ok('me: hozirgi qism l1/1', r.body.cur.lid === 'l1' && r.body.cur.part === 1);
  r = await call('lesson', { lid: 'l2', part: 1 }, ID1); ok('yopiq harf → 400', r.status === 400);
  r = await call('lesson', { lid: 'l1', part: 1 }, ID1); const s = r.body.sess;
  ok('dars boshlandi, javoblar yashirin', r.status === 200 && s.items.length === 3 && s.items.every(i => i.a === undefined), r.body);
  r = await call('step', { sid: s.sid, i: 0 }, ID1); ok('video +3', r.body.gain === 3, r.body);
  r = await call('step', { sid: s.sid, i: 0 }, ID1); ok('takroriy soʻrov — sinxron', r.body.code === 'sync' && r.body.i === 1, r.body);
  // toʻgʻri javobni bilmaymiz: birinchisini tanlaymiz, javobda «answer» keladi
  r = await call('step', { sid: s.sid, i: 1, choice: 0 }, ID1); const a1 = r.body;
  ok('javob tekshirildi (answer qaytdi)', typeof a1.answer === 'number' && typeof a1.correct === 'boolean', a1);
  r = await call('step', { sid: s.sid, i: 2, choice: 0 }, ID1);
  ok('qism yakuni + bogʻ', r.body.end && r.body.garden && r.body.garden.count === 1, r.body);
  r = await call('me', {}, ID1); ok('1-qism bajarildi', r.body.path[0].done === 1 && r.body.prog.dinor === r.body.prog.dinor);
  r = await call('rating', {}, ID1); ok('reyting: men bor', r.body.me && r.body.me.name === 'Aziza Karimova', r.body);
  r = await call('market', {}, ID1); ok('market: faol mahsulotlar', r.body.items.length === 2 && !r.body.items.some(x => x.id === 'p3'), r.body);
  r = await call('buy', { pid: 'p2', phone: '901234567' }, ID1); ok('dinor yetmasa — rad', r.status === 400 && r.body.code === 'poor');
  await store.put('ar_ops', 'o1', { code: 'A7K3P9', type: 'dinor', n: 25, status: 'pending', at: '2026-01-01' });
  r = await call('me', {}, ID1); const dn = r.body.prog.dinor;
  ok('admin dinor qoʻshdi (ar_ops)', dn >= 25 && (await store.get('ar_ops', 'o1')).status === 'done', dn);
  r = await call('buy', { pid: 'p1', phone: '90 123 45 67' }, ID1);
  ok('sotib olindi', r.status === 200 && r.body.dinor === dn - 10 && r.body.order.phone === '+998901234567', r.body);
  ok('operatorga xabar', orders.length === 1 && orders[0].productName === 'Natiq kitobi');
  ok('ombor −1', (await store.get('ar_products', 'p1')).stock === 1);
  const oid = r.body.order.id;
  await store.put('ar_ops', 'o2', { code: 'A7K3P9', type: 'refund', n: 10, orderId: oid, status: 'pending', at: '2026-01-02' });
  await api.applyOps('A7K3P9');
  ok('pul qaytarildi', (await store.get('ar_prog', 'A7K3P9')).dinor === dn && (await store.get('ar_orders', oid)).status === 'refunded');
  r = await call('orders', {}, ID1); ok('buyurtmalarim', r.body.items.length === 1 && r.body.items[0].status === 'refunded');
  r = await call('settings', { lang: 'ru', dark: true }, ID1); ok('til va tungi rejim saqlandi', r.body.lang === 'ru' && r.body.dark === true);
  r = await call('review', { mode: 'heart' }, ID1);
  ok('jon toʻla boʻlsa takrorlash shart emas (yoki boshlanadi)', r.status === 200 || r.body.code === 'full', r.body);
  r = await call('lesson', { lid: 'l6', part: 3 }, IDT); ok('tester: istalgan qism ochiq', r.status === 200, r.body);

  // «tg:7» havolasi darsda haqiqiy manzilga almashadi; yuklanmagan (#9) — boʻsh
  {
    const L = await store.get('ar_letters', 'l1'); L.parts.cards.cards[0].audio = 'tg:7'; L.parts.cards.cards[1].audio = 'tg:99'; await store.put('ar_letters', 'l1', L);
    await new Promise(r => setTimeout(r, 10));
    const rr = await call('lesson', { lid: 'l1', part: 3 }, IDT); const cs = rr.body.sess && rr.body.sess.items;
    ok('bot orqali yuklangan audio darsda ishlaydi', cs && /^https:\/\/example\.test\/public\/arab\/tg\/7-/.test(cs[0].audio) && cs[1].audio === '', cs && cs.map(x => x.audio));
  }
  await store.patch('ar_codes', 'A7K3P9', { status: 'blocked' });
  r = await call('me', {}, ID1); ok('bloklangan → 403', r.status === 403 && r.body.code === 'blocked');
  await store.patch('ar_codes', 'A7K3P9', { status: 'active' });
  // parallel soʻrovlar navbatda (dinor ikki marta ayrilmaydi)
  await store.patch('ar_prog', 'A7K3P9', { dinor: 15 }); await store.patch('ar_products', 'p1', { stock: 5 }); api.drop('A7K3P9');
  const both = await Promise.all([call('buy', { pid: 'p1', phone: '901234567' }, ID1), call('buy', { pid: 'p1', phone: '901234567' }, ID1)]);
  await api.flush();
  ok('bir vaqtda 2 xarid: faqat bittasi', both.filter(x => x.status === 200).length === 1 && (await store.get('ar_prog', 'A7K3P9')).dinor === 5, both.map(x => x.body));
  srv.close();
}

(async () => {
  gameTests();
  quizTests();
  const store = new MemoryStore(seed());
  await botTests(store);
  await apiTests(store);
  console.log(fails ? `\n❌ ${fails} ta sinov oʻtmadi` : '\n✅ Barcha sinovlar oʻtdi');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
