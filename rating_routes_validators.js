// ============================================
// routes/rating.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  addRating,
  getChallengeRatings,
  deleteRating,
  getUserRatings
} = require('../controllers/rating.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  addRatingValidator,
  getChallengeRatingsValidator,
  getUserRatingsValidator
} = require('../validators/rating.validator');

// @route   POST /api/v1/ratings/:challengeId
// @desc    إضافة/تحديث تقييم
// @access  Private
router.post(
  '/:challengeId',
  protect,
  addRatingValidator,
  validate,
  addRating
);

// @route   GET /api/v1/ratings/:challengeId
// @desc    الحصول على تقييمات منافسة
// @access  Public
router.get(
  '/:challengeId',
  getChallengeRatingsValidator,
  validate,
  getChallengeRatings
);

// @route   DELETE /api/v1/ratings/:ratingId
// @desc    حذف تقييم
// @access  Private
router.delete(
  '/:ratingId',
  protect,
  deleteRating
);

// @route   GET /api/v1/ratings/user/:userId
// @desc    الحصول على تقييمات مستخدم
// @access  Public
router.get(
  '/user/:userId',
  getUserRatingsValidator,
  validate,
  getUserRatings
);

module.exports = router;

// ============================================
// validators/rating.validator.js
// ============================================

const { param, body, query } = require('express-validator');

/**
 * Validator: إضافة تقييم
 */
exports.addRatingValidator = [
  param('challengeId')
    .isMongoId()
    .withMessage('معرف المنافسة غير صحيح'),
  
  body('participant')
    .notEmpty()
    .withMessage('معرف المشارك مطلوب')
    .isMongoId()
    .withMessage('معرف المشارك غير صحيح'),
  
  body('score')
    .notEmpty()
    .withMessage('التقييم مطلوب')
    .isInt({ min: 1, max: 10 })
    .withMessage('التقييم يجب أن يكون بين 1 و 10'),
  
  body('comment')
    .optional()
    .isString()
    .withMessage('التعليق يجب أن يكون نص')
    .isLength({ max: 500 })
    .withMessage('التعليق يجب ألا يتجاوز 500 حرف')
    .trim()
];

/**
 * Validator: الحصول على تقييمات منافسة
 */
exports.getChallengeRatingsValidator = [
  param('challengeId')
    .isMongoId()
    .withMessage('معرف المنافسة غير صحيح'),
  
  query('participant')
    .optional()
    .isMongoId()
    .withMessage('معرف المشارك غير صحيح'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100')
];

/**
 * Validator: الحصول على تقييمات مستخدم
 */
exports.getUserRatingsValidator = [
  param('userId')
    .isMongoId()
    .withMessage('معرف المستخدم غير صحيح'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100')
];
