# LAPP

سایت آموزش زبان — https://lapp.khaledi.eu

میزبانی با GitHub Pages (شاخهٔ `main`، ریشهٔ ریپو).

## محتوا (content/)

هر زبان یک پوشه و هر درس یک پوشه؛ برای درس یا زبان جدید فقط فایل اضافه می‌شود، نه کد.

```
content/index.json                      زبان‌ها (نام، جهت، locale، کد گفتار) و ترتیب درس‌ها
content/lang/de/dict.json               دیکشنری آلمانی: نوع کلمه و شکل‌های دیگر
content/lang/de/verbs.json              صرف فعل‌های بی‌قاعده
content/lang/de/names.json              اسم‌های خاص
content/lang/<زبان>/ui.json             متن‌های رابط کاربری (+ "_pos" نوع کلمه)
content/lang/<زبان>/grammar.json        قالب نکته‌های گرامری
content/lang/<زبان>/dict.json           معنی کلمه‌ها (فارسی: {"m": معنی, "g": نکته})
content/lang/<زبان>/names.json          اسم‌ها به این زبان
content/lessons/<درس>/lesson.json       متن آلمانی، زمان‌بندی، کلمه‌ها، جمله‌های مهم، تمرین گفتار
content/lessons/<درس>/audio.mp3         فایل صوتی
content/lessons/<درس>/<زبان>.json       ترجمهٔ درس به یک زبان
```

**زبان جدید (مثلاً هلندی nl):** پوشهٔ `content/lang/nl/` با همان فایل‌ها، فایل `nl.json` در هر درس، و یک خط در `index.json`.

**درس جدید:** پوشهٔ `content/lessons/09-…/` با `lesson.json`، `audio.mp3` و ترجمه‌ها، و نام پوشه در `index.json`.

## دیکشنری

- `content/lang/de/dict.json` — دیکشنری سراسری: هر کلمه فقط یک بار.
- `words` در `lesson.json` هر درس: فقط کلیدهای دیکشنری سراسری.

بعد از اضافه کردن درس یا کلمهٔ جدید:

```
node tools/dict.js check   # تکراری‌ها و مدخل‌های ناقص را پیدا می‌کند
node tools/dict.js build   # فهرست کلمه‌های هر درس را از روی متن می‌سازد
node tools/bump.js        # قبل از هر push: نسخهٔ فایل‌ها را عوض می‌کند تا مرورگر نسخهٔ قدیمی را نشان ندهد
```

## استودیو (`_studio/`)

تولید محتوای خودمان: متن، ترجمه، صدا و انتشار. پوشه با `_` شروع می‌شود، پس GitHub Pages آن را منتشر نمی‌کند.

```
python3 _studio/studio.py new im-hotel --type talk --level A1 --title "Im Hotel" --brief "…"
python3 _studio/studio.py prompt im-hotel        # متنی که به هوش مصنوعی (Claude/ChatGPT) می‌دهی
python3 _studio/studio.py import im-hotel out.json
python3 _studio/studio.py serve                  # صفحهٔ بازبینی: http://localhost:8787
python3 _studio/studio.py voice im-hotel         # صدا + زمان‌بندی دقیق هر خط
python3 _studio/studio.py publish im-hotel       # فقط وقتی همهٔ خط‌ها تأیید شده‌اند
```

صداها: `piper:<نام>` آفلاین و رایگان (بار اول دانلود می‌شود)؛ `azure:<voice>` با `AZURE_SPEECH_KEY` و `AZURE_SPEECH_REGION`.
نیازها: `pip install sherpa-onnx av numpy`.

### پنل وب: `lapp.khaledi.eu/studio`

یک Cloudflare Worker (`_studio/worker/`) پشت Cloudflare Access؛ فقط صاحب با ایمیلش وارد می‌شود و Worker امضای Access را خودش هم بررسی می‌کند.
پیش‌نویس‌ها در همین مخزن ذخیره می‌شوند و نوشتن، صدا و انتشار با گردش‌کار `studio` در GitHub Actions اجرا می‌شود.
Worker با گردش‌کار `studio-worker` منتشر می‌شود (نیاز: `CLOUDFLARE_API_TOKEN`، `CLOUDFLARE_ACCOUNT_ID`).

## قاعدهٔ طراحی

موبایل و دسکتاپ یک طراحی و یک HTML دارند. هر قابلیتی که اضافه می‌شود در هر دو هست؛
`@media` فقط اندازه و چیدمان را عوض می‌کند، نه این‌که چه چیزی نمایش داده شود.
