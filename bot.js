/* Telegram bot: /start → telefon raqam → 6 xonali ID kod → Mini App tugmasi.
   ID kod faqat birinchi kiritgan Telegram akkauntga biriktiriladi; boshqa akkauntdan
   foydalanish uchun admin «boshqa qurilmaga ruxsat» (allowRebind) berishi kerak. */
const { Bot, GrammyError } = require('grammy');
const G = require('./game');

const CYR = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', Ж: 'J' };
const normCode = s => String(s || '').toUpperCase().replace(/[А-ЯЁ]/g, ch => CYR[ch] || ch).replace(/[\s\-_.]/g, '');
const CODE_RE = /^[A-Z0-9]{6}$/;
const digits = s => String(s || '').replace(/\D/g, '');
const tgName = u => [u.first_name, u.last_name].filter(Boolean).join(' ');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function createArabBot({ token, store, appUrl, botOpts, cfg, clock = () => new Date() }) {
  const bot = new Bot(token, botOpts);
  const getCfg = cfg || (async () => G.cfgOf(await store.get('ar_cfg', 'main')));
  const now = () => clock().toISOString();

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
    const send = async styled => C.welcomeImg
      ? ctx.replyWithPhoto(C.welcomeImg, { caption: text.slice(0, 1024), reply_markup: appBtn(C, styled) })
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

  bot.command('start', async ctx => {
    if (ctx.chat.type !== 'private') return;
    const id = ctx.from.id; const { tg, c } = await linked(id);
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
    const id = ctx.from.id; const tg = await store.get('ar_tg', id);
    if (!tg || !tg.phone) return askPhone(ctx);
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

  bot.catch(err => console.error('bot xatosi:', err.error && err.error.message || err.message));
  return { bot, welcome, notifyOrder, processMsgs, normCode, setMenu };
}
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

module.exports = { createArabBot, normCode, CODE_RE };
