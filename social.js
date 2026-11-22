/* Natiq Arab — ijtimoiy qism: hamjamiyat (umumiy suhbat), profil postlari, like/izoh, reels,
   bildirishnomalar, referal havola, bellashuv, rejalashtirilgan xabarlar.
   Maʼlumotlar: ar_posts (kind: comm | post | reel), ar_centry (bellashuv natijalari), ar_contests, ar_refs, ar_cfg/sched.
   Rasm va ovozlar «arab» papkasida (soc/…) — ilovaga server orqali (/u/…) keshlab beriladi: Supabase trafigi tejaladi. */
const crypto = require('crypto');

const REACTS = ['👍', '❤️', '😂', '😮', '🔥', '🤲'];
let SEQ = Date.now();
const ytId = u => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(String(u || '')); return m ? m[1] : ''; };

function createSocial(x) {
  const { store, G, cfg, lock, loadProg, getProg, saveProg, allProgs, pidOf, byPid, clock, ApiError, convert, botUser, qWhere, letters } = x;
  const now = () => clock().toISOString();

  /* ---------- postlar keshi: bir marta yuklanadi, oʻzimiz yozganda yangilanadi; saytdan (admin) oʻzgarsa — belgi (stamp) orqali qayta yuklanadi ---------- */
  let PC = null;
  async function stampOf() { try { return typeof store.stamp === 'function' ? await store.stamp('ar_posts') : null; } catch (e) { return null; } }
  async function posts() {
    if (PC && Date.now() - PC.chk < 15000) return PC.map;
    const st = await stampOf(); if (PC && st && st === PC.stamp) { PC.chk = Date.now(); return PC.map; }
    const L = await store.list('ar_posts', { fresh: true }); PC = { map: new Map(L.map(p => [String(p.id), p])), stamp: st, chk: Date.now() }; return PC.map;
  }
  async function savePost(p) { const M = await posts(); await store.put('ar_posts', p.id, p); M.set(String(p.id), p); const st = await stampOf(); if (st) PC.stamp = st; return p; }
  async function dropPost(id) { const M = await posts(); await store.del('ar_posts', id); M.delete(String(id)); const st = await stampOf(); if (st) PC.stamp = st; }

  /* ommaviy «arab» havolasi → server orqali (/u/soc/…) */
  const base = String(store.url || '').replace(/\/+$/, '') + '/storage/v1/object/public/arab/';
  const px = u => { u = String(u || ''); if (!u) return ''; if (store.url && u.startsWith(base) && /^(soc|reel)\//.test(u.slice(base.length))) return '/u/' + u.slice(base.length); return u; };

  /* yuklangan rasm / ovoz (data:…;base64) → soc/ papkasi */
  async function saveMedia(data, kind) {
    const m = /^data:([\w/+.-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/.exec(String(data || '')); if (!m) throw new ApiError(400, 'Fayl oʻqilmadi');
    let mime = m[1].toLowerCase(), buf = Buffer.from(m[2], 'base64');
    if (kind === 'img') { if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new ApiError(400, 'Rasm JPG yoki PNG boʻlsin'); if (buf.length > 3 * 1048576) throw new ApiError(400, 'Rasm juda katta'); }
    else { if (!/^audio\//.test(mime) && !/^video\/(webm|mp4)$/.test(mime)) throw new ApiError(400, 'Ovozli xabar oʻqilmadi'); if (buf.length > 4 * 1048576) throw new ApiError(400, 'Ovozli xabar juda uzun (1 daqiqagacha)');
      if (!/mp4|m4a|aac|mpeg/.test(mime) && convert) { const ext = /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm'; const c = await convert(buf, ext); if (c && c.length) { buf = c; mime = 'audio/mp4'; } }
      if (/^video\//.test(mime)) mime = mime.replace('video', 'audio'); }
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac' }[mime] || 'bin';
    const path = `soc/${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}.${ext}`;
    await store.upload('arab', path, buf, mime); return store.publicUrl ? store.publicUrl('arab', path) : path;
  }
  const clean = (s, n) => String(s || '').replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, n);
  const today = () => G.tzDate(clock());
  const countToday = (M, code, kind) => { const d = today(); let n = 0; for (const p of M.values()) if (p.code === code && p.kind === kind && G.tzDate(new Date(p.at)) === d) n++; return n; };

  /* ---------- bildirishnomalar (ilova ichida) — bot xabari kerak boʻlsa ar_ops orqali ---------- */
  async function note(code, n) {
    if (!code) return; try { await lock(code, async () => { const p = await getProg(code); if (!p) return; p.notes = [Object.assign({ at: now() }, n), ...(p.notes || [])].slice(0, 60); p.unread = Math.min(99, (p.unread || 0) + 1); await saveProg(p, true); }); }
    catch (e) { console.error('note', code, e.message); }
  }
  async function op(code, type, n, msg, why) { if (!code) return; await store.put('ar_ops', G.uid(), { code, type, n: Math.round(+n || 0), status: 'pending', at: now(), by: 'system', byName: 'Ilova', note: why || '', msg: msg || '' }); }

  /* postni ilovaga koʻrsatish */
  const nameOf = (P, code, fb) => { const t = P.find(x => x.code === code); return (t && t.name) || fb || 'Oʻquvchi'; };
  function view(p, me, C, P) {
    const R = {}; Object.entries(p.react || {}).forEach(([e, L]) => { if ((L || []).length) R[e] = L.length; });
    const myR = Object.entries(p.react || {}).filter(([, L]) => (L || []).includes(me)).map(([e]) => e);
    const vid = p.video || ''; return { id: p.id, kind: p.kind, admin: !!p.admin, pid: p.code ? pidOf(p.code) : '', name: p.admin ? (p.name || C.appName || 'Natiq') : nameOf(P, p.code, p.name),
      text: p.text || '', img: px(p.img), audio: px(p.audio), video: ytId(vid) ? '' : px(vid), yt: ytId(vid), stk: p.stk || '', at: p.at,
      likes: (p.likes || []).length, liked: (p.likes || []).includes(me), cn: (p.comments || []).length, react: R, myReact: myR, mine: !!p.code && p.code === me };
  }

  const H = {
    /* hamjamiyat: umumiy suhbat (oxirgi 60 ta, eskisi — «before») */
    async feed({ c }, b) { const C = await cfg(); if (C.socialOn === false) throw new ApiError(403, 'Hamjamiyat vaqtincha yopiq');
      const M = await posts(); const P = await allProgs(); const before = String(b.before || '');
      const L = [...M.values()].filter(p => p.kind === 'comm' && !p.hidden && (!before || String(p.at) < before)).sort((a, z) => String(z.at).localeCompare(String(a.at)) || (+z.n || 0) - (+a.n || 0));
      return { items: L.slice(0, 60).reverse().map(p => view(p, c.id, C, P)), more: L.length > 60, reacts: REACTS, stickers: G.MASCOTS }; },
    async comm({ c, user }, b) { const C = await cfg(); if (C.socialOn === false) throw new ApiError(403, 'Hamjamiyat vaqtincha yopiq');
      const text = clean(b.text, 1000), stk = G.MASCOTS.includes(b.stk) ? b.stk : ''; if (!text && !b.img && !b.audio && !stk) throw new ApiError(400, 'Xabar boʻsh');
      const M = await posts(); if (countToday(M, c.id, 'comm') >= (C.commPerDay || 60)) throw new ApiError(429, 'Bugungi xabarlar chegarasiga yetdingiz — ertaga davom eting');
      const p = await loadProg(c, user); const x = { id: G.uid(), kind: 'comm', code: c.id, name: p.name, text, stk, at: now(), n: ++SEQ, react: {} };
      if (b.img) x.img = await saveMedia(b.img, 'img'); if (b.audio) { x.audio = await saveMedia(b.audio, 'audio'); x.dur = Math.min(600, +b.dur || 0); }
      await savePost(x); return { item: view(x, c.id, C, await allProgs()) }; },
    async react({ c }, b) { const e = REACTS.includes(b.e) ? b.e : null; if (!e) throw new ApiError(400, 'Reaksiya notoʻgʻri');
      return lock('post:' + b.id, async () => { const M = await posts(); const p = M.get(String(b.id || '')); if (!p || p.hidden) throw new ApiError(404, 'Xabar topilmadi');
        const R = p.react || {}; const had = (R[e] || []).includes(c.id);
        Object.keys(R).forEach(k => { R[k] = (R[k] || []).filter(x => x !== c.id); if (!R[k].length) delete R[k]; });   // bitta odam — bitta reaksiya
        if (!had) R[e] = [...(R[e] || []), c.id]; p.react = R; await savePost(p);
        if (!had && p.code && p.code !== c.id) { const P = await allProgs(); setImmediate(() => note(p.code, { t: 'react', pid: pidOf(c.id), name: nameOf(P, c.id), e, ref: p.id, kind: p.kind })); }
        return { item: view(p, c.id, await cfg(), await allProgs()) }; }); },
    async pdel({ c }, b) { const M = await posts(); const p = M.get(String(b.id || '')); if (!p) throw new ApiError(404, 'Topilmadi'); if (p.code !== c.id) throw new ApiError(403, 'Faqat oʻzingiznikini oʻchira olasiz');
      await dropPost(p.id); return { ok: true }; },
    /* profil postlari */
    async post({ c, user }, b) { const C = await cfg(); if (C.socialOn === false) throw new ApiError(403, 'Postlar vaqtincha yopiq');
      const text = clean(b.text, 2000); if (!text && !b.img && !b.audio) throw new ApiError(400, 'Post boʻsh — matn, rasm yoki ovoz qoʻshing');
      const M = await posts(); if (countToday(M, c.id, 'post') >= (C.postsPerDay || 10)) throw new ApiError(429, 'Bugun yetarlicha post joyladingiz — ertaga davom eting');
      const p = await loadProg(c, user); const x = { id: G.uid(), kind: 'post', code: c.id, name: p.name, text, at: now(), likes: [], comments: [], maxLikes: 0, paid: 0 };
      if (b.img) x.img = await saveMedia(b.img, 'img'); if (b.audio) { x.audio = await saveMedia(b.audio, 'audio'); x.dur = Math.min(600, +b.dur || 0); }
      await savePost(x); return { item: view(x, c.id, C, await allProgs()) }; },
    async posts({ c }, b) { const P = await allProgs(); const t = b.pid ? byPid(P, b.pid) : P.find(x => x.code === c.id) || { code: c.id };
      if (!t) throw new ApiError(404, 'Profil topilmadi'); if (t.hideRank && t.code !== c.id) throw new ApiError(403, 'Bu profil yashirilgan');
      const C = await cfg(); const M = await posts();
      const L = [...M.values()].filter(p => p.kind === 'post' && p.code === t.code && !p.hidden).sort((a, z) => String(z.at).localeCompare(String(a.at)));
      return { items: L.slice(0, 100).map(p => view(p, c.id, C, P)) }; },
    async one({ c }, b) { const M = await posts(); const p = M.get(String(b.id || '')); if (!p || p.hidden) throw new ApiError(404, 'Post topilmadi yoki oʻchirilgan');
      return { item: view(p, c.id, await cfg(), await allProgs()) }; },
    async like({ c }, b) {
      const r = await lock('post:' + b.id, async () => { const M = await posts(); const p = M.get(String(b.id || '')); if (!p || p.hidden || p.kind === 'comm') throw new ApiError(404, 'Post topilmadi');
        if (p.code === c.id) throw new ApiError(400, 'Oʻz postingizga like bosib boʻlmaydi');
        const L = new Set(p.likes || []); const on = b.on === undefined ? !L.has(c.id) : !!b.on; const was = L.has(c.id); on ? L.add(c.id) : L.delete(c.id); p.likes = [...L];
        let pay = 0; const C = await cfg();
        if (p.code && !p.admin && L.size > (p.maxLikes || 0)) { p.maxLikes = L.size; if (C.likeDinor > 0) { const due = Math.floor(p.maxLikes / C.likeEvery) * C.likeDinor; if (due > (p.paid || 0)) { pay = due - (p.paid || 0); p.paid = due; } } }
        await savePost(p); return { p, pay, fresh: on && !was };
      });
      const P = await allProgs(); const C = await cfg(); const p = r.p;
      if (r.pay) await op(p.code, 'dinor', r.pay, `❤️ Postingiz ${p.maxLikes} ta like oldi! +${r.pay} dinor 🎉`, 'Post like’lari');
      if (r.fresh && p.code) setImmediate(() => note(p.code, { t: 'like', pid: pidOf(c.id), name: nameOf(P, c.id), ref: p.id, kind: p.kind, n: r.pay || 0 }));
      return { item: view(p, c.id, C, P) };
    },
    async cmts({ c }, b) { const M = await posts(); const p = M.get(String(b.id || '')); if (!p || p.hidden) throw new ApiError(404, 'Post topilmadi'); const P = await allProgs();
      return { items: (p.comments || []).slice(-200).map(x => ({ id: x.id, pid: pidOf(x.code), name: nameOf(P, x.code, x.name), text: x.text, at: x.at, mine: x.code === c.id, canDel: x.code === c.id || p.code === c.id })) }; },
    async cmt({ c, user }, b) { const text = clean(b.text, 500); if (!text) throw new ApiError(400, 'Izoh boʻsh');
      const prog = await loadProg(c, user);
      const p = await lock('post:' + b.id, async () => { const M = await posts(); const p = M.get(String(b.id || '')); if (!p || p.hidden || p.kind === 'comm') throw new ApiError(404, 'Post topilmadi');
        p.comments = [...(p.comments || []), { id: G.uid(), code: c.id, name: prog.name, text, at: now() }].slice(-500); await savePost(p); return p; });
      if (p.code && p.code !== c.id) setImmediate(() => note(p.code, { t: 'cmt', pid: pidOf(c.id), name: prog.name, ref: p.id, kind: p.kind, text: text.slice(0, 80) }));
      return H.cmts({ c }, b); },
    async cdel({ c }, b) { await lock('post:' + b.id, async () => { const M = await posts(); const p = M.get(String(b.id || '')); if (!p) throw new ApiError(404, 'Post topilmadi');
        const x = (p.comments || []).find(k => k.id === b.cid); if (!x) return; if (x.code !== c.id && p.code !== c.id) throw new ApiError(403, 'Ruxsat yoʻq');
        p.comments = p.comments.filter(k => k.id !== b.cid); await savePost(p); }); return H.cmts({ c }, b); },
    /* reels: admin joylagan video/rasm/matn + oʻquvchilar postlari (admin belgilagan foizda) */
    async reels({ c }, b) { const C = await cfg(); const M = await posts(); const P = await allProgs(); const seen = new Set((Array.isArray(b.seen) ? b.seen : []).map(String).slice(-500));
      const all = [...M.values()].filter(p => !p.hidden);
      const adm = all.filter(p => p.kind === 'reel').sort((a, z) => (+z.prio || 0) - (+a.prio || 0) || String(z.at).localeCompare(String(a.at)));
      const age = p => (Date.now() - Date.parse(p.at || 0)) / 36e5;
      const usr = all.filter(p => p.kind === 'post' && (p.img || p.text || p.audio)).sort((a, z) => ((z.likes || []).length * 3 + (z.comments || []).length * 2 - age(z) / 12) - ((a.likes || []).length * 3 + (a.comments || []).length * 2 - age(a) / 12));
      let A = adm.filter(p => !seen.has(p.id)), U = usr.filter(p => !seen.has(p.id)); let again = false;
      if (!A.length && !U.length) { A = adm; U = usr; again = true; }   // hammasi koʻrilgan — boshidan
      const out = []; const share = C.reelsUser / 100; let ai = 0, ui = 0;
      for (let i = 0; i < 8 && (ai < A.length || ui < U.length); i++) {
        const wantU = ui < U.length && (ai >= A.length || (out.filter(x => x.kind === 'post').length + 1) / (out.length + 1) <= share + 1e-9);
        out.push(wantU ? U[ui++] : A[ai++]); }
      return { items: out.map(p => view(p, c.id, C, P)), again }; },
    /* bildirishnomalar */
    async notes({ c, user }, b) { return lock(c.id, async () => { const p = await loadProg(c, user); const L = (p.notes || []).slice(0, 60); if (b.read !== false) { p.unread = 0; await saveProg(p); }
      return { items: L }; }); },
    /* referal: shaxsiy havola va natijalar */
    async ref({ c }) { const C = await cfg(); const u = botUser ? botUser() : ''; const pid = pidOf(c.id);
      const mine = (await store.find('ar_codes', 'refBy', c.id)).map(k => ({ name: k.name || 'Doʻst', at: String(k.activatedAt || k.created || '').slice(0, 10) }));
      return { on: C.refOn !== false, link: u ? `https://t.me/${u}?start=r_${pid}` : '', bot: u, n: mine.length, items: mine.slice(-50).reverse(), dinor: C.refDinor, newDinor: C.refNewDinor }; },
    /* bellashuvlar */
    async contests({ c }) { const L = (await store.list('ar_contests', { ttl: 15000 })).filter(x => x.on !== false).sort((a, z) => String(z.at).localeCompare(String(a.at)));
      const t = clock().getTime(); const pick = L.filter(x => G.contestState(x, t) !== 'done').reverse().concat(L.filter(x => G.contestState(x, t) === 'done').slice(0, 5));
      const out = []; for (const x of pick) out.push(await cView(x, c.id)); return { items: out, now: clock().toISOString() }; },
    async cstart({ c, user }, b) { const ct = await store.get('ar_contests', String(b.id || '')); if (!ct || ct.on === false) throw new ApiError(404, 'Bellashuv topilmadi');
      const e0 = await store.get('ar_centry', ct.id + '_' + c.id); if (e0 && e0.done) throw new ApiError(400, 'Siz bu bellashuvda qatnashib boʻldingiz — natijani kuting');
      return lock(c.id, async () => { const p = await loadProg(c, user); const L = await letters();
        if (p.sess && p.sess.mode === 'contest' && p.sess.cid === ct.id) return { sess: G.sessPublic(p.sess), hearts: p.hearts, now: now() };
        if (e0) { await store.put('ar_centry', e0.id || (ct.id + '_' + c.id), Object.assign({}, e0, { done: true })); throw new ApiError(400, 'Siz bellashuvdan chiqib ketgansiz — natijangiz saqlandi'); }
        const r = G.startContest(p, L, ct, clock().getTime()); if (r.error) throw new ApiError(400, r.error);
        await store.put('ar_centry', ct.id + '_' + c.id, { cid: ct.id, code: c.id, name: p.name, ok: 0, n: r.sess.items.length, i: 0, startAt: now(), ms: 0, done: false });
        await saveProg(p); return { sess: G.sessPublic(r.sess), hearts: p.hearts, now: now() }; }); },
  };
  /* bellashuv koʻrinishi: holat, mening natijam, top-10 */
  async function cView(ct, me) {
    const st = G.contestState(ct, clock().getTime()); const E = st === 'soon' ? [] : await qWhere(store, 'ar_centry', [['cid', 'eq', ct.id]]);
    const R = rank(E); const my = R.find(e => e.code === me);
    return { id: ct.id, title: ct.title || 'Bellashuv', desc: ct.desc || '', at: ct.at, dur: +ct.dur || 15, qn: +ct.qn || 15, prizes: [+ct.p1 || 0, +ct.p2 || 0, +ct.p3 || 0], st, n: R.length,
      top: R.slice(0, 10).map(e => ({ rank: e.rank, name: e.name, ok: e.ok, n: e.n, sec: Math.round((e.ms || 0) / 1000), me: e.code === me, pid: pidOf(e.code) })),
      my: my ? { rank: my.rank, ok: my.ok, n: my.n, done: !!my.done, sec: Math.round((my.ms || 0) / 1000) } : null };
  }
  const rank = E => E.slice().sort((a, z) => (z.ok || 0) - (a.ok || 0) || (a.ms || 9e15) - (z.ms || 9e15) || String(a.startAt).localeCompare(String(z.startAt))).map((e, i) => Object.assign({ rank: i + 1 }, e));

  /* step’dan keyin: bellashuv natijasi yoziladi */
  async function contestStep(p, sess, res) {
    const id = sess.cid + '_' + p.code; const e = (await store.get('ar_centry', id)) || { cid: sess.cid, code: p.code, name: p.name, startAt: new Date(sess.at).toISOString() };
    Object.assign(e, { name: p.name, ok: sess.ok, n: sess.items.length, i: sess.i, ms: clock().getTime() - sess.at, done: !!res.end }); await store.put('ar_centry', id, e);
  }

  /* ---------- fon ishlari (har 10 soniya): bellashuv eslatmasi va yakuni, rejalashtirilgan xabarlar ---------- */
  async function tick() {
    let n = 0; const t = clock().getTime(); const C = await cfg();
    const CT = (await store.list('ar_contests', { ttl: 10000 })).filter(x => x.on !== false && x.status !== 'done');
    for (const ct of CT) {
      const a = Date.parse(ct.at || 0); if (!a) continue; const st = G.contestState(ct, t);
      if (!ct.notified && st === 'soon' && t >= a - 10 * 60e3) {   // boshlanishiga 10 daqiqa qolganda — hammaga
        await store.put('ar_contests', ct.id, Object.assign({}, ct, { notified: now() }));
        const tm = new Date(a + 5 * 3600e3).toISOString().slice(11, 16); const pr = [+ct.p1 || 0, +ct.p2 || 0, +ct.p3 || 0];
        await store.put('ar_msgs', G.uid(), { status: 'pending', target: 'all', btn: true, auto: 'contest', at: now(),
          text: `🏆 «${ct.title || 'Bellashuv'}» 10 daqiqadan soʻng boshlanadi (soat ${tm})!\n⏱ ${+ct.dur || 15} daqiqa · ${+ct.qn || 15} ta savol${pr[0] ? `\n🥇 1-oʻrin: ${pr[0]} dinor` : ''}${pr[1] ? `\n🥈 2-oʻrin: ${pr[1]} dinor` : ''}${pr[2] ? `\n🥉 3-oʻrin: ${pr[2]} dinor` : ''}\n\nIlovani oching → Profil → «Bellashuv».` });
        n++; }
      if (st === 'done') {   // yakun: gʻoliblarga dinor
        const R = rank(await qWhere(store, 'ar_centry', [['cid', 'eq', ct.id]])).filter(e => (e.ok || 0) > 0); const pr = [+ct.p1 || 0, +ct.p2 || 0, +ct.p3 || 0]; const win = [];
        for (let i = 0; i < 3 && i < R.length; i++) { win.push({ code: R[i].code, name: R[i].name, ok: R[i].ok, n: R[i].n, rank: i + 1, dinor: pr[i] });
          if (pr[i] > 0) await op(R[i].code, 'dinor', pr[i], `🏆 «${ct.title || 'Bellashuv'}»da ${i + 1}-oʻrinni egalladingiz! (${R[i].ok}/${R[i].n})\n+${pr[i]} dinor balansingizga qoʻshildi 🎉`, 'Bellashuv: ' + (i + 1) + '-oʻrin');
          setImmediate(() => note(R[i].code, { t: 'contest', name: ct.title || 'Bellashuv', rank: i + 1, n: pr[i] })); }
        await store.put('ar_contests', ct.id, Object.assign({}, ct, { status: 'done', doneAt: now(), winners: win, total: R.length })); n++; }
    }
    /* rejalashtirilgan xabarlar: har kuni belgilangan vaqtda navbatdagi bittasi (aylanib takrorlanadi) */
    const S = await store.get('ar_cfg', 'sched');
    if (S && S.on && Array.isArray(S.items) && S.items.length) {
      const tz = new Date(t + 5 * 3600e3); const d = tz.toISOString().slice(0, 10), hm = tz.toISOString().slice(11, 16);
      const items = S.items.filter(i => i && (String(i.text || '').trim() || i.img));
      if (items.length && S.lastDay !== d && hm >= String(S.time || '09:00')) {
        const k = (+S.idx || 0) % items.length; const it = items[k];
        await store.put('ar_cfg', 'sched', Object.assign({}, S, { lastDay: d, idx: k + 1, lastAt: now() }));
        await store.put('ar_msgs', G.uid(), { status: 'pending', target: S.target === 'group' ? 'group' : 'all', groupId: S.groupId || '', text: String(it.text || ''), img: it.img || '', btn: S.btn !== false, auto: 'sched', schedN: k + 1, at: now() });
        n++; }
    }
    return n;
  }
  return { H, tick, contestStep, posts, px, REACTS };
}

module.exports = { createSocial, REACTS, ytId };
