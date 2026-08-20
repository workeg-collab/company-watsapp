# Power of Media - WhatsApp Business API Multi-Tenant SaaS Platform 🚀

نظام SaaS مركزي متكامل وسحابي لإدارة حسابات **WhatsApp Business Cloud API** لشركات وعملاء وكالة **Power of Media** من خلال خادم مركزي واحد ولوحة تحكم تفاعلية متقدمة، متوافق 100% مع **Node.js Express** و **Vercel Serverless Functions** وقاعدة بيانات **Supabase (PostgreSQL)**.

---

## 🌟 المميزات المعمارية الرئيسية (Core Architecture)

1. **إدارة الشركات والعملاء المركزية (Multi-Tenancy Hub):**
   - إضافة أي عميل جديد عبر إدخال: اسم الشركة، `Phone Number ID`، و `Permanent Access Token`.
   - عزل تام لبيانات وقواعد وسجلات كل شركة في قاعدة البيانات.

2. **التوجيه الديناميكي للرسائل (Dynamic Webhook Routing):**
   - استقبال جميع إشعارات الـ Webhook من Meta على رابط موحد (`/api/webhook`).
   - التعرف التلقائي على الشركة المستهدفة فورياً بناءً على `PHONE_NUMBER_ID` وعزل المعالجة.

3. **منشئ الردود التلقائية والكلمات المفتاحية (Dynamic Auto-Reply & Keyword Engine):**
   - مطابقة ذكية للكلمات المفتاحية: (تطابق تام `exact`، يحتوي `contains`، يبدأ بـ `startsWith`، تعبيرات نمطية `regex`).
   - دعم الردود التفاعلية: أزرار سريعة (Interactive Buttons حتى 3 أزرار)، وقوائم تفاعلية (Interactive Lists)، وردود وسائط ورسائل نصية.
   - دعم رسائل الترحيب التلقائية (`Welcome Reply`) والردود الاحتياطية (`Fallback Message`) لكل شركة على حدة.

4. **التحقق الآلي من الـ Tokens وصلاحيات Meta (Automated Credential Validator):**
   - اختبار فوري لصلاحية الـ Access Token و Phone Number ID مع Meta Graph API (`v21.0`) بنقرة واحدة داخل لوحة التحكم.

5. **محاكي واتساب تفاعلي مدمج (Interactive WhatsApp Simulator):**
   - واجهة هاتف ذكي تفاعلية داخل لوحة التحكم لاختبار ردود وقواعد أي شركة وتجربة الأزرار في الوقت الفعلي مع لوحة تشخيص لمعرفة القاعدة المطابقة.

6. **سجل تدقيق كامل للرسائل (Audit Trail & Logging):**
   - تسجيل كامل لجميع الرسائل الواردة والصادرة وحالات التسليم وإمكانية فحص بيانات الـ JSON الخام.

---

## 🏗️ هيكلية المشروع (Project Structure)

```text
company-watsapp/
├── api/
│   └── index.js              # Vercel Serverless Function Handler
├── config/
│   ├── env.js                # Environment Variables Configuration
│   └── supabase.js           # Supabase DB Client & Local Fallback Store
├── controllers/
│   ├── webhookController.js  # Dynamic Webhook Router & Isolation
│   ├── tenantController.js   # Onboarding & Meta Credentials Validator
│   ├── ruleController.js     # Auto-Reply Rules Engine Controller
│   ├── logController.js      # Message Logs & Analytics
│   └── simulatorController.js# Test Simulator Controller
├── services/
│   ├── metaService.js        # Meta WhatsApp Cloud API Client
│   ├── ruleEngine.js         # Keyword Matching & Reply Formatter
│   └── tenantService.js      # Tenant Data Access Layer (Supabase / In-Memory)
├── routes/
│   ├── webhookRoutes.js      # /api/webhook & /webhook
│   └── apiRoutes.js          # /api/tenants, /api/rules, /api/logs, /api/simulate
├── public/
│   ├── index.html            # Power of Media Central Executive Dashboard UI
│   ├── css/
│   │   └── style.css         # Modern Dark Glassmorphism Styling
│   └── js/
│       └── app.js            # Frontend Reactive State & API Bridge
├── database/
│   └── schema.sql            # Supabase PostgreSQL SQL Migration Script
├── scripts/
│   └── test-webhook.js       # Automated End-to-End Test Suite
├── server.js                 # Standalone Express Server
├── vercel.json               # Vercel Deployment Configuration
├── .env.example              # Environment Variables Template
└── package.json              # Project Dependencies
```

