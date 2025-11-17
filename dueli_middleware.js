// ============================================
// FILE: middleware/auth.js
// Authentication & Authorization Middleware
// ============================================

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../config/logger');

/**
 * Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Alternative: Get token from Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authorized to access this route. Please login.'
        }
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.userId).select('-passwordHash');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User no longer exists'
          }
        });
      }

      // Check if user is suspended
      if (user.isSuspended) {
        const message = user.suspendedUntil 
          ? `Account suspended until ${user.suspendedUntil.toISOString()}. Reason: ${user.suspensionReason}`
          : `Account permanently suspended. Reason: ${user.suspensionReason}`;
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message
          }
        });
      }

      // Attach user to request
      req.user = user;
      
      next();
    } catch (err) {
      logger.error('JWT verification error:', err);
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is invalid or expired'
        }
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Authentication error'
      }
    });
  }
};

/**
 * Optional authentication - Does not fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-passwordHash');
        
        if (user && !user.isSuspended) {
          req.user = user;
        }
      } catch (err) {
        // Token invalid, continue without user
        logger.debug('Optional auth: Invalid token');
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Restrict to admin role only
 */
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    });
  }

  next();
};

/**
 * Restrict admin from user actions (ratings, comments, messages)
 */
const restrictAdminActions = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    const restrictedPaths = ['/ratings', '/comments', '/messages'];
    
    if (restrictedPaths.some(path => req.originalUrl.includes(path))) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_RESTRICTION',
          message: 'Admins cannot perform user interaction functions (ratings, comments, messaging)'
        }
      });
    }
  }

  next();
};

/**
 * Check if user owns resource or is admin
 */
const ownerOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const isOwner = req.user._id.toString() === resourceUserId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to access this resource'
        }
      });
    }

    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  adminOnly,
  restrictAdminActions,
  ownerOrAdmin
};

// ============================================
// FILE: middleware/errorHandler.js
// Global Error Handler
// ============================================

const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      success: false,
      error: {
        code: 'INVALID_ID',
        message
      }
    };
    return res.status(404).json(error);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = {
      success: false,
      error: {
        code: 'DUPLICATE_FIELD',
        message,
        field
      }
    };
    return res.status(409).json(error);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    
    error = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors
      }
    };
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    };
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expired'
      }
    };
    return res.status(401).json(error);
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: error.message || 'Server Error'
    }
  });
};

module.exports = errorHandler;

// ============================================
// FILE: middleware/notFound.js
// 404 Not Found Handler
// ============================================

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
      method: req.method,
      path: req.path
    }
  });
};

module.exports = notFound;

// ============================================
// FILE: middleware/validate.js
// Request Validation Middleware
// ============================================

const { validationResult } = require('express-validator');

/**
 * Validate request using express-validator rules
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: extractedErrors
      }
    });
  }

  next();
};

module.exports = { validate };

// ============================================
// FILE: middleware/asyncHandler.js
// Async Route Handler Wrapper
// ============================================

/**
 * Wrap async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;

// ============================================
// FILE: middleware/checkBlocked.js
// Check if users have blocked each other
// ============================================

const { User } = require('../models');

/**
 * Check if sender is blocked by receiver
 * Used for messaging and following
 */
const checkBlocked = async (req, res, next) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.body.receiver || req.params.id;

    if (!receiverId) {
      return next();
    }

    // Get receiver
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if receiver has blocked sender
    if (receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_BLOCKED',
          message: 'You cannot perform this action. User has blocked you.'
        }
      });
    }

    // Check if sender has blocked receiver (optional check)
    const sender = await User.findById(senderId);
    if (sender && sender.blockedUsers.includes(receiverId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_BLOCKED',
          message: 'You have blocked this user'
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = checkBlocked;

// ============================================
// FILE: middleware/uploadHandler.js
// File Upload Handler (for avatars, etc.)
// ============================================

const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  }
};

// Initialize multer
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter
});

module.exports = upload;

// ============================================
// FILE: middleware/requestLogger.js
// Custom Request Logger
// ============================================

const logger = require('../config/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.http({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};

module.exports = requestLogger;