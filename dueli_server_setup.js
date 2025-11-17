// ============================================
// DUELI PLATFORM - MAIN SERVER FILE
// Complete Express + Socket.IO Setup
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');

// Import configurations
const connectDB = require('./config/database');
const { initializeSocketIO } = require('./config/socket');
const logger = require('./config/logger');

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

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Compression
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth rate limit: 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.'
    }
  },
  skipSuccessfulRequests: true
});

// Comment/Rating rate limit: 50 requests per minute
const interactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: {
      code: 'INTERACTION_RATE_LIMIT_EXCEEDED',
      message: 'Too many interactions, please slow down.'
    }
  }
});

// ============================================
// ROUTES
// ============================================

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// API version prefix
const API_PREFIX = '/api/v1';

// Mount routes with appropriate rate limiters
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/users`, apiLimiter, userRoutes);
app.use(`${API_PREFIX}/challenges`, apiLimiter, challengeRoutes);
app.use(`${API_PREFIX}/ratings`, interactionLimiter, ratingRoutes);
app.use(`${API_PREFIX}/comments`, interactionLimiter, commentRoutes);
app.use(`${API_PREFIX}/messages`, apiLimiter, messageRoutes);
app.use(`${API_PREFIX}/reports`, apiLimiter, reportRoutes);
app.use(`${API_PREFIX}/notifications`, apiLimiter, notificationRoutes);
app.use(`${API_PREFIX}/admin`, apiLimiter, adminRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Dueli API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    health: '/health'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ============================================
// DATABASE CONNECTION
// ============================================

connectDB();

// ============================================
// SOCKET.IO INITIALIZATION
// ============================================

initializeSocketIO(io);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err);
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err);
  
  process.exit(1);
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 DUELI PLATFORM SERVER STARTED                       ║
║                                                           ║
║   Environment: ${process.env.NODE_ENV?.padEnd(43) || 'development'.padEnd(43)}║
║   Port:        ${PORT.toString().padEnd(43)}║
║   API URL:     http://localhost:${PORT}/api/v1${' '.repeat(18)}║
║   Health:      http://localhost:${PORT}/health${' '.repeat(21)}║
║                                                           ║
║   Database:    ${mongoose.connection.readyState === 1 ? '✅ Connected'.padEnd(43) : '❌ Disconnected'.padEnd(43)}║
║   Socket.IO:   ✅ Running${' '.repeat(34)}║
║                                                           ║
║   👉 Press Ctrl+C to stop the server                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };