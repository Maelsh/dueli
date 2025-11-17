# 🎯 Dueli Platform - Backend API

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D6.0-green)](https://www.mongodb.com/)

**منصة Dueli** - منصة تواصل اجتماعي مفتوحة المصدر قائمة على التنافس الحضاري. تتيح المنصة للمستخدمين إنشاء منافسات حية في مجالات الحوار، العلوم، والمواهب، مع نظام تقييم فوري وتوزيع أرباح شفاف (80/20).

---

## 📋 جدول المحتويات

- [المميزات الرئيسية](#-المميزات-الرئيسية)
- [التقنيات المستخدمة](#-التقنيات-المستخدمة)
- [متطلبات التشغيل](#-متطلبات-التشغيل)
- [التثبيت والإعداد](#-التثبيت-والإعداد)
- [هيكل المشروع](#-هيكل-المشروع)
- [API Endpoints](#-api-endpoints)
- [WebSocket Events](#-websocket-events)
- [الأمان](#-الأمان)
- [الاختبار](#-الاختبار)
- [النشر](#-النشر)
- [المساهمة](#-المساهمة)
- [الترخيص](#-الترخيص)

---

## ✨ المميزات الرئيسية

### 🎯 نظام التنافس
- ✅ إنشاء منافسات في 3 أقسام (حوار، علوم، مواهب)
- ✅ قوانين مخصصة لكل منافسة
- ✅ دعوة منافسين أو قبول طلبات الانضمام
- ✅ بث مباشر عبر YouTube API
- ✅ تسجيل تلقائي للمنافسات

### ⚡ Real-Time Features
- ✅ تقييم فوري أثناء البث (WebSocket)
- ✅ تعليقات حية
- ✅ عداد مشاهدين لحظي
- ✅ تحديثات الشفافية (sub-second latency)

### 💰 النظام المالي
- ✅ توزيع أرباح 80/20 (المتنافسون/الإدارة)
- ✅ حساب تلقائي حسب التقييم
- ✅ نظام إعلانات مستقل
- ✅ حق رفض الإعلانات للمتنافسين
- ✅ تشفير البيانات البنكية (AES-256-GCM)

### 🔐 الأمان والخصوصية
- ✅ JWT Authentication
- ✅ تشفير AES-256 للبيانات الحساسة
- ✅ Rate Limiting
- ✅ Protection من XSS, CSRF, NoSQL Injection
- ✅ Helmet.js للأمان

### 🌍 التعددية والشمولية
- ✅ دعم 7 لغات
- ✅ فلترة حسب الدولة واللغة
- ✅ RTL Support

---

## 🛠️ التقنيات المستخدمة

### Backend Stack
```
Node.js 18+
Express.js 4.x
MongoDB 6.x
Mongoose 8.x
Socket.IO 4.x
JWT Authentication
```

### Security & Validation
```
Helmet.js
express-rate-limit
express-mongo-sanitize
express-validator
bcryptjs
crypto (AES-256-GCM)
```

### External Services
```
YouTube Live Streaming API
Google OAuth 2.0
NodeMailer (SMTP)
```

---

## 📦 متطلبات التشغيل

### الحد الأدنى
- **Node.js:** >= 18.0.0
- **npm:** >= 9.0.0
- **MongoDB:** >= 6.0
- **RAM:** 2GB
- **Storage:** 10GB

### الموصى به (Production)
- **Node.js:** 20.x LTS
- **MongoDB Atlas:** Cluster M10+
- **Redis:** 7.x (للـ WebSocket Scaling)
- **RAM:** 4GB+
- **CDN:** CloudFlare/AWS CloudFront

---

## 🚀 التثبيت والإعداد

### 1. Clone المشروع
```bash
git clone https://github.com/your-org/dueli-backend.git
cd dueli-backend
```

### 2. تثبيت Dependencies
```bash
npm install
```

### 3. إعداد Environment Variables
```bash
# انسخ ملف .env.example
cp .env.example .env

# قم بتعديل القيم في .env
nano .env
```

**المتغيرات الأساسية:**
```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/dueli

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Encryption (Generate with: npm run generate-key)
ENCRYPTION_KEY=your_64_char_hex_key_here

# YouTube API
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:5000/api/v1/auth/youtube/callback
```

### 4. توليد Encryption Key
```bash
npm run generate-key
```
انسخ المفتاح الناتج إلى `.env` في `ENCRYPTION_KEY`

### 5. إنشاء مجلدات اللوجات
```bash
mkdir logs
mkdir uploads
```

### 6. تشغيل MongoDB
```bash
# إذا كان محلياً
mongod

# أو استخدم MongoDB Atlas
# وقم بتحديث MONGODB_URI في .env
```

### 7. تشغيل السيرفر

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### 8. (اختياري) إنشاء مستخدم Admin
```bash
node scripts/createAdmin.js admin@dueli.com Admin@123456
```

### 9. (اختياري) Seed البيانات التجريبية
```bash
node scripts/seedDatabase.js
```

---

## 📁 هيكل المشروع

```
dueli-backend/
│
├── server.js                   # نقطة البداية الرئيسية
├── package.json
├── .env.example
│
├── config/                     # ملفات الإعدادات
│   ├── database.js            # اتصال MongoDB
│   ├── logger.js              # Winston Logger
│   ├── socket.js              # Socket.IO Setup
│   ├── encryption.js          # AES-256 Encryption
│   └── youtube.js             # YouTube API
│
├── models/                     # Mongoose Models
│   ├── index.js               # Export جميع الموديلات
│   ├── User.js
│   ├── Challenge.js
│   ├── Rating.js
│   ├── Comment.js
│   ├── Report.js
│   ├── Transaction.js
│   ├── Advertisement.js
│   ├── Message.js
│   ├── Notification.js
│   └── ChallengeInvitation.js
│
├── controllers/                # Business Logic
│   ├── auth.controller.js     # ✅ مكتمل
│   ├── user.controller.js     # ✅ مكتمل
│   ├── challenge.controller.js # ⏳ قيد الإنشاء
│   ├── rating.controller.js
│   ├── comment.controller.js
│   ├── message.controller.js
│   ├── report.controller.js
│   ├── notification.controller.js
│   └── admin.controller.js
│
├── routes/                     # API Routes
│   ├── auth.routes.js         # ✅ مكتمل
│   ├── user.routes.js         # ✅ مكتمل
│   ├── challenge.routes.js    # ⏳ قيد الإنشاء
│   ├── rating.routes.js
│   ├── comment.routes.js
│   ├── message.routes.js
│   ├── report.routes.js
│   ├── notification.routes.js
│   └── admin.routes.js
│
├── middleware/                 # Middleware Functions
│   ├── auth.js                # Authentication
│   ├── errorHandler.js        # Error Handling
│   ├── notFound.js            # 404 Handler
│   ├── validate.js            # Validation
│   ├── asyncHandler.js        # Async Wrapper
│   ├── checkBlocked.js        # Block Check
│   ├── uploadHandler.js       # File Upload
│   └── requestLogger.js       # Request Logger
│
├── validators/                 # Validation Rules
│   ├── auth.validator.js      # ✅ مكتمل
│   ├── user.validator.js      # ✅ مكتمل
│   ├── challenge.validator.js
│   └── ...
│
├── utils/                      # Utility Functions
│   └── sendEmail.js           # Email Sender
│
├── templates/                  # Email Templates
│   └── email/
│       ├── welcomeEmail.js
│       └── passwordResetEmail.js
│
├── scripts/                    # Utility Scripts
│   ├── generateEncryptionKey.js
│   ├── createAdmin.js
│   ├── seedDatabase.js
│   └── cleanup.js
│
├── tests/                      # Test Files
│   ├── auth.test.js
│   ├── user.test.js
│   └── challenge.test.js
│
├── logs/                       # Log Files
│   ├── error.log
│   └── combined.log
│
└── uploads/                    # Uploaded Files
    └── avatars/
```

---

## 🌐 API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | تسجيل مستخدم جديد | ❌ |
| POST | `/login` | تسجيل دخول | ❌ |
| POST | `/logout` | تسجيل خروج | ✅ |
| GET | `/me` | معلومات المستخدم الحالي | ✅ |
| PUT | `/update-profile` | تحديث البروفايل | ✅ |
| PUT | `/change-password` | تغيير كلمة المرور | ✅ |
| POST | `/youtube/connect` | ربط YouTube | ✅ |
| GET | `/youtube/callback` | YouTube OAuth Callback | ❌ |
| DELETE | `/youtube/disconnect` | فك ربط YouTube | ✅ |

### Users (`/api/v1/users`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search` | بحث عن مستخدمين | ❌ |
| GET | `/:id` | ملف مستخدم | ❌ |
| GET | `/:id/challenges` | منافسات المستخدم | ❌ |
| GET | `/:id/followers` | قائمة المتابعين | ❌ |
| GET | `/:id/following` | قائمة المتابَعين | ❌ |
| POST | `/:id/follow` | متابعة مستخدم | ✅ |
| DELETE | `/:id/follow` | إلغاء المتابعة | ✅ |
| POST | `/:id/block` | حظر مستخدم | ✅ |
| DELETE | `/:id/block` | إلغاء الحظر | ✅ |
| GET | `/blocked` | قائمة المحظورين | ✅ |
| GET | `/:id/earnings` | سجل الأرباح | ✅ |
| PUT | `/bank-details` | تحديث بيانات بنكية | ✅ |
| GET | `/bank-details` | عرض بيانات بنكية | ✅ |

### Challenges (`/api/v1/challenges`)
*(قيد الإنشاء - سيتم إضافتها)*

---

## 🔌 WebSocket Events

### Client → Server

```javascript
// Join challenge room
socket.emit('join_challenge', { challengeId });

// Leave challenge room
socket.emit('leave_challenge', { challengeId });
```

### Server → Client

```javascript
// Viewer joined
socket.on('viewer_joined', ({ viewerCount, user }));

// Viewer left
socket.on('viewer_left', ({ viewerCount, user }));

// Ratings update
socket.on('ratings_update', ({ challengeId, ratings, timestamp }));

// Comment added
socket.on('comment_added', ({ challengeId, comment, timestamp }));

// Viewer count update (every 5 seconds)
socket.on('viewer_count_update', ({ challengeId, viewerCount, timestamp }));

// Advertisement display
socket.on('ad_display', ({ challengeId, ad, timestamp }));

// Advertisement rejected
socket.on('ad_rejected', ({ challengeId, adId, rejectedBy, reason }));

// Challenge status changed
socket.on('challenge_status_changed', ({ challengeId, status, message }));
```

---

## 🔐 الأمان

### Authentication
- **JWT Tokens** في HTTP-Only Cookies
- مدة صلاحية: 7 أيام (قابلة للتعديل)
- Refresh على كل طلب

### Encryption
- **Passwords:** bcrypt (cost factor: 10)
- **Bank Details:** AES-256-GCM
- **YouTube Tokens:** AES-256-GCM

### Rate Limiting
- **General API:** 100 requests / 15 minutes
- **Auth Endpoints:** 5 attempts / 15 minutes
- **Interactions:** 50 requests / minute

### Data Protection
- **NoSQL Injection:** express-mongo-sanitize
- **XSS:** Helmet.js
- **CSRF:** SameSite Cookies
- **Input Validation:** express-validator

---

## 🧪 الاختبار

### تشغيل جميع الاختبارات
```bash
npm test
```

### تشغيل اختبارات محددة
```bash
npm test -- auth.test.js
```

### Coverage Report
```bash
npm test -- --coverage
```

**الهدف:** > 80% code coverage

---

## 🚢 النشر

### Development
```bash
npm run dev
```

### Production

#### 1. باستخدام PM2
```bash
# تثبيت PM2
npm install -g pm2

# تشغيل
pm2 start server.js --name dueli-api

# عرض اللوجات
pm2 logs dueli-api

# إعادة التشغيل
pm2 restart dueli-api
```

#### 2. باستخدام Docker
```bash
# Build image
docker build -t dueli-backend .

# Run container
docker run -d -p 5000:5000 --env-file .env dueli-backend
```

#### 3. باستخدام Docker Compose
```bash
docker-compose up -d
```

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-16T18:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "memory": {
    "used": "150 MB",
    "total": "512 MB"
  }
}
```

### Logs
```bash
# View logs
tail -f logs/combined.log
tail -f logs/error.log

# With PM2
pm2 logs dueli-api
```

---

## 🤝 المساهمة

نرحب بجميع المساهمات! المشروع مفتوح المصدر ويهدف لجعل العالم مكاناً أفضل.

### كيفية المساهمة

1. **Fork المشروع**
2. **إنشاء Branch جديد**
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit التغييرات**
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. **Push للـ Branch**
   ```bash
   git push origin feature/AmazingFeature
   ```
5. **فتح Pull Request**

### معايير الكود
- **ESLint:** اتبع قواعد Airbnb
- **Comments:** 90% من الكود يجب أن يحتوي على تعليقات
- **Tests:** اكتب اختبارات لكل ميزة جديدة
- **Documentation:** حدّث README عند الضرورة

---

## 📝 الترخيص

هذا المشروع مرخص تحت **MIT License** - انظر ملف [LICENSE](LICENSE) للتفاصيل.

```
MIT License - Open Source & Free
© 2024 Dueli Platform
```

---

## 👥 الفريق

- **المطور الرئيسي:** [اسمك]
- **المساهمون:** [قائمة المساهمين]

---

## 🔗 روابط مهمة

- **الموقع الرسمي:** https://dueli.platform
- **Documentation:** https://docs.dueli.platform
- **GitHub:** https://github.com/dueli-platform
- **Discord:** https://discord.gg/dueli

---

## 📞 الدعم

إذا واجهت أي مشاكل أو لديك استفسارات:

- **Issues:** [GitHub Issues](https://github.com/your-org/dueli-backend/issues)
- **Email:** support@dueli.platform
- **Discord:** [Join our server](https://discord.gg/dueli)

---

**صُنع بـ ❤️ من أجل مجتمع أفضل**

*منصة Dueli - حيث التنافس يلتقي بالحضارة* ⚔️