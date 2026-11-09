# LAPP

سایت آموزش زبان — https://lapp.khaledi.eu

کل سایت یک Cloudflare Worker است (`wrangler.toml`، کد در `worker/`): فایل‌های اپ به‌صورت Static Assets
و `/api/*`، `/admin` و `/studio` با کد Worker. با هر push به `main` گردش‌کار `deploy` منتشر می‌کند.
تا وقتی API در دسترس نیست (مثلاً روی GitHub Pages) اپ فقط ورود مهمان دارد و همهٔ درس‌ها باز است.
زبان پیش‌فرض رابط: انگلیسی.

## محتوا (content/)

سه زبان درس داریم: آلمانی (de)، هلندی (nl)، لهستانی (pl). زبان درسی که درس ندارد در اپ «به‌زودی» نشان داده می‌شود.
کاربر یک بار زبان درس را انتخاب می‌کند (بعداً از برچسب DE در خانه عوض می‌شود) و پیشرفت هر زبان جداست.

```
content/index.json                          زبان‌های رابط، و زبان‌های درس (courses) با فهرست درس‌هایشان
content/lang/<de|nl|pl>/dict.json           دیکشنری زبان درس: نوع کلمه و شکل‌های دیگر
content/lang/<de|nl|pl>/verbs.json          صرف فعل‌های بی‌قاعده
content/lang/<de|nl|pl>/names.json          اسم‌های خاص
content/lang/<رابط>/ui.json                 متن‌های رابط کاربری (+ "_pos" نوع کلمه)
content/lang/<رابط>/panel.json              ترجمهٔ پنل‌ها (ادمین، استودیو، مدرسه): متن انگلیسی ← ترجمه
content/lang/<رابط>/grammar.json            قالب نکته‌های گرامری
content/lang/<رابط>/dict.<de|nl|pl>.json    معنی کلمه‌های هر زبان درس (فارسی: {"m": معنی, "g": نکته})
content/lang/<رابط>/names.json              اسم‌ها به این زبان
content/lessons/<درس>/lesson.json           متن، زمان‌بندی، کلمه‌ها، جمله‌های مهم، تمرین گفتار
content/lessons/<درس>/audio.mp3             فایل صوتی
content/lessons/<درس>/<رابط>.json           ترجمهٔ درس به یک زبان رابط
```

زبان‌های رابط: en (پیش‌فرض)، fa، ru، uk.

**زبان هر کاربر:** زبان روی حساب ذخیره می‌شود (`users.lang`) و اپ، استودیو، ادمین و پرتال مدرسه همه به همان زبان نمایش داده می‌شوند. پنل‌ها انگلیسی نوشته شده‌اند و `ui/panel-i18n.js` آن‌ها را با `panel.json` ترجمه می‌کند. متن‌های تازهٔ بی‌ترجمه: `node tools/panel-strings.js --missing`.

**زبان رابط جدید:** پوشهٔ `content/lang/<کد>/` با همان فایل‌ها، فایل `<کد>.json` در هر درس، و یک خط در `languages` در `index.json`.

**درس جدید:** از استودیو (`--course de|nl|pl`)؛ انتشار، پوشه را به فهرست همان زبان در `index.json` اضافه می‌کند.

## دیکشنری

- `content/lang/de/dict.json` — دیکشنری سراسری: هر کلمه فقط یک بار.
- `words` در `lesson.json` هر درس: فقط کلیدهای دیکشنری سراسری.

بعد از اضافه کردن درس یا کلمهٔ جدید:

```
node tools/dict.js check de   # تکراری‌ها و مدخل‌های ناقص را پیدا می‌کند
node tools/dict.js build de   # فهرست کلمه‌های هر درس را از روی متن می‌سازد
node tools/bump.js        # قبل از هر push: نسخهٔ فایل‌ها را عوض می‌کند تا مرورگر نسخهٔ قدیمی را نشان ندهد
```

## استودیو (`_studio/`)

تولید محتوای خودمان: متن، ترجمه، صدا و انتشار. پوشه با `_` شروع می‌شود، پس GitHub Pages آن را منتشر نمی‌کند.

```
python3 _studio/studio.py new im-hotel --course de --type talk --level A1 --title "Im Hotel" --brief "…"
python3 _studio/studio.py prompt im-hotel        # متنی که به هوش مصنوعی (Claude/ChatGPT) می‌دهی
python3 _studio/studio.py import im-hotel out.json
python3 _studio/studio.py serve                  # صفحهٔ بازبینی: http://localhost:8787
python3 _studio/studio.py voice im-hotel         # صدا + زمان‌بندی دقیق هر خط
python3 _studio/studio.py publish im-hotel       # فقط وقتی همهٔ خط‌ها تأیید شده‌اند
```

صداها: `piper:<نام>` آفلاین و رایگان (بار اول دانلود می‌شود)؛ `azure:<voice>` با `AZURE_SPEECH_KEY` و `AZURE_SPEECH_REGION`.
نیازها: `pip install sherpa-onnx av numpy`.

