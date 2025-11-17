// ============================================
// routes/report.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  createReport,
  getAllReports,
  getReport,
  reviewReport
} = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createReportValidator,
  getAllReportsValidator,
  reviewReportValidator
} = require('../validators/report.validator');

// @route   POST /api/v1/reports
// @desc    إنشاء بلاغ
// @access  Private
router.post(
  '/',
  protect,
  createReportValidator,
  validate,
  createReport
);

// @route   GET /api/v1/reports
// @desc    الحصول على جميع البلاغات
// @access  Private (Admin only)
router.get(
  '/',
  protect,
  authorize('admin'),
  getAllReportsValidator,
  validate,
  getAllReports
);

// @route   GET /api/v1/reports/:reportId
// @desc    الحصول على تفاصيل بلاغ
// @access  Private (Admin only)
router.get(
  '/:reportId',
  protect,
  authorize('admin'),
  getReport
);

// @route   PUT /api/v1/reports/:reportId/review
// @desc    مراجعة بلاغ
// @access  Private (Admin only)
router.put(
  '/:reportId/review',
  protect,
  authorize('admin'),
  reviewReportValidator,
  validate,
  reviewReport
);

module.exports = router;

// ============================================
// routes/notification.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getNotificationsValidator
} = require('../validators/notification.validator');

// @route   GET /api/v1/notifications
// @desc    الحصول على إشعارات المستخدم
// @access  Private
router.get(
  '/',
  protect,
  getNotificationsValidator,
  validate,
  getNotifications
);

// @route   PUT /api/v1/notifications/read-all
// @desc    وضع علامة مقروء على جميع الإشعارات
// @access  Private
router.put(
  '/read-all',
  protect,
  markAllAsRead
);

// @route   DELETE /api/v1/notifications/read
// @desc    حذف جميع الإشعارات المقروءة
// @access  Private
router.delete(
  '/read',
  protect,
  deleteReadNotifications
);

// @route   PUT /api/v1/notifications/:notificationId/read
// @desc    وضع علامة مقروء على إشعار
// @access  Private
router.put(
  '/:notificationId/read',
  protect,
  markAsRead
);

// @route   DELETE /api/v1/notifications/:notificationId
// @desc    حذف إشعار
// @access  Private
router.delete(
  '/:notificationId',
  protect,
  deleteNotification
);

module.exports = router;

// ============================================
// validators/report.validator.js
// ============================================

const { param, body, query } = require('express-validator');

/**
 * Validator: إنشاء بلاغ
 */
exports.createReportValidator = [
  body('reportedItem')
    .notEmpty()
    .withMessage('معرف العنصر المُبلغ عنه مطلوب')
    .isMongoId()
    .withMessage('معرف العنصر غير صحيح'),
  
  body('itemType')
    .notEmpty()
    .withMessage('نوع العنصر مطلوب')
    .isIn(['user', 'challenge', 'comment'])
    .withMessage('نوع العنصر يجب أن يكون: user, challenge, أو comment'),
  
  body('reason')
    .notEmpty()
    .withMessage('سبب البلاغ مطلوب')
    .isIn([
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'inappropriate_content',
      'copyright',
      'misinformation',
      'impersonation',
      'other'
    ])
    .withMessage('سبب البلاغ غير صحيح'),
  
  body('description')
    .optional()
    .isString()
    .withMessage('الوصف يجب أن يكون نص')
    .isLength({ max: 1000 })
    .withMessage('الوصف يجب ألا يتجاوز 1000 حرف')
    .trim()
];

/**
 * Validator: الحصول على جميع البلاغات
 */
exports.getAllReportsValidator = [
  query('status')
    .optional()
    .isIn(['pending', 'under_review', 'resolved', 'rejected'])
    .withMessage('حالة البلاغ غير صحيحة'),
  
  query('itemType')
    .optional()
    .isIn(['user', 'challenge', 'comment'])
    .withMessage('نوع العنصر غير صحيح'),
  
  query('reason')
    .optional()
    .isIn([
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'inappropriate_content',
      'copyright',
      'misinformation',
      'impersonation',
      'other'
    ])
    .withMessage('سبب البلاغ غير صحيح'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  
  query('sort')
    .optional()
    .isIn(['-createdAt', 'createdAt', '-status', 'status'])
    .withMessage('خيار الترتيب غير صحيح')
];

/**
 * Validator: مراجعة بلاغ
 */
exports.reviewReportValidator = [
  param('reportId')
    .isMongoId()
    .withMessage('معرف البلاغ غير صحيح'),
  
  body('action')
    .notEmpty()
    .withMessage('الإجراء مطلوب')
    .isIn(['approve', 'reject'])
    .withMessage('الإجراء يجب أن يكون: approve أو reject'),
  
  body('adminNotes')
    .optional()
    .isString()
    .withMessage('ملاحظات الإدارة يجب أن تكون نص')
    .isLength({ max: 1000 })
    .withMessage('ملاحظات الإدارة يجب ألا تتجاوز 1000 حرف')
    .trim()
];

// ============================================
// validators/notification.validator.js
// ============================================

const { query } = require('express-validator');

/**
 * Validator: الحصول على الإشعارات
 */
exports.getNotificationsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  
  query('unreadOnly')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('قيمة unreadOnly يجب أن تكون true أو false')
];
