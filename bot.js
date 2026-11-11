/* Telegram bot: /start → telefon raqam → 6 xonali ID kod → Mini App tugmasi.
   ID kod faqat birinchi kiritgan Telegram akkauntga biriktiriladi; boshqa akkauntdan
   foydalanish uchun admin «boshqa qurilmaga ruxsat» (allowRebind) berishi kerak. */
const { Bot, GrammyError, InputFile } = require('grammy');
const { execFile } = require('child_process');
const os = require('os'); const fsp = require('fs/promises'); const pth = require('path');
let FF = null; try { FF = require('ffmpeg-static'); } catch (e) { }
/* ovozli xabar (ogg/opus) iPhone’da ham eshitilishi uchun m4a (AAC) ga oʻtkaziladi */
async function toM4a(buf, ext) {
  if (!FF) return null; const dir = await fsp.mkdtemp(pth.join(os.tmpdir(), 'na-'));
  const i = pth.join(dir, 'in.' + (ext || 'ogg')), o = pth.join(dir, 'out.m4a');
  try { await fsp.writeFile(i, buf);
    await new Promise((res, rej) => execFile(FF, ['-y', '-loglevel', 'error', '-i', i, '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', o], { timeout: 180000 }, e => e ? rej(e) : res()));
    return await fsp.readFile(o); }
  catch (e) { console.error('ffmpeg', e.message.split('\n')[0]); return null; }
  finally { fsp.rm(dir, { recursive: true, force: true }).catch(() => { }); }
}
const G = require('./game');

