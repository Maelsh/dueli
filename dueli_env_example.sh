# ============================================
# DUELI PLATFORM - ENVIRONMENT VARIABLES
# Copy this file to .env and fill in your values
# ============================================

# ===========================================
# SERVER CONFIGURATION
# ===========================================
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
MONGODB_URI=mongodb://localhost:27017/dueli
MONGODB_TEST_URI=mongodb://localhost:27017/dueli_test

# ===========================================
# JWT CONFIGURATION
# ===========================================
# Generate a strong random secret (min 32 characters)
# You can use: openssl rand -base64 32
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long_change_this
JWT_EXPIRES_IN=7d

# ===========================================
# ENCRYPTION CONFIGURATION (AES-256)
# ===========================================
# Generate a 64-character hex string (32 bytes)
# Run: npm run generate-key
# Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ===========================================
# YOUTUBE API CONFIGURATION
# ===========================================
# Get credentials from: https://console.cloud.google.com/
YOUTUBE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:5000/api/v1/auth/youtube/callback

# ===========================================
# EMAIL CONFIGURATION (NodeMailer)
# ===========================================
# For Gmail: Enable "Less secure app access" or use App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password

# Email sender info
EMAIL_FROM=noreply@dueli.platform
EMAIL_FROM_NAME=Dueli Platform

# ===========================================
# REDIS CONFIGURATION (Optional for production)
# ===========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ===========================================
# RATE LIMITING
# ===========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
INTERACTION_RATE_LIMIT_MAX=50

# ===========================================
# LOGGING
# ===========================================
LOG_LEVEL=info

# ===========================================
# EXTERNAL SERVICES (Optional)
# ===========================================
# Sentry for error tracking
SENTRY_DSN=

# Cloudinary for image storage (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=

# ===========================================
# SECURITY
# ===========================================
# Cookie settings
COOKIE_EXPIRE=7
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# ===========================================
# FEATURES FLAGS
# ===========================================
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_WEBSOCKETS=true
ENABLE_FILE_UPLOADS=true

# ===========================================
# DEVELOPMENT ONLY
# ===========================================
# Set to true to see detailed MongoDB queries
MONGOOSE_DEBUG=false

# Bypass email verification in development
BYPASS_EMAIL_VERIFICATION=true