/* Tayyor rejalashtirilgan xabarlar (30 ta, bir oylik aylanma). Saytda hali sozlanmagan boʻlsa — bot ularni avtomatik joylaydi va yoqadi.
   Keyin saytdan (Mini ilova → Xabarlar → «🗓 Rejalashtirilgan xabarlar») tahrirlanadi. */
const DEF_SCHED_TIME = '19:30';
const DEF_SCHED = [
 "Assalomu alaykum! 🌙\nBilasizmi, arab tilida 28 ta harf bor va ular oʻngdan chapga yoziladi ✍️\nBugun bitta harfni oʻrganib, bogʻingizga yangi nihol eking 🌱",
 "💡 Qiziqarli fakt\nBiz har kuni ishlatadigan «kitob», «maktab», «ilm», «qalam», «vaqt» soʻzlari aslida arabcha!\nكِتَاب — kitob, قَلَم — qalam.\nDemak, siz arab tilidagi yuzlab soʻzni allaqachon bilasiz 😉 Davom etamizmi?",
 "🔥 Kunlik olovingizni oʻchirmang!\nHar kuni ilovaga kirsangiz — kalendaringizda olov yonadi. 3 kun ketma-ket kirsangiz «Boshlovchi» unvonini olasiz 🥉\nBugun atigi 5 daqiqa ajrating 👇",
 "📘 Qoida: harakatlar\nArab yozuvida unli harflar oʻrniga belgilar ishlatiladi:\nبَ — fatha («a»), بِ — kasra («i»), بُ — damma («u»).\nTalaffuz kartalarida eshitib, takrorlab koʻring 🔊",
 "🌳 Bogʻingiz sizni kutmoqda!\nYangi daraxtlar meva solgani sari eskilari qurib qolishi mumkin. Ularni sugʻorib, qayta tiriltiring — sugʻorish 5 ta savollik qisqa takrorlash, bilimingiz ham mustahkamlanadi 💧",
 "💡 Bilasizmi?\n«Algebra» va «algoritm» soʻzlari bobokalonimiz Muhammad al-Xorazmiy nomi va asari bilan bogʻliq. U asarlarini arab tilida yozgan 📜\nAjdodlarimiz tilini oʻrganish — sharaf!",
 "❤️ Jonlaringiz tugadimi?\nXavotir olmang: «Takrorlash» boʻlimida 10 ta savolga javob bering — har 2 ta toʻgʻri javob uchun 1 jon qaytadi.\nTakrorlash — oʻrganishning onasi!",
 "📘 Qoida: bogʻlanmaydigan harflar\nArab tilida 6 ta harf oʻzidan keyingi harf bilan qoʻshilmaydi:\nا د ذ ر ز و\nBuni bilsangiz, soʻzlarni oʻqish ancha osonlashadi ✨",
 "🏆 Reytingda kim birinchi?\nHar bir toʻgʻri javob — dinor, dinor koʻpaysa — reytingda yuqoriga chiqasiz.\nBugun bir pogʻona yuqoriga koʻtarilib koʻramizmi? 💪",
 "💡 Qiziqarli fakt\nArab tili — Birlashgan Millatlar Tashkilotining 6 ta rasmiy tilidan biri. Unda dunyo boʻylab 400 milliondan ortiq kishi soʻzlashadi 🌍",
 "🎁 Dinorlaringiz nimaga yetadi?\nMarketda dinorga haqiqiy sovgʻalar bor: kitoblar, aqlli soatlar va boshqalar.\nHar bir tugatilgan dars — sovgʻaga bir qadam yaqinroq 🛍",
 "📘 Qoida: sukun\nHarf ustidagi kichik doiracha — sukun. U harfni unlisiz, «toʻxtatib» oʻqitadi:\nبَبْ — «bab».\nBugungi darsda shuni sinab koʻring 🎯",
 "👥 Hamjamiyatga qoʻshiling!\nProfil → «Hamjamiyat»da boshqa oʻquvchilar bilan fikr almashing: matn, stiker, rasm yoki ovozli xabar yuboring 💬\nBugun nimani oʻrgandingiz? Yozib qoldiring!",
 "💡 Bilasizmi?\nArab yozuvida bosh harf yoʻq! Lekin bitta harf soʻzdagi oʻrniga qarab 4 xil koʻrinishda yoziladi: alohida, boshda, oʻrtada va oxirida ✍️",
 "🔥 1 hafta ketma-ket kirganlarga — «Haftalik qahramon» unvoni 🥈\nSiz necha kundan beri olovingizni yoqib kelyapsiz? Profilingizdagi kalendarni tekshiring 📅",
 "📘 Qoida: tanvin\nSoʻz oxiridagi qoʻsh harakat — tanvin. U «-n» qoʻshib oʻqiladi:\nكِتَابٌ — «kitabun».\nLugʻat boʻlimida bunday soʻzlar koʻp uchraydi 📖",
 "🎬 Reels’ni koʻrdingizmi?\nPastdagi 🎬 tugmasida Natiq boyqushi qiziqarli faktlar va qoidalarni aytib beradi.\nYoqqanini like bosib, doʻstlaringizga ulashing ❤️",
 "💡 Qiziqarli fakt\nBiz ishlatadigan 0, 1, 2, 3… raqamlari Yevropaga arablar orqali kirib kelgan, shuning uchun ular «arab raqamlari» deb ataladi 🔢",
 "🎁 Doʻstingizni taklif qiling!\nProfil → «Doʻstlarni taklif qilish»dagi havolangizni yuboring. Doʻstingiz qoʻshilsa — ikkalangizga dinor sovgʻa 🤝",
 "📘 Qoida: shadda\nHarf ustidagi «w»ga oʻxshash belgi — shadda. U harfni ikki marta oʻqitadi:\nمُعَلِّم — «muʼallim» (oʻqituvchi).\nEshitib, takrorlab koʻring 🔊",
 "💪 Kichik qadamlar — katta natija\nKuniga atigi bitta qism: video dars, qoidalar yoki 10 ta savol. Bir oyda 30 ta qadam boʻladi!\nBugungi qadamingizni tashlang 👇",
 "💡 Bilasizmi?\nArab alifbosi — dunyoda lotin yozuvidan keyin eng koʻp ishlatiladigan yozuvlardan biri. Uni oʻnlab tillar, jumladan, fors va urdu tillari ham ishlatadi 🌏",
 "🏆 Bellashuvga tayyormisiz?\nHaftalik bellashuvda belgilangan vaqtda hamma birga test yechadi. Gʻoliblarga — dinor sovrin!\nBoshlanishidan 10 daqiqa oldin bot eslatadi ⏰",
 "📘 Qoida: quyosh va oy harflari\n«ال» (al) qoʻshimchasidan keyin keladigan 14 ta «quyosh harfi»da «l» oʻqilmaydi: الشَّمْس — «ash-shams».\n14 ta «oy harfi»da esa oʻqiladi: الْقَمَر — «al-qamar» 🌞🌙",
 "📝 Profilingizga post joylang!\nBugun oʻrgangan soʻzingizni rasm yoki ovozli xabar bilan baham koʻring. Har bir like uchun dinor ham beriladi ❤️",
 "💡 Qiziqarli fakt\n18-dekabr — Xalqaro arab tili kuni. Bu sana arab tili BMT rasmiy tillaridan biri boʻlgan kunga bagʻishlangan 🎉",
 "📘 Qoida: choʻziq unlilar\nAlif (ا), vov (و) va yo (ي) harflari unlini choʻzadi:\nبَا — «baa», بُو — «buu», بِي — «bii».\nTalaffuzda farqini eshitishga harakat qiling 👂",
 "🌙 Kechqurun 5 daqiqa — eng yaxshi odat\nUxlashdan oldin bitta kartani takrorlang yoki daraxtingizni sugʻoring. Uyqudan oldin takrorlangan narsa yaxshiroq esda qoladi 🧠",
 "🌟 30 kun ketma-ket kirganlarga — «Oy yulduzi» unvoni!\nSiz bunga qancha qoldingiz? Bugun ham olovingizni yoqing 🔥",
 "🎉 Bir oy birga boʻldik!\nShu vaqt ichida qancha harf oʻrgandingiz? Bogʻingizdagi daraxtlarni sanab koʻring 🌳\nArab tilini oʻrganishda davom etamiz — oldinda yanada qiziqarli darslar! 📚"
];
module.exports = { DEF_SCHED, DEF_SCHED_TIME };