const CYR = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', Ж: 'J' };
const normCode = s => String(s || '').toUpperCase().replace(/[А-ЯЁ]/g, ch => CYR[ch] || ch).replace(/[\s\-_.]/g, '');
const CODE_RE = /^[A-Z0-9]{6}$/;
const digits = s => String(s || '').replace(/\D/g, '');
const tgName = u => [u.first_name, u.last_name].filter(Boolean).join(' ');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function createArabBot({ token, store, appUrl, botOpts, cfg, clock = () => new Date(), asset = () => null, adminIds = [], fetchImpl, big = null }) {
  const bot = new Bot(token, botOpts);
  const getCfg = cfg || (async () => G.cfgOf(await store.get('ar_cfg', 'main')));
  const now = () => clock().toISOString();
  /* maskot rasmi: birinchi yuborishda fayl yuklanadi, keyin Telegram file_id qayta ishlatiladi */
  const fileIds = new Map();
  const mascot = name => { if (fileIds.has(name)) return fileIds.get(name); const f = asset(`mascot-${name}.jpg`); return f ? new InputFile(f) : null; };
  const remember = (name, msg) => { try { const ph = msg && msg.photo; if (ph && ph.length) fileIds.set(name, ph[ph.length - 1].file_id); } catch (e) { } };

  const appBtn = (C, styled = true) => ({ inline_keyboard: [[Object.assign({ text: '📚 ' + (C.botBtn || 'Arab tili'), web_app: { url: appUrl } }, styled ? { style: 'primary' } : {})]] });
  async function setMenu(chatId, C) {
    if (!appUrl) return;
    try { await bot.api.setChatMenuButton({ chat_id: chatId, menu_button: { type: 'web_app', text: C.botBtn || 'Arab tili', web_app: { url: appUrl } } }); } catch (e) { console.error('menu', e.message); }
  }
  async function resetMenu(chatId) { try { await bot.api.setChatMenuButton({ chat_id: chatId, menu_button: { type: 'default' } }); } catch (e) { } }

  /* xush kelibsiz xabari: rasm + matn + koʻk «Arab tili» tugmasi */
  async function welcome(ctx, c) {
    const C = await getCfg();
    const text = String(C.welcomeText || G.DEF_CFG.welcomeText).replace(/\{ism\}/g, c.name || tgName(ctx.from) || '');
    if (!appUrl) return ctx.reply(text + '\n\n⚠️ Ilova manzili (APP_URL) hali sozlanmagan.');
    const pic = C.welcomeImg || mascot('walk');
    const send = async styled => pic
      ? ctx.replyWithPhoto(pic, { caption: text.slice(0, 1024), reply_markup: appBtn(C, styled) }).then(m => { if (!C.welcomeImg) remember('walk', m); return m; })
      : ctx.reply(text, { reply_markup: appBtn(C, styled) });
    try { await send(true); }
    catch (e) {   // eski Telegram yoki rasm ochilmasa — oddiy tugma / rasmsiz
      try { await send(false); } catch (e2) { await ctx.reply(text, { reply_markup: appBtn(C, false) }); }
    }
    await setMenu(ctx.chat.id, C);
  }
  const askPhone = ctx => ctx.reply('Assalomu alaykum! 👋\n«Natiq Arab» ilovasiga kirish uchun avval telefon raqamingizni yuboring — pastdagi tugmani bosing.', {
    reply_markup: { keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
  const askCode = ctx => ctx.reply('Rahmat! ✅\nEndi sizga berilgan <b>6 xonali ID kodni</b> yozing (harf va raqamlar, masalan: <code>A7K3P9</code>).', { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });

  async function linked(id) {
    const tg = await store.get('ar_tg', id); const c = tg && tg.code ? await store.get('ar_codes', tg.code) : null;
    return { tg, c: c && String(c.tgId) === String(id) ? c : null };
  }

  /* ---------- admin: bot orqali media yuklash (saytda «📲 Bot» bosilganda raqam yaratiladi) ---------- */
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const isAdmin = async id => { const C = await getCfg(); return new Set([...String(C.mediaAdmins || '').split(/[\s,;]+/), ...adminIds].filter(Boolean).map(String)).has(String(id)); };
  const ADMIN_KB = { keyboard: [[{ text: '📤 Media yuklash' }]], resize_keyboard: true, is_persistent: true };
  const KIND_E = { video: '🎬', audio: '🔊', image: '🖼' };
  const KIND_N = { video: '🎬 video', audio: '🔊 audio yoki oddiy ovozli xabar', image: '🖼 rasm' };
  async function mediaList(ctx) {
    const M = (await store.list('ar_media', { fresh: true })).filter(m => m.status !== 'ready').sort((a, b) => (+b.id) - (+a.id)).slice(0, 30);
    if (!M.length) return ctx.reply('Yuklanishi kerak boʻlgan media yoʻq ✅\nSaytda darsga video yoki ovoz qoʻshayotganda «📲 Bot» tugmasini bosing — raqam paydo boʻladi.', { reply_markup: ADMIN_KB });
    return ctx.reply('📤 Qaysi raqamga media yuborasiz? Tugmani bosing yoki raqamni yozing:', { reply_markup: { inline_keyboard: M.map(m => [{ text: `#${m.id} ${KIND_E[m.kind] || ''} ${String(m.label || '').slice(0, 42)}`, callback_data: 'ms:' + m.id }]) } });
  }
  async function pickSlot(ctx, n) {
    const m = await store.get('ar_media', String(n)); if (!m) return ctx.reply(`#${n} raqamli media topilmadi. Roʻyxat: «📤 Media yuklash»`);
    const tg = (await store.get('ar_tg', ctx.from.id)) || { tgId: ctx.from.id };
    await store.put('ar_tg', ctx.from.id, Object.assign(tg, { mediaSlot: String(n), mediaAt: now() }));
    return ctx.reply(`📥 #${n} — «${m.label || ''}»\nEndi ${KIND_N[m.kind] || 'fayl'} yuboring${big ? ' (hajmi cheklanmagan)' : ' (20 MB gacha)'}.${m.status === 'ready' ? '\n⚠️ Bu raqamga avval yuklangan — yangisi almashtiradi.' : ''}\nBekor qilish: /cancel`);
  }
  bot.command('media', async ctx => { if (ctx.chat.type !== 'private') return; if (!(await isAdmin(ctx.from.id))) return ctx.reply(`Bu buyruq faqat adminlar uchun. Sizning ID: ${ctx.from.id}`); return mediaList(ctx); });
  bot.command('cancel', async ctx => { const tg = await store.get('ar_tg', ctx.from.id); if (tg && tg.mediaSlot) { await store.put('ar_tg', ctx.from.id, Object.assign(tg, { mediaSlot: null })); return ctx.reply('Bekor qilindi.', { reply_markup: ADMIN_KB }); } });
  bot.hears('📤 Media yuklash', async ctx => { if (ctx.chat.type !== 'private') return; if (!(await isAdmin(ctx.from.id))) return; return mediaList(ctx); });
  bot.callbackQuery(/^ms:(\d+)$/, async ctx => { try { await ctx.answerCallbackQuery(); } catch (e) { } if (!(await isAdmin(ctx.from.id))) return; return pickSlot(ctx, ctx.match[1]); });
  bot.on(['message:video', 'message:voice', 'message:audio', 'message:photo', 'message:document', 'message:video_note', 'message:animation'], async (ctx, next) => {
    if (ctx.chat.type !== 'private') return next();
    const tg = await store.get('ar_tg', ctx.from.id); if (!tg || !tg.mediaSlot || !(await isAdmin(ctx.from.id))) return next();
    const n = String(tg.mediaSlot); const slot = await store.get('ar_media', n); if (!slot) return ctx.reply(`#${n} topilmadi.`);
    const m = ctx.message; let f, kind, mime;
    if (m.video) { f = m.video; kind = 'video'; mime = f.mime_type || 'video/mp4'; }
    else if (m.video_note) { f = m.video_note; kind = 'video'; mime = 'video/mp4'; }
    else if (m.animation) { f = m.animation; kind = 'video'; mime = f.mime_type || 'video/mp4'; }
    else if (m.voice) { f = m.voice; kind = 'audio'; mime = 'audio/ogg'; }
    else if (m.audio) { f = m.audio; kind = 'audio'; mime = f.mime_type || 'audio/mpeg'; }
    else if (m.photo) { f = m.photo[m.photo.length - 1]; kind = 'image'; mime = 'image/jpeg'; }
    else if (m.document) { f = m.document; mime = f.mime_type || ''; kind = /^video/.test(mime) ? 'video' : /^audio/.test(mime) ? 'audio' : /^image/.test(mime) ? 'image' : ''; }
    if (!kind) return ctx.reply('Bu turdagi fayl qabul qilinmaydi. Video, audio, ovozli xabar yoki rasm yuboring.');
    if (slot.kind && slot.kind !== kind) return ctx.reply(`#${n} uchun ${KIND_N[slot.kind]} kerak — siz ${KIND_N[kind]} yubordingiz. Qaytadan yuboring yoki /cancel`);
    if ((f.file_size || 0) > 20 * 1048576) {   // katta fayl: Telegramda qoladi, ilovaga oqim qilib beriladi (MTProto)
      if (!big) return ctx.reply('⚠️ Bu fayl 20 MB dan katta. Katta fayllarni qabul qilish uchun Railway → Variables’ga bir marta TG_API_ID va TG_API_HASH qoʻshing (my.telegram.org → API development tools). Shundan soʻng istalgan hajmdagi video yuklanadi.');
      try {
        await ctx.reply('⏳ Katta fayl tekshirilmoqda…'); await big.media(m.message_id);
        const base = String(appUrl || '').replace(/\/app\/?$/, '');
        await store.put('ar_media', n, Object.assign(slot, { status: 'ready', url: `${base}/m/${n}`, msgId: m.message_id, mime, size: f.file_size, src: m.voice ? 'voice' : kind, big: true, by: ctx.from.id, byName: tgName(ctx.from), at: now() }));
        await store.put('ar_tg', ctx.from.id, Object.assign(tg, { mediaSlot: null }));
        await ctx.reply(`✅ #${n} yuklandi (${Math.round(f.file_size / 1048576)} MB) — «${slot.label || ''}».\nFayl Telegramda saqlanadi va ilovada toʻgʻridan-toʻgʻri koʻrsatiladi.`, { reply_markup: ADMIN_KB });
        const left = (await store.list('ar_media', { fresh: true })).filter(x => x.status !== 'ready').length; if (left) return mediaList(ctx);
        return;
      } catch (e) { console.error('katta media', e.message); return ctx.reply('❌ Katta faylni olib boʻlmadi: ' + e.message); }
    }
    await ctx.reply('⏳ Yuklanmoqda…');
    try {
      const file = await bot.api.getFile(f.file_id);
      const r = await doFetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`); if (!r.ok) throw new Error('Telegram fayli olinmadi (HTTP ' + r.status + ')');
      const buf = Buffer.from(await r.arrayBuffer());
      let ext = (String(file.file_path || '').split('.').pop() || '').toLowerCase(); if (!/^[a-z0-9]{2,5}$/.test(ext)) ext = { video: 'mp4', audio: 'ogg', image: 'jpg' }[kind]; if (ext === 'oga') ext = 'ogg';
      let data = buf;
      if (kind === 'audio' && (/^(ogg|oga|opus|webm|wav|amr)$/.test(ext) || /ogg|opus|webm/.test(mime))) { const c = await toM4a(buf, ext); if (c && c.length) { data = c; ext = 'm4a'; mime = 'audio/mp4'; } }
      const path = `tg/${n}-${Date.now()}.${ext}`; await store.upload('arab', path, data, mime);
      const url = store.publicUrl ? store.publicUrl('arab', path) : '';
      await store.put('ar_media', n, Object.assign(slot, { status: 'ready', url, path, mime, size: data.length, src: m.voice ? 'voice' : kind, by: ctx.from.id, byName: tgName(ctx.from), at: now() }));
      await store.put('ar_tg', ctx.from.id, Object.assign(tg, { mediaSlot: null }));
      await ctx.reply(`✅ #${n} yuklandi — «${slot.label || ''}».\nIlovada 15 soniya ichida paydo boʻladi.`, { reply_markup: ADMIN_KB });
      const left = (await store.list('ar_media', { fresh: true })).filter(x => x.status !== 'ready').length; if (left) return mediaList(ctx);
    } catch (e) { console.error('media', e.message); return ctx.reply('❌ Yuklab boʻlmadi: ' + e.message); }
  });

  bot.command('start', async ctx => {
    if (ctx.chat.type !== 'private') return;
    const id = ctx.from.id; const { tg, c } = await linked(id);
    if (await isAdmin(id)) await ctx.reply('🛠 Admin: darslar uchun video va ovozlarni «📤 Media yuklash» tugmasi orqali yuborasiz.', { reply_markup: ADMIN_KB });
    if (c && c.status === 'active') return welcome(ctx, c);
    if (c && c.status === 'blocked') return ctx.reply('⛔ ID kodingiz bloklangan. Administrator bilan bogʻlaning.');
    const base = Object.assign({}, tg || {}, { tgId: id, name: tgName(ctx.from), username: ctx.from.username || '', at: now() });
    base.step = base.phone ? 'code' : 'phone'; await store.put('ar_tg', id, base);
    return base.phone ? askCode(ctx) : askPhone(ctx);
  });
  bot.command(['app', 'menu'], async ctx => { if (ctx.chat.type !== 'private') return; const { c } = await linked(ctx.from.id);
    if (c && c.status === 'active') return welcome(ctx, c); return ctx.reply('Avval /start bosing va ID kodingizni kiriting.'); });
  bot.command('myid', ctx => ctx.reply(`Chat ID: <code>${ctx.chat.id}</code>\n(buyurtma xabarlari uchun saytdagi «Mini ilova → Sozlamalar»ga yozing)`, { parse_mode: 'HTML' }));
  bot.command('help', ctx => ctx.reply('«Natiq Arab» — arab tilini oʻyin orqali oʻrganish ilovasi.\n/start — boshlash\n/app — ilovani ochish tugmasi'));

  bot.on('message:contact', async ctx => {
    if (ctx.chat.type !== 'private') return;
    const ct = ctx.message.contact;
    if (ct.user_id && ct.user_id !== ctx.from.id) return ctx.reply('Iltimos, oʻzingizning raqamingizni yuboring — pastdagi tugma orqali.');
    const id = ctx.from.id; const tg = (await store.get('ar_tg', id)) || {};
    const { c } = await linked(id);
    await store.put('ar_tg', id, Object.assign(tg, { tgId: id, phone: '+' + digits(ct.phone_number), name: tgName(ctx.from), username: ctx.from.username || '', step: c && c.status === 'active' ? 'done' : 'code', at: now() }));
    if (c && c.status === 'active') return welcome(ctx, c);
    return askCode(ctx);
  });

  bot.on('message:text', async ctx => {
    if (ctx.chat.type !== 'private') return;
    const text = ctx.message.text.trim(); if (text.startsWith('/')) return;
    const id = ctx.from.id; let tg = await store.get('ar_tg', id);
    const adm = await isAdmin(id);
    if (adm && /^#?\d{1,5}$/.test(text)) return pickSlot(ctx, text.replace('#', ''));
    if (adm && !(tg && tg.phone)) tg = Object.assign(tg || {}, { tgId: id, phone: tg && tg.phone || '' });
    if (!tg || (!tg.phone && !adm)) return askPhone(ctx);
    const code = normCode(text); const cur = (await linked(id)).c;
    if (!CODE_RE.test(code)) {
      if (cur && cur.status === 'active') return welcome(ctx, cur);
      return ctx.reply('ID kod 6 ta belgidan iborat (lotin harflari va raqamlar). Qaytadan yozing:');
    }
    if (cur && cur.id === code && cur.status === 'active') return welcome(ctx, cur);
    const t = Date.now(); const fails = (tg.fails || []).filter(x => t - x < 30 * 60e3);
    if (fails.length >= 6) return ctx.reply('⏳ Juda koʻp notoʻgʻri urinish. 30 daqiqadan soʻng qayta urinib koʻring.');
    const fail = async msg => { await store.put('ar_tg', id, Object.assign(tg, { fails: [...fails, t], at: now() })); return ctx.reply(msg, { parse_mode: 'HTML' }); };

    const c = await store.get('ar_codes', code);
    if (!c) return fail('❌ Bunday ID topilmadi. Kodni tekshirib, qaytadan yozing.');
    if (c.status === 'blocked') return fail('⛔ Bu ID bloklangan. Administrator bilan bogʻlaning.');
    if (c.tgId && String(c.tgId) !== String(id) && !c.allowRebind) {
      const tries = [...(c.tries || []), { tgId: id, name: tgName(ctx.from), username: ctx.from.username || '', phone: tg.phone, at: now() }].slice(-5);
      await store.put('ar_codes', c.id, Object.assign(c, { tries }));
      return fail('🔒 Bu ID boshqa Telegram akkauntga biriktirilgan.\nBoshqa qurilma yoki akkauntdan foydalanish uchun administrator ruxsat berishi kerak.');
    }
    const prev = c.tgId && String(c.tgId) !== String(id) ? c.tgId : null;
    const hist = prev ? [...(c.history || []), { tgId: prev, name: c.tgName || '', phone: c.tgPhone || '', until: now() }].slice(-10) : (c.history || []);
    const phoneOk = c.phone ? digits(c.phone).slice(-9) === digits(tg.phone).slice(-9) : null;
    await store.put('ar_codes', c.id, Object.assign(c, { tgId: id, tgName: tgName(ctx.from), tgUsername: ctx.from.username || '', tgPhone: tg.phone, phoneOk,
      status: 'active', activatedAt: c.activatedAt || now(), lastBindAt: now(), allowRebind: false, history: hist }));
    if (prev) { const old = await store.get('ar_tg', prev); if (old && old.code === c.id) await store.put('ar_tg', prev, Object.assign(old, { code: null, step: 'code' })); await resetMenu(prev); }
    await store.put('ar_tg', id, Object.assign(tg, { code: c.id, step: 'done', fails: [], at: now() }));
    await ctx.reply('🎉 ID qabul qilindi! Hisobingiz faollashtirildi.');
    return welcome(ctx, c);
  });

  /* buyurtma haqida operatorlarga xabar */
  async function notifyOrder(o) {
    const C = await getCfg(); const chats = String(C.notifyChats || '').split(/[\s,;]+/).filter(Boolean);
    const t = `🛒 <b>Yangi buyurtma</b>\n${esc(o.productName)} — ${o.price} dinor\n👤 ${esc(o.name)} (ID ${o.code})\n📞 ${esc(o.phone)}${o.username ? '\n@' + esc(o.username) : ''}`;
    for (const ch of chats) { try { await bot.api.sendMessage(ch, t, { parse_mode: 'HTML' }); } catch (e) { console.error('notify', ch, e.message); } }
  }

  /* ommaviy xabarlar (saytdan: ar_msgs, status = pending) */
  async function processMsgs() {
    const M = (await store.list('ar_msgs', { fresh: true })).filter(m => m.status === 'pending');
    if (!M.length) return 0;
    const C = await getCfg(); const codes = (await store.list('ar_codes', { fresh: true })).filter(c => c.status === 'active' && c.tgId);
    for (const m of M) {
      await store.put('ar_msgs', m.id, Object.assign({}, m, { status: 'sending' }));
      const T = codes.filter(c => !m.target || m.target === 'all' || (m.target === 'group' && c.groupId === m.groupId) || (m.target === 'code' && c.id === normCode(m.code)));
      let sent = 0, failed = 0;
      for (const c of T) {
        const rm = m.btn && appUrl ? appBtn(C, false) : undefined;
        try {
          if (m.img) await bot.api.sendPhoto(c.tgId, m.img, { caption: String(m.text || '').slice(0, 1024), reply_markup: rm });
          else await bot.api.sendMessage(c.tgId, String(m.text || ''), { reply_markup: rm });
          sent++;
        } catch (e) { failed++; if (e instanceof GrammyError && e.parameters && e.parameters.retry_after) await sleep(e.parameters.retry_after * 1000); }
        await sleep(40);
      }
      await store.put('ar_msgs', m.id, Object.assign({}, m, { status: 'done', sent, failed, total: T.length, doneAt: now() }));
    }
    return M.length;
  }

  /* eslatma: oxirgi faol kundan keyin remindDays kun oʻtsa (2 kun kirmasa — 3-kuni) maskot bilan xabar */
  async function processReminders(force) {
    const C = await getCfg(); if (C.remindOn === false) return 0;
    const t = clock(); const h = new Date(t.getTime() + 5 * 3600e3).getUTCHours(); if (!force && (h < 10 || h >= 20)) return 0;
    const today = G.tzDate(t); const days = Math.max(1, +C.remindDays || 2); const rep = Math.max(0, +C.remindRepeat || 0);
    const codes = (await store.list('ar_codes', { fresh: true })).filter(c => c.status === 'active' && c.tgId);
    const progs = new Map((await store.list('ar_prog', { fresh: true })).map(p => [p.id, p]));
    const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    let sent = 0;
    for (const c of codes) {
      const p = progs.get(c.id) || {}; const last = p.lastDay || (c.activatedAt ? G.tzDate(new Date(c.activatedAt)) : ''); if (!last) continue;
      if (diff(last, today) <= days) continue;                       // 2 kun kirmadi → 3-kuni
      const tg = (await store.get('ar_tg', c.tgId)) || {};
      if (tg.remindFor === last && !(rep && tg.remindAt && diff(String(tg.remindAt).slice(0, 10), today) >= rep)) continue;
      const name = String(c.name || p.name || tg.name || '').split(' ')[0];
      const text = String(C.remindText || G.DEF_CFG.remindText).replace(/\{ism\}/g, name).replace(/\{kun\}/g, String(diff(last, today)));
      const mk = G.MASCOTS.includes(C.remindMascot) ? C.remindMascot : 'learn'; const pic = mascot(mk);
      const rm = appUrl ? appBtn(C, false) : undefined;
      try {
        if (pic) { const m = await bot.api.sendPhoto(c.tgId, pic, { caption: text.slice(0, 1024), reply_markup: rm }); remember(mk, m); }
        else await bot.api.sendMessage(c.tgId, text, { reply_markup: rm });
        sent++;
      } catch (e) { console.error('eslatma', c.id, e.message); }
      await store.put('ar_tg', c.tgId, Object.assign(tg, { remindFor: last, remindAt: today }));
      await sleep(60);
    }
    return sent;
  }

  bot.catch(err => console.error('bot xatosi:', err.error && err.error.message || err.message));
  return { bot, welcome, notifyOrder, processMsgs, processReminders, normCode, setMenu };
}
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

module.exports = { createArabBot, normCode, CODE_RE, toM4a };
