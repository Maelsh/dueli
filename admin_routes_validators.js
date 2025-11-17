// ============================================
// routes/admin.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  banUser,
  updateUserRole,
  verifyUser,
  deleteUser,
  getChallenges,
  suspendChallenge,
  deleteChallenge,
  getAdvertisements,
  reviewAdvertisement,
  getFinancialStats
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getUsersValidator,
  banUserValidator,
  updateUserRoleValidator,
  getChallengesValidator,
  suspendChallengeValidator,
  getAdvertisementsValidator,
  reviewAdvertisementValidator,
  getFinancialStatsValidator
} = require('../validators/admin.validator');

// كل الـ routes تحتاج admin authorization
router.use(protect, authorize('admin'));

// ========== Dashboard ==========
// @route   GET /api/v1/admin/dashboard
// @desc    لوحة التحكم - إحصائيات عامة
router.get('/dashboard', getDashboardStats);

// ========== Users Management ==========
// @route   GET /api/v1/admin/users
// @desc    قائمة المستخدمين
router.get('/users', getUsersValidator, validate, getUsers);

// @route   PUT /api/v1/admin/users/:userId/ban
// @desc    حظر/إلغاء حظر مستخدم
router.put('/users/:userId/ban', banUserValidator, validate, banUser);

// @route   PUT /api/v1/admin/users/:userId/role
// @desc    تحديث دور مستخدم
router.put('/users/:userId/role', updateUserRoleValidator, validate, updateUserRole);

// @route   PUT /api/v1/admin/users/:userId/verify
// @desc    التحقق من حساب مستخدم
router.put('/users/:userId/verify', verifyUser);

// @route   DELETE /api/v1/admin/users/:userId
// @desc    حذف مستخدم نهائياً
router.delete('/users/:userId', deleteUser);

// ========== Challenges Management ==========
// @route   GET /api/v1/admin/challenges
// @desc    قائمة المنافسات
router.get('/challenges', getChallengesValidator, validate, getChallenges);

// @route   PUT /api/v1/admin/challenges/:challengeId/suspend
// @desc    إيقاف/تفعيل منافسة
router.put(
  '/challenges/:challengeId/suspend',
  suspendChallengeValidator,
  validate,
  suspendChallenge
);

// @route   DELETE /api/v1/admin/challenges/:challengeId
// @desc    حذف منافسة نهائياً
router.delete('/challenges/:challengeId', deleteChallenge);

// ========== Advertisements Management ==========
// @route   GET /api/v1/admin/advertisements
// @desc    قائمة الإعلانات
router.get('/advertisements', getAdvertisementsValidator, validate, getAdvertisements);

// @route   PUT /api/v1/admin/advertisements/:adId/review
// @desc    الموافقة/رفض إعلان
router.put(
  '/advertisements/:adId/review',
  reviewAdvertisementValidator,
  validate,
  reviewAdvertisement
);

// ========== Financial Stats ==========
// @route   GET /api/v1/admin/financial-stats
// @desc    إحصائيات مالية مفصلة
router.get('/financial-stats', getFinancialStatsValidator, validate, getFinancialStats);

module.exports = router;

// ============================================
// validators/admin.validator.js
// ============================================

const { param, body, query } = require('express-validator');

/**
 * Validator: قائمة المستخدمين
 */
exports.getUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'banned'])
    .withMessage('الحالة يجب أن تكون: active, inactive, أو banned'),
  
  query('verified')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('قيمة verified يجب أن تكون true أو false'),
  
  query('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('الدور يجب أن يكون: user أو admin'),
  
  query('search')
    .optional()
    .isString()
    .withMessage('البحث يجب أن يكون نص')
    .trim(),
  
  query('sort')
    .optional()
    .isIn(['-createdAt', 'createdAt', '-username', 'username'])
    .withMessage('خيار الترتيب غير صحيح')
];

/**
 * Validator: حظر مستخدم
 */
exports.banUserValidator = [
  param('userId')
    .isMongoId()
    .withMessage('معرف المستخدم غير صحيح'),
  
  body('reason')
    .optional()
    .isString()
    .withMessage('السبب يجب أن يكون نص')
    .isLength({ max: 500 })
    .withMessage('السبب يجب ألا يتجاوز 500 حرف')
    .trim(),
  
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('المدة يجب أن تكون رقم موجب (0 للحظر الدائم)')
];

/**
 * Validator: تحديث دور مستخدم
 */
exports.updateUserRoleValidator = [
  param('userId')
    .isMongoId()
    .withMessage('معرف المستخدم غير صحيح'),
  
  body('role')
    .notEmpty()
    .withMessage('الدور مطلوب')
    .isIn(['user', 'admin'])
    .withMessage('الدور يجب أن يكون: user أو admin')
];

/**
 * Validator: قائمة المنافسات
 */
exports.getChallengesValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  
  query('status')
    .optional()
    .isIn(['scheduled', 'live', 'completed', 'cancelled', 'suspended'])
    .withMessage('الحالة غير صحيحة'),
  
  query('category')
    .optional()
    .isIn(['dialogue', 'science', 'talent'])
    .withMessage('التصنيف يجب أن يكون: dialogue, science, أو talent'),
  
  query('search')
    .optional()
    .isString()
    .withMessage('البحث يجب أن يكون نص')
    .trim(),
  
  query('sort')
    .optional()
    .isIn(['-createdAt', 'createdAt', '-scheduledAt', 'scheduledAt'])
    .withMessage('خيار الترتيب غير صحيح')
];

/**
 * Validator: إيقاف منافسة
 */
exports.suspendChallengeValidator = [
  param('challengeId')
    .isMongoId()
    .withMessage('معرف المنافسة غير صحيح'),
  
  body('reason')
    .optional()
    .isString()
    .withMessage('السبب يجب أن يكون نص')
    .isLength({ max: 500 })
    .withMessage('السبب يجب ألا يتجاوز 500 حرف')
    .trim()
];

/**
 * Validator: قائمة الإعلانات
 */
exports.getAdvertisementsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  
  query('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'displayed'])
    .withMessage('الحالة غير صحيحة'),
  
  query('sort')
    .optional()
    .isIn(['-createdAt', 'createdAt', '-amount', 'amount'])
    .withMessage('خيار الترتيب غير صحيح')
];

/**
 * Validator: مراجعة إعلان
 */
exports.reviewAdvertisementValidator = [
  param('adId')
    .isMongoId()
    .withMessage('معرف الإعلان غير صحيح'),
  
  body('action')
    .notEmpty()
    .withMessage('الإجراء مطلوب')
    .isIn(['approve', 'reject'])
    .withMessage('الإجراء يجب أن يكون: approve أو reject'),
  
  body('reason')
    .optional()
    .isString()
    .withMessage('السبب يجب أن يكون نص')
    .isLength({ max: 500 })
    .withMessage('السبب يجب ألا يتجاوز 500 حرف')
    .trim()
];

/**
 * Validator: إحصائيات مالية
 */
exports.getFinancialStatsValidator = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('تاريخ البداية غير صحيح'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('تاريخ النهاية غير صحيح')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      }
      return true;
    })
];
