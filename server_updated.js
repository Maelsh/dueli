// server.js - Updated Version

const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');

// Load env vars
dotenv.config();

// Import configurations
const connectDB = require('./config/database');
const logger = require('./config/logger');
const { initializeSocket } = require('./config/socket');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const requestLogger = require('./middleware/requestLogger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const challengeRoutes = require('./routes/challenge.routes');
const ratingRoutes = require('./routes/rating.routes');
const commentRoutes = require('./routes/comment.routes');
const messageRoutes = require('./routes/message.routes');
const reportRoutes = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// ============================================
// Security Middleware
// ============================================

// Helmet - Set security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'تم تجاوز عدد الطلبات المسموح به. الرجاء المحاولة لاحقاً',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'تم تجاوز عدد محاولات تسجيل الدخول. الرجاء المحاولة بعد 15 دقيقة',
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Sanitize data (NoSQL injection prevention)
app.use(mongoSanitize());

// ============================================
// Body Parser Middleware
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// Logging Middleware
// ============================================

if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// ============================================
// API Routes
// ============================================

const API_VERSION = '/api/v1';

app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/users`, userRoutes);
app.use(`${API_VERSION}/challenges`, challengeRoutes);
app.use(`${API_VERSION}/ratings`, ratingRoutes);
app.use(`${API_VERSION}/comments`, commentRoutes);
app.use(`${API_VERSION}/messages`, messageRoutes);
app.use(`${API_VERSION}/reports`, reportRoutes);
app.use(`${API_VERSION}/notifications`, notificationRoutes);
app.use(`${API_VERSION}/admin`, adminRoutes);

// ============================================
// Health Check Endpoint
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: 'connected',
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
    },
  });
});

// ============================================
// Root Endpoint
// ============================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'مرحباً بك في Dueli API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: `${API_VERSION}/auth`,
      users: `${API_VERSION}/users`,
      challenges: `${API_VERSION}/challenges`,
      ratings: `${API_VERSION}/ratings`,
      comments: `${API_VERSION}/comments`,
      messages: `${API_VERSION}/messages`,
      reports: `${API_VERSION}/reports`,
      notifications: `${API_VERSION}/notifications`,
      admin: `${API_VERSION}/admin`,
    },
  });
});

// ============================================
// Error Handling
// ============================================

// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

// ============================================
// Server & Socket.IO Initialization
// ============================================

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Make io accessible to routes
app.set('io', io);

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`📡 WebSocket server is ready`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// ============================================
// Unhandled Promise Rejection
// ============================================

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
