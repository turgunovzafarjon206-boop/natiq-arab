# Natiq Arab — Telegram bot + Mini App

Natiq Academy oʻquvchilari arab tilini darsliksiz, oʻyin orqali oʻrganadigan ilova (Duolingo uslubida).
Bot va Mini App bitta Railway servisida ishlaydi. Maʼlumotlar saytdagi Supabase bazasida turadi,
boshqaruv esa natiq.uz → **Mini ilova** boʻlimida.

## Fayllar
| Fayl | Vazifasi |
|---|---|
| `index.js` | Server: bot + Mini App sahifasi (`/app`) + API (`/api/*`) + fon ishlari |
| `bot.js` | /start → telefon → 6 xonali ID → «Arab tili» tugmasi; ommaviy xabarlar |
| `api.js` | Mini App API (Telegram initData tekshiruvi, javoblar faqat serverda tekshiriladi) |
| `game.js` | Oʻyin qoidalari: jon, dinor, takrorlash, bogʻ, reyting |
| `store.js` | Supabase bilan ishlash |
| `app.html` | Mini App (oʻquvchi koʻradigan ilova) |
| `test.js` | Sinovlar: `npm test` |

## Railway’ga qoʻyish (yangi servis)
1. GitHub’da yangi repo: **natiq-arab** → shu papkadagi hamma fayllarni yuklang.
2. Railway → **New Project / New Service → GitHub repo → natiq-arab**.
3. **Variables** (faqat shu yerda turadi, hech kimga yubormang):
   - `BOT_TOKEN` — @BotFather bergan **yangi** botning tokeni
   - `SUPABASE_URL` — sayt ishlatayotgan Supabase manzili (natiq-bot’dagidek)
   - `SUPABASE_SERVICE_KEY` — Supabase → Settings → API → service_role / secret kalit (natiq-bot’dagidek)
4. **Settings → Networking → Generate Domain** — Mini App HTTPS manzili shundan olinadi
   (`https://…up.railway.app/app`). Kerak boʻlsa `APP_URL` bilan oʻzgartirasiz.
5. Supabase → SQL Editor → `natiq-supabase.sql` ni Run qiling (rasm/audio uchun «arab» papkasi).
6. Ixtiyoriy: @BotFather → Bot Settings → Configure Mini App → yuqoridagi `/app` manzili.

Tekshirish: `https://<domen>/health` → `{"ok":true,…}`. natiq.uz → Mini ilova → «● Bot ishlayapti».

## Qoidalar (Sozlamalar’da oʻzgartiriladi)
- Har harf = 5 qism: video (3 dinor) · qoidalar · talaffuz kartalari (har biri 1) · yakuniy test · lugʻat. Har toʻgʻri javob — 1 dinor.
- 5 ta jon. Xato — −1 jon. Jon tugasa qism toʻxtaydi, dinor berilmaydi.
- Takrorlash: 10 savol, har 2 toʻgʻri javob — 1 jon (savollar oʻtilgan joygacha, har safar aralash).
- Bogʻ: 1-qism — nihol, 2 — unib chiqadi, 3 — nihol, 4 — daraxt, 5 — 3 ta meva. Keyingi 4 ta daraxt meva solsa — eski daraxt quriydi; 5 savollik takrorlash bilan sugʻoriladi. Mevalar admin belgilagan narxda sotiladi.
- Tugatilgan qismni qayta oʻtganda dinor berilmaydi (sozlamada yoqish mumkin).
