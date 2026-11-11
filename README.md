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
| `quiz.js` | 9 xil mashq turi va javobni serverda tekshirish |
| `store.js` | Supabase bilan ishlash |
| `mtproto.js` | Katta fayllar (20 MB+) — Telegramdan oqim |
| `app.html` | Mini App (oʻquvchi koʻradigan ilova) |
| `mascot-*.webp`, `mascot-*.jpg` | Natiq boyqushi (maskot): ilova uchun webp, Telegram uchun jpg — shu papkada turishi shart |
| `test.js` | Sinovlar: `npm test` |

## Railway’ga qoʻyish (yangi servis)
1. GitHub’da yangi repo: **natiq-arab** → shu papkadagi hamma fayllarni yuklang.
2. Railway → **New Project / New Service → GitHub repo → natiq-arab**.
3. **Variables** (faqat shu yerda turadi, hech kimga yubormang):
   - `BOT_TOKEN` — @BotFather bergan **yangi** botning tokeni
   - `SUPABASE_URL` — sayt ishlatayotgan Supabase manzili (natiq-bot’dagidek)
   - `SUPABASE_SERVICE_KEY` — Supabase → Settings → API → service_role / secret kalit (natiq-bot’dagidek)
   - `TG_API_ID`, `TG_API_HASH` — ixtiyoriy: 20 MB dan katta video/audio’ni bot orqali yuklash uchun (my.telegram.org → API development tools). Katta fayl Telegramda qoladi, ilova uni server orqali oqim qilib koʻrsatadi.
   - `ADMIN_IDS` — ixtiyoriy: bot orqali media yuklaydigan adminlar Telegram ID’lari (saytdagi Sozlamalar’da ham boʻladi)
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

## Mashq turlari (saytda «Darslar → Tahrirlash → Mashq qoʻshish»)
Variant tanlash · Eshitib tanlash · Rasmni tanlash · Toʻgʻri/notoʻgʻri · Javobni yozish (lotin yoki ekrandagi arabcha klaviatura) ·
Jumla tuzish (soʻz plitkalari) · Harflardan soʻz · Juftini topish. Bitta qismda istalgancha turli mashq boʻladi.

## Animatsiyalar
Qism tugaganda — konfetti, tangalar va ovozli tabrik. Daraxt oʻsganda — harakatli sahna (nihol → daraxt → meva) ovoz bilan.
Saytda «Sozlamalar»ga oʻz videongizni (MP4) yuklasangiz, daraxt meva solganda shu video koʻrsatiladi.

## Maskot
Ilovaga kirganda boyqush chetdan yurib keladi (2+ kun kirmagan boʻlsa — uxlab yotgan joyidan uygʻonadi), javoblarda, qism tugaganda («Bravo»),
reyting va profilda chiqadi, 45 soniya tegilmasa burchakda uxlaydi. 2 kun darsga kirmagan oʻquvchiga 3-kuni bot maskot rasmi va admin yozgan xabarni yuboradi
(saytda: Mini ilova → Sozlamalar → «Maskot eslatmasi»).

## Bot orqali media yuklash
Saytda dars/mashqdagi media maydoni yonida «📲 Bot» → raqam (#12) paydo boʻladi. Admin botda «📤 Media yuklash» → #12 → video, audio,
oddiy ovozli xabar yoki rasm yuboradi (20 MB gacha) — fayl «arab» papkasiga yuklanib, oʻsha joyda ishlaydi.
