// ============================================
// FILE: config/database.js
// MongoDB Connection Configuration
// ============================================

const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection options
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      family: 4 // Use IPv4
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`Database Name: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;

// ============================================
// FILE: config/logger.js
// Winston Logger Configuration
// ============================================

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    maxsize: 5242880,
    maxFiles: 5
  })
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports
});

module.exports = logger;

// ============================================
// FILE: config/socket.js
// Socket.IO Configuration & Handlers
// ============================================

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('./logger');

// Store active connections
const activeConnections = new Map();

const initializeSocketIO = (io) => {
  
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-passwordHash');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.isSuspended) {
        return next(new Error('Authentication error: Account suspended'));
      }

      // Attach user to socket
      socket.user = user;
      
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.user.username})`);
    
    // Store connection
    activeConnections.set(socket.id, {
      userId: socket.user._id.toString(),
      username: socket.user.username,
      connectedAt: new Date()
    });

    // ===== CHALLENGE ROOM MANAGEMENT =====
    
    // Join challenge room
    socket.on('join_challenge', async (data) => {
      try {
        const { challengeId } = data;
        
        // Join the room
        socket.join(`challenge:${challengeId}`);
        
        logger.info(`User ${socket.user.username} joined challenge ${challengeId}`);
        
        // Get current viewer count
        const room = io.sockets.adapter.rooms.get(`challenge:${challengeId}`);
        const viewerCount = room ? room.size : 0;
        
        // Notify all viewers in room
        io.to(`challenge:${challengeId}`).emit('viewer_joined', {
          viewerCount,
          user: {
            id: socket.user._id,
            username: socket.user.username
          }
        });
        
        // Send current challenge data to newly joined user
        socket.emit('challenge_data', {
          challengeId,
          viewerCount
        });
        
      } catch (error) {
        logger.error('Error joining challenge:', error);
        socket.emit('error', { message: 'Failed to join challenge' });
      }
    });

    // Leave challenge room
    socket.on('leave_challenge', async (data) => {
      try {
        const { challengeId } = data;
        
        socket.leave(`challenge:${challengeId}`);
        
        logger.info(`User ${socket.user.username} left challenge ${challengeId}`);
        
        // Get updated viewer count
        const room = io.sockets.adapter.rooms.get(`challenge:${challengeId}`);
        const viewerCount = room ? room.size : 0;
        
        // Notify remaining viewers
        io.to(`challenge:${challengeId}`).emit('viewer_left', {
          viewerCount,
          user: {
            id: socket.user._id,
            username: socket.user.username
          }
        });
        
      } catch (error) {
        logger.error('Error leaving challenge:', error);
      }
    });

    // ===== RATING EVENTS =====
    
    // Real-time rating update (triggered from API)
    // This is called by the API after saving rating to DB
    socket.on('rating_submitted', async (data) => {
      try {
        const { challengeId, aggregatedRatings } = data;
        
        // Broadcast rating update to all viewers in challenge room
        io.to(`challenge:${challengeId}`).emit('ratings_update', {
          challengeId,
          ratings: aggregatedRatings,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Error broadcasting rating:', error);
      }
    });

    // ===== COMMENT EVENTS =====
    
    // New comment (triggered from API)
    socket.on('comment_posted', async (data) => {
      try {
        const { challengeId, comment } = data;
        
        // Broadcast comment to all viewers
        io.to(`challenge:${challengeId}`).emit('comment_added', {
          challengeId,
          comment,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Error broadcasting comment:', error);
      }
    });

    // ===== ADVERTISEMENT EVENTS =====
    
    // Display advertisement
    socket.on('display_ad', async (data) => {
      try {
        const { challengeId, advertisement } = data;
        
        // Broadcast ad to all viewers
        io.to(`challenge:${challengeId}`).emit('ad_display', {
          challengeId,
          ad: advertisement,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Error displaying ad:', error);
      }
    });

    // Advertisement rejected
    socket.on('ad_rejected', async (data) => {
      try {
        const { challengeId, adId, rejectedBy, reason } = data;
        
        // Broadcast rejection to all viewers
        io.to(`challenge:${challengeId}`).emit('ad_rejected', {
          challengeId,
          adId,
          rejectedBy,
          reason,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Error broadcasting ad rejection:', error);
      }
    });

    // ===== CHALLENGE STATUS EVENTS =====
    
    // Challenge status changed
    socket.on('challenge_status_changed', async (data) => {
      try {
        const { challengeId, status, message } = data;
        
        // Broadcast status change to all viewers
        io.to(`challenge:${challengeId}`).emit('challenge_status_changed', {
          challengeId,
          status,
          message,
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Error broadcasting status change:', error);
      }
    });

    // ===== NOTIFICATION EVENTS =====
    
    // Send notification to specific user
    socket.on('send_notification', async (data) => {
      try {
        const { userId, notification } = data;
        
        // Find all sockets for this user
        const userSockets = Array.from(activeConnections.entries())
          .filter(([_, conn]) => conn.userId === userId.toString())
          .map(([socketId, _]) => socketId);
        
        // Send to all user's connected sockets
        userSockets.forEach(socketId => {
          io.to(socketId).emit('notification_received', notification);
        });
        
      } catch (error) {
        logger.error('Error sending notification:', error);
      }
    });

    // ===== DISCONNECT HANDLER =====
    
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      
      // Remove from active connections
      activeConnections.delete(socket.id);
      
      // Get all rooms this socket was in
      const rooms = Array.from(socket.rooms);
      
      // Update viewer count for challenge rooms
      rooms.forEach(room => {
        if (room.startsWith('challenge:')) {
          const challengeId = room.split(':')[1];
          const remainingRoom = io.sockets.adapter.rooms.get(room);
          const viewerCount = remainingRoom ? remainingRoom.size : 0;
          
          io.to(room).emit('viewer_left', {
            viewerCount,
            user: {
              id: socket.user._id,
              username: socket.user.username
            }
          });
        }
      });
    });

    // ===== ERROR HANDLER =====
    
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Periodic viewer count update (every 5 seconds)
  setInterval(() => {
    const challengeRooms = Array.from(io.sockets.adapter.rooms.entries())
      .filter(([room, _]) => room.startsWith('challenge:'));
    
    challengeRooms.forEach(([room, sockets]) => {
      const challengeId = room.split(':')[1];
      io.to(room).emit('viewer_count_update', {
        challengeId,
        viewerCount: sockets.size,
        timestamp: new Date()
      });
    });
  }, 5000);

  logger.info('Socket.IO initialized successfully');
};

// Helper function to emit to specific user
const emitToUser = (io, userId, event, data) => {
  const userSockets = Array.from(activeConnections.entries())
    .filter(([_, conn]) => conn.userId === userId.toString())
    .map(([socketId, _]) => socketId);
  
  userSockets.forEach(socketId => {
    io.to(socketId).emit(event, data);
  });
};

// Helper function to get active connections count
const getActiveConnectionsCount = () => {
  return activeConnections.size;
};

module.exports = {
  initializeSocketIO,
  emitToUser,
  getActiveConnectionsCount,
  activeConnections
};

// ============================================
// FILE: config/encryption.js
// AES-256-GCM Encryption Utilities
// ============================================

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // Must be 32 bytes (64 hex chars)
const IV_LENGTH = 16; // 16 bytes for AES

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Text to encrypt
 * @returns {object} - Object containing iv, encryptedData, and authTag
 */
const encrypt = (text) => {
  if (!text) {
    throw new Error('Cannot encrypt empty text');
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
};

/**
 * Decrypt data using AES-256-GCM
 * @param {object} encrypted - Object containing iv, encryptedData, and authTag
 * @returns {string} - Decrypted text
 */
const decrypt = (encrypted) => {
  if (!encrypted || !encrypted.iv || !encrypted.encryptedData || !encrypted.authTag) {
    throw new Error('Invalid encrypted data format');
  }

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(encrypted.iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

/**
 * Generate a random encryption key (for setup)
 * @returns {string} - 64 character hex string
 */
const generateKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  generateKey
};

// ============================================
// FILE: config/youtube.js
// YouTube API Configuration
// ============================================

const { google } = require('googleapis');
const logger = require('./logger');

// OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI
);

/**
 * Generate YouTube OAuth URL
 * @param {string} state - Random state for CSRF protection
 * @returns {string} - OAuth URL
 */
const getAuthUrl = (state) => {
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent'
  });
};

/**
 * Get tokens from authorization code
 * @param {string} code - Authorization code from callback
 * @returns {object} - Tokens
 */
const getTokensFromCode = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    logger.error('Error getting tokens from code:', error);
    throw error;
  }
};

/**
 * Create YouTube service with user tokens
 * @param {string} accessToken - User's access token
 * @param {string} refreshToken - User's refresh token
 * @returns {object} - YouTube service instance
 */
const getYouTubeService = (accessToken, refreshToken) => {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  return google.youtube({
    version: 'v3',
    auth: oauth2Client
  });
};

/**
 * Create a live broadcast on YouTube
 * @param {object} youtube - YouTube service instance
 * @param {object} broadcastData - Broadcast configuration
 * @returns {object} - Broadcast details
 */
const createLiveBroadcast = async (youtube, broadcastData) => {
  try {
    const { title, description, scheduledStartTime } = broadcastData;

    // Create broadcast
    const broadcastResponse = await youtube.liveBroadcasts.insert({
      part: ['snippet', 'status', 'contentDetails'],
      requestBody: {
        snippet: {
          title,
          description,
          scheduledStartTime: scheduledStartTime.toISOString()
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true
        }
      }
    });

    // Create stream
    const streamResponse = await youtube.liveStreams.insert({
      part: ['snippet', 'cdn'],
      requestBody: {
        snippet: {
          title: `Stream for ${title}`
        },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '1080p'
        }
      }
    });

    // Bind broadcast to stream
    await youtube.liveBroadcasts.bind({
      part: ['id'],
      id: broadcastResponse.data.id,
      streamId: streamResponse.data.id
    });

    return {
      broadcastId: broadcastResponse.data.id,
      streamKey: streamResponse.data.cdn.ingestionInfo.streamName,
      streamUrl: streamResponse.data.cdn.ingestionInfo.ingestionAddress,
      embedUrl: `https://www.youtube.com/embed/${broadcastResponse.data.id}`,
      watchUrl: `https://www.youtube.com/watch?v=${broadcastResponse.data.id}`
    };

  } catch (error) {
    logger.error('Error creating live broadcast:', error);
    throw error;
  }
};

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  getYouTubeService,
  createLiveBroadcast,
  oauth2Client
};