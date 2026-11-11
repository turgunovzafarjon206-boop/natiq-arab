/* Natiq Arab sinovlari: node test/run.js  (Telegram va Supabase taqlidi bilan) */
const http = require('http');
const { MemoryStore } = require('./store');
const G = require('./game');
const { createApi, verifyInitData, signInitData } = require('./api');
const { createArabBot, normCode } = require('./bot');
const { createServer } = require('./index');

const TOKEN = '777000:ARAB_TEST_TOKEN';
let fails = 0; const ok = (name, cond, got) => { if (cond) console.log('  ✓ ' + name); else { fails++; console.log('  ✗ ' + name + (got !== undefined ? '  got: ' + JSON.stringify(got) : '')); } };
const Q = (q, opts, a, x = {}) => Object.assign({ q, opts, a }, x);

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
  x = G.step(p, { sid: s.sid, i: 1, choice: s.items[1].a }, C); ok('toʻgʻri javob +1', x.correct && x.gain === 4, x);
  x = G.step(p, { sid: s.sid, i: 2, choice: (s.items[2].a + 1) % 2 }, C); ok('xato javob: jon −1', !x.correct && p.hearts === 4, x);
  ok('qism tugadi, dinor berildi', x.end && x.end.gain === 4 && p.dinor === 4, x.end);
  ok('bogʻda nihol ekildi', x.end.tree && x.end.tree.stage === 1 && x.end.tree.msg === 'Nihol ekildi', x.end.tree);
  ok('faol kun = 1', p.days === 1);
  ok('2-qism ochildi', G.unlocked(p, L, 'l1', 2));
  // jon tugashi
  p.hearts = 1; r = G.startLesson(p, L, 'l1', 2, C); const s2 = r.sess; const d0 = p.dinor;
  x = G.step(p, { sid: s2.sid, i: 0 }, C);    // qoida
  x = G.step(p, { sid: s2.sid, i: 1, choice: (s2.items[1].a + 1) % 3 }, C);
  ok('jon tugadi → qism toʻxtadi', x.fail && p.hearts === 0 && !p.sess, x);
  ok('dinor berilmadi', p.dinor === d0 && (p.done.l1 || 0) === 1);
  r = G.startLesson(p, L, 'l1', 2, C); ok('jonsiz dars boshlanmaydi', r.code === 'no_hearts', r);
  // takrorlash: 10 savol, 2 toʻgʻri = 1 jon
  r = G.startReview(p, L, 'heart', C); const rv = r.sess;
  ok('takrorlash 10 savol', rv && rv.items.length === 10, rv && rv.items.length);
  ok('takrorlash savollari oʻtilgan joygacha', rv.items.every(q => /^l1:/.test(q.id)), rv.items.map(q => q.id));
  for (let i = 0; i < 10; i++) x = G.step(p, { sid: rv.sid, i, choice: i < 7 ? rv.items[i].a : (rv.items[i].a + 1) % rv.items[i].opts.length }, C);
  ok('7 toʻgʻri → 3 jon', x.end && x.end.hearts === 3 && p.hearts === 3, x.end);
  ok('takrorlashda xato jonni olmaydi', p.hearts === 3);
  // butun harfni tugatish → daraxt meva soladi
  const pass = (lid, part) => { const z = G.startLesson(p, L, lid, part, C); if (z.error) return z; let y; const ss = z.sess;
    for (let i = 0; i < ss.items.length; i++) y = G.step(p, { sid: ss.sid, i, choice: ss.items[i].a }, C); return y; };
  for (let k = 2; k <= 5; k++) x = pass('l1', k);
  ok('5-qism: 3 ta meva', x.end && x.end.tree.stage === 5 && x.end.tree.fruit === 3, x.end && x.end.tree);
  ok('1 ta dars tugadi', p.lessons === 1 && p.done.l1 === 5);
  ok('2-harf ochildi', G.unlocked(p, L, 'l2', 1));
  ok('3-qism kartalari +1 dan', (() => { const z = G.startLesson(p, L, 'l1', 3, Object.assign({}, C, { replayReward: true })); return z.sess.items.length === 3 && z.sess.items.every(i => i.t === 'card'); })());
  p.sess = null;
  const rp = pass('l1', 1); ok('takroriy qism — dinorsiz', rp.end && rp.end.gain === 0 && rp.end.replay, rp.end);
  ok('4-qism avtomatik yakuniy test', G.partItems(L[0], 4, C, L).length >= 5);
  ok('5-qism lugʻat + avtomatik savollar', (() => { const it = G.partItems(L[0], 5, C, L); return it[0].t === 'words' && it.slice(1).length === 6; })());
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
  for (let i = 0; i < 5; i++) x = G.step(p, { sid: wv.sid, i, choice: i < 2 ? wv.items[i].a : (wv.items[i].a + 1) % wv.items[i].opts.length }, C);
  ok('2/5 — sugʻorilmadi', x.end && !x.end.watered && G.isDry(p, p.trees[0], C), x.end);
  r = G.startReview(p, L, 'water', C, { lid: 'l1' }); for (let i = 0; i < 5; i++) x = G.step(p, { sid: r.sess.sid, i, choice: r.sess.items[i].a }, C);
  ok('5/5 — qayta tirildi', x.end.watered && x.end.tree.revived && !G.isDry(p, p.trees[0], C), x.end);
  r = G.startReview(p, L, 'water', C, { lid: 'l2' }); for (let i = 0; i < 5; i++) x = G.step(p, { sid: r.sess.sid, i, choice: r.sess.items[i].a }, C);
  ok('tirik daraxtni sugʻorish +1 meva', x.end.watered && x.end.tree.added === 1, x.end.tree);
  r = G.startReview(p, L, 'water', C, { lid: 'l2' }); ok('kuniga 1 marta', !!r.error, r);
  const rt = G.rating([p, { code: 'Y', name: 'Boy', dinor: 99999 }, { code: 'Z', name: 'Kam', dinor: 1 }], 'X');
  ok('reyting: dinor boʻyicha', rt.top[0].name === 'Boy' && rt.me.rank === 2 && rt.me.me, rt);
  const op = G.freshProg('Q'); G.applyOp(op, { type: 'dinor', n: 50 }, C); G.applyOp(op, { type: 'hearts', n: 2 }, C);
  ok('admin amali: dinor va jon', op.dinor === 50 && op.hearts === 2);
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
  await notifyOrder({ productName: 'Kitob', price: 10, name: 'Aziza', code: 'A7K3P9', phone: '+998901234567' });
  ok('operatorga buyurtma xabari', sent('sendMessage').some(c => c.payload.chat_id === '-100500' && /Yangi buyurtma/.test(c.payload.text)));
}