---

## 🚀 التشغيل المحلي (Local Quickstart)

### 1. تثبيت الحزم:
```bash
cd /Users/POM/Developer/personel/company-watsapp
npm install
```

### 2. تشغيل السيرفر:
```bash
npm start
# أو للتطوير مع إعادة التحميل التلقائي:
npm run dev
```

افتح المتصفح على: `http://localhost:3000`

---

## ☁️ خطوات النشر على GitHub و Vercel

المشروع معد للنشر على حساب: **`ana.lolo.6000@gmail.com`**

### الخطوة 1: الرفع على مستودع GitHub
```bash
git add .
git commit -m "feat: complete multi-tenant whatsapp saas for Power of Media"

# إنشاء مستودع جديد على GitHub تحت حسابك ثم ربطه:
git remote add origin https://github.com/USERNAME/company-watsapp.git
git branch -M main
git push -u origin main
```

### الخطوة 2: النشر على Vercel
1. قم بالدخول إلى [Vercel Dashboard](https://vercel.com) بحساب `ana.lolo.6000@gmail.com`.
2. اضغط **Add New Project** واختر مستودع `company-watsapp` من GitHub.
3. في قسم **Environment Variables** أضف المتغيرات التالية:

| المتغير | القيمة الافتراضية / الوصف |
| :--- | :--- |
| `META_VERIFY_TOKEN` | `power_of_media_verify_token_2026` (رمز تحقق الويب هوك) |
| `META_GRAPH_API_VERSION` | `v21.0` |
| `SUPABASE_URL` | رابط مشروعك على Supabase (مثال: `https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح `service_role` السري من إعدادات Supabase API |

4. اضغط **Deploy**.

---

## 🗄️ إعداد قاعدة بيانات Supabase (PostgreSQL)

1. افتح مشروعك في [Supabase](https://supabase.com).
2. ادخل إلى قسم **SQL Editor**.
3. افتح الملف `database/schema.sql` من المشروع وانسخ محتواه بالكامل والصقه في الـ SQL Editor ثم اضغط **Run**.
4. سيتم إنشاء الجداول الثلاثة (`tenants`, `auto_reply_rules`, `message_logs`) مع سياسات الأمان `RLS` والفهارس السريعة والبيانات التجريبية.

> 💡 **ملاحظة:** التطبيق مزود بنظام Fallback ذكي يعمل محلياً بكفاءة عالية حتى لو لم يتم تفعيل Supabase بعد!

---

## 🔗 ربط تطبيق Meta WhatsApp Cloud API

1. ادخل إلى [Meta for Developers](https://developers.facebook.com/apps).
2. اختر تطبيق الـ WhatsApp الخاص بك.
3. من القائمة الجانبية اختر **WhatsApp** > **Configuration**.
4. في قسم **Webhook** اضغط على **Edit**:
   - **Callback URL:** `https://your-vercel-domain.vercel.app/api/webhook`
   - **Verify Token:** `power_of_media_verify_token_2026`
5. اضغط **Verify and Save**.
6. اضغط على **Manage Webhook fields** واضغط **Subscribe** أمام حقل `messages`.

---

## 🧪 اختبار السيرفر والـ Webhook تلقائياً

لتشغيل فحص شامل على نقاط الـ Webhook ومحرك المطابقة:
```bash
npm test
```

---

## 👥 الدعم الفني وتطوير النظام
تم تصميم وتطوير النظام لصالح وكالة **Power of Media**.
- Email: `ana.lolo.6000@gmail.com`
- License: MIT
