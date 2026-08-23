# أرشيف الموظفين — دليل الإعداد الكامل

نظام لأرشفة بيانات الموظفين وملفاتهم (PDF/Excel)، يخزّن كل شي داخل مجلد Google Drive مشترك بين فريقك، ويُستضاف مجاناً على GitHub Pages.

---

## الخطوة ١: تجهيز حساب Google Cloud (مرة وحدة بس)

1. روح إلى https://console.cloud.google.com
2. أنشئ مشروع جديد (New Project) — سمّه أي اسم مثل `employee-archive`
3. من القائمة الجانبية: **APIs & Services → Library**، وفعّل هذين الاثنين (ابحث عنهم وفعّل كل وحدة):
   - **Google Drive API**
   - **Google Picker API**
4. من **APIs & Services → OAuth consent screen**:
   - اختر **External**
   - عبّي اسم التطبيق والإيميل المطلوب
   - بقسم **Test users** (إذا التطبيق مو منشور للعامة) ضيف إيميلات كل أعضاء فريقك اللي بيستخدمون النظام
5. من **APIs & Services → Credentials**:
   - اضغط **Create Credentials → OAuth client ID**
   - نوع التطبيق: **Web application**
   - تحت **Authorized JavaScript origins** ضيف رابط موقعك على GitHub Pages، مثلاً:
     `https://USERNAME.github.io`
     (وأثناء التجربة محلياً ضيف كمان `http://localhost:5173`)
   - اضغط Create، وانسخ **Client ID**
   - اضغط **Create Credentials → API key**، وانسخ **API Key** (يفضّل تقيّده لاحقاً بـ Google Picker API فقط من إعدادات المفتاح)

---

## الخطوة ٢: تعبئة المفاتيح بالمشروع

افتح ملف `src/config.js` وحط فيه القيم اللي نسختها:

```js
export const CLIENT_ID = 'الصق_Client_ID_هنا';
export const API_KEY = 'الصق_API_Key_هنا';
```

---

## الخطوة ٣: التجربة المحلية

تحتاج [Node.js](https://nodejs.org) مثبت على جهازك، بعدين:

```bash
npm install
npm run dev
```

افتح الرابط اللي يطلع لك (عادةً `http://localhost:5173`) وجرّب تسجّل الدخول.

---

## الخطوة ٤: رفعه على GitHub

```bash
git init
git add .
git commit -m "أول نسخة من أرشيف الموظفين"
git branch -M main
git remote add origin https://github.com/USERNAME/employee-archive.git
git push -u origin main
```
(غيّر `USERNAME` باسم حسابك، و`employee-archive` باسم المستودع اللي تسويه)

⚠️ **مهم:** افتح `vite.config.js` وتأكد إن قيمة `base` تطابق اسم المستودع بالضبط.

---

## الخطوة ٥: النشر على GitHub Pages

أسهل طريقة باستخدام حزمة `gh-pages` (موجودة بالمشروع مسبقاً):

```bash
npm run build
npm run deploy
```

بعدها روح لإعدادات المستودع على GitHub → **Settings → Pages** وتأكد إن المصدر (Source) هو فرع `gh-pages`.

موقعك بيكون على: `https://USERNAME.github.io/employee-archive/`

---

## الخطوة ٦: أول استخدام (لكل عضو بالفريق)

1. أول شخص (أنت مثلاً) يفتح الموقع، يسجّل دخول بحساب Google
2. بيطلب منك اختيار أو إنشاء **مجلد الأرشيف** — أنشئ مجلد جديد بالاسم اللي تحب
3. روح لهذا المجلد بـ **Google Drive نفسه** (drive.google.com) وشاركه مع باقي أعضاء الفريق بصلاحية **محرر (Editor)**
4. كل عضو يفتح رابط الموقع، يسجّل دخول بحسابه هو، وعند شاشة اختيار المجلد **يختار نفس المجلد المشترك** (بيلاقيه ضمن "Shared with me")
5. من هذي اللحظة، أي تعديل يسويه أي شخص (إضافة موظف، رفع ملف...) بينعكس عند الباقي — بس لازم كل وحد يسوي تحديث للصفحة (F5) عشان يشوف آخر التعديلات، لأن التحديث مو لحظي تلقائي

---

## ملاحظات مهمة

- **حجم الملفات:** الرفع البسيط المستخدم بالكود يشتغل زين لملفات لين ٥-١٠ ميجا. لو تحتاج ترفع ملفات أكبر بشكل منتظم، تحتاج تعديل الكود لاستخدام "Resumable Upload" من Google (اطلب مني هذا التعديل إذا احتجته)
- **الخصوصية:** بياناتك تبقى بالكامل داخل Google Drive الخاص بفريقك — لا تُخزَّن بأي سيرفر خارجي
- **الصلاحيات:** الكود يستخدم صلاحية `drive.file` فقط، يعني الموقع ما يقدر يوصل لأي ملف ثاني بدرايفك غير المجلد اللي تختاره أنت بنفسك
- إذا واجهت خطأ "Access blocked" عند تسجيل الدخول، تأكد إنك ضفت إيميلك كـ Test User بخطوة OAuth consent screen (الخطوة ١-٤)

---

## هيكل المشروع

```
employee-archive/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx       ← نقطة البداية
│   ├── App.jsx         ← الواجهة الكاملة
│   ├── drive.js         ← دوال الاتصال بـ Google Drive
│   ├── config.js        ← مفاتيحك (Client ID / API Key)
│   └── index.css
```
