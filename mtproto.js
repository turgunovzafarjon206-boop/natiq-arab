/* Katta fayllar (20 MB dan ortiq): Telegram Bot API ularni yuklab bermaydi, shuning uchun bot
   MTProto orqali (gramjs) ulanadi va faylni Telegramdan toʻgʻridan-toʻgʻri oqim (stream) qilib beradi.
   Railway Variables: TG_API_ID va TG_API_HASH — my.telegram.org → API development tools (bir martalik). */
function createBig({ apiId, apiHash, token }) {
  if (!apiId || !apiHash || !token) return null;
  const { TelegramClient, Api, sessions, Logger } = require('telegram');
  const bigInt = require('big-integer');
  let ready = null;
  function connect() {
    if (ready) return ready;
    ready = (async () => {
      const c = new TelegramClient(new sessions.StringSession(''), +apiId, String(apiHash), { connectionRetries: 5, baseLogger: new Logger('error') });
      await c.start({ botAuthToken: token }); return c;
    })().catch(e => { ready = null; throw e; });
    return ready;
  }
  const cache = new Map();
  async function media(msgId, fresh) {
    const k = String(msgId); const h = cache.get(k);
    if (!fresh && h && Date.now() - h.at < 30 * 60e3) return h.m;
    const c = await connect();
    const r = await c.invoke(new Api.messages.GetMessages({ id: [new Api.InputMessageID({ id: +msgId })] }));
    const m = ((r && r.messages) || [])[0];
    if (!m || !m.media) throw new Error('Telegram xabari topilmadi');
    cache.set(k, { m: m.media, at: Date.now() }); return m.media;
  }
  const sizeOf = md => { const d = md && (md.document || md.photo); const s = d && (d.size || (d.sizes && Math.max(...d.sizes.map(x => x.size || 0)))); return s ? Number(s) : 0; };
  /* [start, end] baytlarini oqim qilib beradi (videoni oldinga surish uchun Range qoʻllanadi) */
  async function* range(msgId, start, end) {
    const CH = 512 * 1024; const aligned = start - (start % CH);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const c = await connect(); const md = await media(msgId, attempt > 0); let pos = aligned;
        for await (const buf of c.iterDownload({ file: md, offset: bigInt(aligned), requestSize: CH })) {
          const b0 = pos; pos += buf.length; if (pos <= start) continue;
          yield buf.subarray(Math.max(0, start - b0), Math.min(buf.length, end + 1 - b0));
          if (pos > end) return;
        }
        return;
      } catch (e) { if (attempt || !/FILE_REFERENCE/.test(String(e && (e.errorMessage || e.message)))) throw e; }
    }
  }
  return { connect, media, range, sizeOf };
}
module.exports = { createBig };
