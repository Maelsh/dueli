// ============================================
// FILE: routes/auth.routes.js
// Authentication Routes
// ============================================

const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  initiateYouTubeOAuth,
  handleYouTubeCallback,
  disconnectYouTube,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../validators/auth.validator');

// ============================================
// PUBLIC ROUTES
// ============================================

// Register & Login
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);

// Password Reset
router.post('/forgot-password', forgotPasswordValidation, validate, forgotPassword);
router.put('/reset-password/:token', resetPasswordValidation, validate, resetPassword);

// YouTube OAuth Callback (public but requires valid state)
router.get('/youtube/callback', handleYouTubeCallback);

// ============================================
// PROTECTED ROUTES (Require Authentication)
// ============================================

// Logout
router.post('/logout', protect, logout);

// Get current user
router.get('/me', protect, getMe);

// Update profile
router.put('/update-profile', protect, updateProfileValidation, validate, updateProfile);

// Change password
router.put('/change-password', protect, changePasswordValidation, validate, changePassword);

// YouTube OAuth
router.post('/youtube/connect', protect, initiateYouTubeOAuth);
router.delete('/youtube/disconnect', protect, disconnectYouTube);

module.exports = router;

// ============================================
// FILE: validators/auth.validator.js
// Authentication Validation Rules
// ============================================

const { body, param } = require('express-validator');

/**
 * Register validation rules
 */
exports.registerValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .custom(value => {
      // Reserved usernames
      const reserved = ['admin', 'root', 'system', 'api', 'www'];
      if (reserved.includes(value.toLowerCase())) {
        throw new Error('This username is reserved');
      }
      return true;
    }),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('language')
    .optional()
    .isIn(['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur'])
    .withMessage('Invalid language code'),

  body('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country code must be 2 characters')
    .isAlpha()
    .withMessage('Country code must contain only letters')
];

/**
 * Login validation rules
 */
exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Update profile validation rules
 */
exports.updateProfileValidation = [
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('avatar')
    .optional()
    .trim()
    .isURL()
    .withMessage('Avatar must be a valid URL'),

  body('preferredCategories')
    .optional()
    .isArray()
    .withMessage('Preferred categories must be an array'),

  body('preferredCategories.*')
    .optional()
    .isIn(['dialogue', 'science', 'talent'])
    .withMessage('Invalid category'),

  body('language')
    .optional()
    .isIn(['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur'])
    .withMessage('Invalid language code'),

  body('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country code must be 2 characters')
    .isAlpha()
    .withMessage('Country code must contain only letters')
];

/**
 * Change password validation rules
 */
exports.changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

/**
 * Forgot password validation rules
 */
exports.forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
];

/**
 * Reset password validation rules
 */
exports.resetPasswordValidation = [
  param('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isHexadecimal()
    .withMessage('Invalid token format')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid token length'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// ============================================
// FILE: utils/sendEmail.js
// Email Utility (Future Enhancement)
// ============================================

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Send email
 * @param {object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Email message (text)
 * @param {string} options.html - Email message (HTML)
 */
const sendEmail = async (options) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Email options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent: ${info.messageId}`);
    
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail;

// ============================================
// FILE: templates/email/welcomeEmail.js
// Welcome Email Template
// ============================================

/**
 * Generate welcome email HTML
 * @param {string} username - User's username
 * @returns {string} - HTML email
 */
const getWelcomeEmail = (username) => {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Dueli</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⚔️ مرحباً بك في Dueli</h1>
      </div>
      <div class="content">
        <h2>مرحباً ${username}!</h2>
        <p>نحن سعداء بانضمامك إلى منصة Dueli - منصة التنافس الحضاري.</p>
        <p>الآن يمكنك:</p>
        <ul>
          <li>إنشاء منافساتك الخاصة</li>
          <li>المشاركة في منافسات الآخرين</li>
          <li>الربح من مهاراتك ومواهبك</li>
          <li>التواصل مع منافسين من حول العالم</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="button">
          ابدأ الآن
        </a>
        <p>إذا كنت بحاجة إلى مساعدة، لا تتردد في التواصل معنا.</p>
      </div>
      <div class="footer">
        <p>© 2024 Dueli Platform - جميع الحقوق محفوظة</p>
        <p>منصة مفتوحة المصدر | غير ربحية</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getWelcomeEmail };

// ============================================
// FILE: templates/email/passwordResetEmail.js
// Password Reset Email Template
// ============================================

/**
 * Generate password reset email HTML
 * @param {string} username - User's username
 * @param {string} resetUrl - Password reset URL
 * @returns {string} - HTML email
 */
const getPasswordResetEmail = (username, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>إعادة تعيين كلمة المرور</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .warning {
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⚔️ إعادة تعيين كلمة المرور</h1>
      </div>
      <div class="content">
        <h2>مرحباً ${username}!</h2>
        <p>تلقينا طلباً لإعادة تعيين كلمة مرور حسابك.</p>
        <p>إذا قمت بهذا الطلب، انقر على الزر أدناه لإعادة تعيين كلمة المرور:</p>
        <a href="${resetUrl}" class="button">
          إعادة تعيين كلمة المرور
        </a>
        <div class="warning">
          <strong>⚠️ تحذير:</strong>
          <p>هذا الرابط صالح لمدة 10 دقائق فقط.</p>
          <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذه الرسالة.</p>
        </div>
        <p>إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:</p>
        <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
      </div>
      <div class="footer">
        <p>© 2024 Dueli Platform</p>
        <p>لم تطلب هذه الرسالة؟ تجاهلها بأمان</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { getPasswordResetEmail };