/* ---------- 3. API (HTTP) ---------- */
async function apiTests(store) {
  console.log('Mini App API');
  const orders = [];
  const api = createApi({ store, token: TOKEN, onOrder: async o => orders.push(o) });
  const srv = createServer({ api, appHtml: () => '<html>app</html>' }); await new Promise(r => srv.listen(0, r));
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
  ok('/health', JSON.parse((await get('/health')).body).ok === true);
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
  await store.patch('ar_codes', 'A7K3P9', { status: 'blocked' });
  r = await call('me', {}, ID1); ok('bloklangan → 403', r.status === 403 && r.body.code === 'blocked');
  await store.patch('ar_codes', 'A7K3P9', { status: 'active' });
  // parallel soʻrovlar navbatda (dinor ikki marta ayrilmaydi)
  await store.patch('ar_prog', 'A7K3P9', { dinor: 15 }); await store.patch('ar_products', 'p1', { stock: 5 });
  const both = await Promise.all([call('buy', { pid: 'p1', phone: '901234567' }, ID1), call('buy', { pid: 'p1', phone: '901234567' }, ID1)]);
  ok('bir vaqtda 2 xarid: faqat bittasi', both.filter(x => x.status === 200).length === 1 && (await store.get('ar_prog', 'A7K3P9')).dinor === 5, both.map(x => x.body));
  srv.close();
}

(async () => {
  gameTests();
  const store = new MemoryStore(seed());
  await botTests(store);
  await apiTests(store);
  console.log(fails ? `\n❌ ${fails} ta sinov oʻtmadi` : '\n✅ Barcha sinovlar oʻtdi');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