### پنل وب: `lapp.khaledi.eu/studio`

برای طراح، مدیر و ادمین (با همان ورود اپ). پیش‌نویس‌ها در همین مخزن ذخیره می‌شوند و نوشتن، صدا و انتشار
با گردش‌کار `studio` در GitHub Actions اجرا می‌شود (نیاز: `STUDIO_GITHUB_TOKEN`).

## حساب‌ها، اشتراک و مدیریت (`worker/`)

- ورود و ثبت‌نام یک فرم است: ایمیل → اگر حساب هست رمز، اگر نه نام کاربری + رمز → کد تأیید ایمیل.
- مهمان: همه‌چیز فقط در مرورگر خودش؛ با ثبت‌نام یک‌بار به حساب منتقل می‌شود و از آن به بعد همگام است.
- پلن‌ها: رایگان · Plus (اشتراک Stripe، هدیهٔ ادمین، تیم، یا اتصال از ایران). درس‌های Plus را ادمین در `/admin` تعیین می‌کند.
- نقش‌ها: learner · designer (استودیو) · manager (+ کاربران و مشتریان) · admin (همه‌چیز). ایمیل‌های `ADMIN_EMAILS` بعد از تأیید ایمیل ادمین می‌شوند.
- جدول‌ها: `worker/migrations/`. رمزها PBKDF2-SHA256، نشست با کوکی HttpOnly.

اجرای محلی:

```
printf 'DEV=1\nADMIN_EMAILS=you@example.com\nAPP_URL=http://localhost:8787\n' > .dev.vars
npx wrangler d1 migrations apply lapp --local
npx wrangler dev          # http://localhost:8787 — کدهای تأیید در کنسول مرورگر/ترمینال
```

راه‌اندازی یک‌باره (GitHub → Settings → Secrets and variables → Actions):

| نام | چیست |
|---|---|
| `CLOUDFLARE_API_TOKEN`، `CLOUDFLARE_ACCOUNT_ID` | انتشار Worker و ساخت پایگاه D1 |
| `ADMIN_EMAILS` | ایمیل(های) ادمین، با کاما |
| `RESEND_API_KEY` | ارسال ایمیل (کد تأیید، بازنشانی رمز) — فرستنده در `EMAIL_FROM` |
| `STRIPE_SECRET_KEY`، `STRIPE_WEBHOOK_SECRET` | پرداخت؛ webhook: `https://lapp.khaledi.eu/api/stripe/webhook` |
| متغیر `STRIPE_PRICE_MONTHLY`، `STRIPE_PRICE_YEARLY` | شناسهٔ قیمت‌ها در Stripe (`price_…`) |
| `STUDIO_GITHUB_TOKEN` | توکن fine-grained همین مخزن برای استودیو |

دامنه: `lapp.khaledi.eu` در `wrangler.toml` دامنهٔ سفارشی Worker است؛ رکورد فعلی GitHub Pages باید برداشته شود.

## آموزشگاه‌ها (`worker/src/school.js`، `school.html`، `room.js`)

سلسله‌مراتب: سکوی LAPP (ادمین‌ها) → شاگردان خصوصی (اپ اصلی) و آموزشگاه‌ها. هر آموزشگاه درگاه خودش را دارد: `lapp.khaledi.eu/s/<آدرس>`.
- ادمین سکو در `/admin` → Schools آموزشگاه می‌سازد و مدیرش را دعوت می‌کند.
- نقش‌ها در هر آموزشگاه: مدیر (همه‌چیز)، معلم (کلاس‌های خودش)، مالی (شهریه و قسط)، شاگرد. یک حساب می‌تواند در آموزشگاه‌های مختلف نقش‌های مختلف داشته باشد.
- مدیر: کلاس‌ها، افراد (دعوت یا CSV)، برنامهٔ زمانی، تکالیف، مالی، تنظیمات (نام، رنگ، واحد پول).
- معلم: برنامهٔ هفته، محتوای کلاس (متن، لینک/ویدیو، فایل تا ۲ مگابایت، درس‌های LAPP)، تکلیف (کوییز با نمرهٔ خودکار، نوشتن، گفتار ضبط‌شده)، حضور و غیاب، کلاس زنده.
- کلاس زنده: تخته (قلم، متن، صفحه‌ها)، نمایش محتوا برای همه، سؤال سریع، دست بالا، چت؛ هر جلسه یک Durable Object. تصویر و صدای زنده هنوز نیست (سرویس رسانه لازم دارد).
- مالی: شهریه با قسط، ثبت پرداخت، یادآوری ایمیلی، خروجی CSV.
- شاگرد: کلاس زنده، تقویم، محتوا، تکلیف، پیشرفت و حضور، قسط‌ها.

## قاعدهٔ طراحی

موبایل و دسکتاپ یک طراحی و یک HTML دارند. هر قابلیتی که اضافه می‌شود در هر دو هست؛
`@media` فقط اندازه و چیدمان را عوض می‌کند، نه این‌که چه چیزی نمایش داده شود.
