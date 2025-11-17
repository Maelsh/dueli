// ============================================
// routes/comment.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  addComment,
  getChallengeComments,
  getCommentReplies,
  toggleLike,
  updateComment,
  deleteComment,
  reportComment
} = require('../controllers/comment.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  addCommentValidator,
  getChallengeCommentsValidator,
  getCommentRepliesValidator,
  updateCommentValidator,
  reportCommentValidator
} = require('../validators/comment.validator');

// @route   POST /api/v1/comments/:challengeId
// @desc    إضافة تعليق
// @access  Private
router.post(
  '/:challengeId',
  protect,
  addCommentValidator,
  validate,
  addComment
);

// @route   GET /api/v1/comments/:challengeId
// @desc    الحصول على تعليقات منافسة
// @access  Public
router.get(
  '/:challengeId',
  getChallengeCommentsValidator,
  validate,
  getChallengeComments
);

// @route   GET /api/v1/comments/:commentId/replies
// @desc    الحصول على ردود تعليق
// @access  Public
router.get(
  '/:commentId/replies',
  getCommentRepliesValidator,
  validate,
  getCommentReplies
);

// @route   POST /api/v1/comments/:commentId/like
// @desc    الإعجاب بتعليق / إلغاء الإعجاب
// @access  Private
router.post(
  '/:commentId/like',
  protect,
  toggleLike
);

// @route   PUT /api/v1/comments/:commentId
// @desc    تعديل تعليق
// @access  Private
router.put(
  '/:commentId',
  protect,
  updateCommentValidator,
  validate,
  updateComment
);

// @route   DELETE /api/v1/comments/:commentId
// @desc    حذف تعليق
// @access  Private
router.delete(
  '/:commentId',
  protect,
  deleteComment
);

// @route   POST /api/v1/comments/:commentId/report
// @desc    الإبلاغ عن تعليق
// @access  Private
router.post(
  '/:commentId/report',
  protect,
  reportCommentValidator,
  validate,
  reportComment
);

module.exports = router;

// ============================================
// validators/comment.validator.js
// ============================================

const { param, body, query } = require('express-validator');

/**
 * Validator: إضافة تعليق
 */
exports.addCommentValidator = [
  param('challengeId')
    .isMongoId()
    .withMessage('معرف المنافسة غير صحيح'),
  
  body('content')
    .notEmpty()
    .withMessage('محتوى التعليق مطلوب')
    .isString()
    .withMessage('المحتوى يجب أن يكون نص')
    .isLength({ min: 1, max: 1000 })
    .withMessage('التعليق يجب أن يكون بين 1 و 1000 حرف')
    .trim(),
  
  body('parentComment')
    .optional()
    .isMongoId()
    .withMessage('معرف التعليق الأصلي غير صحيح')
];

/**
 * Validator: الحصول على تعليقات منافسة
 */
exports.getChallengeCommentsValidator = [
  param('challengeId')
    .isMongoId()
    .withMessage('معرف المنافسة غير صحيح'),
  
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
    .isIn(['-createdAt', 'createdAt', '-likes', 'likes'])
    .withMessage('خيار الترتيب غير صحيح'),
  
  query('parentOnly')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('قيمة parentOnly يجب أن تكون true أو false')
];

/**
 * Validator: الحصول على ردود تعليق
 */
exports.getCommentRepliesValidator = [
  param('commentId')
    .isMongoId()
    .withMessage('معرف التعليق غير صحيح'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 50')
];

/**
 * Validator: تعديل تعليق
 */
exports.updateCommentValidator = [
  param('commentId')
    .isMongoId()
    .withMessage('معرف التعليق غير صحيح'),
  
  body('content')
    .notEmpty()
    .withMessage('محتوى التعليق مطلوب')
    .isString()
    .withMessage('المحتوى يجب أن يكون نص')
    .isLength({ min: 1, max: 1000 })
    .withMessage('التعليق يجب أن يكون بين 1 و 1000 حرف')
    .trim()
];

/**
 * Validator: الإبلاغ عن تعليق
 */
exports.reportCommentValidator = [
  param('commentId')
    .isMongoId()
    .withMessage('معرف التعليق غير صحيح'),
  
  body('reason')
    .notEmpty()
    .withMessage('سبب البلاغ مطلوب')
    .isString()
    .withMessage('السبب يجب أن يكون نص')
    .isIn([
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'inappropriate',
      'misinformation',
      'other'
    ])
    .withMessage('سبب البلاغ غير صحيح')
];
