// ============================================
// FILE: routes/challenge.routes.js
// Challenge Routes
// ============================================

const express = require('express');
const router = express.Router();

const {
  listChallenges,
  getChallengeDetails,
  createChallenge,
  updateChallenge,
  cancelChallenge,
  requestToJoin,
  acceptRejectJoinRequest,
  startChallenge,
  endChallenge,
  rejectAdvertisement,
  getChallengeRatings,
  getChallengeComments
} = require('../controllers/challenge.controller');

const { protect, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createChallengeValidation,
  updateChallengeValidation,
  joinRequestValidation,
  acceptRejectValidation,
  rejectAdValidation
} = require('../validators/challenge.validator');

// ============================================
// PUBLIC ROUTES
// ============================================

// List and search challenges
router.get('/', optionalAuth, listChallenges);

// Get challenge details
router.get('/:id', optionalAuth, getChallengeDetails);

// Get challenge ratings (aggregated)
router.get('/:id/ratings', getChallengeRatings);

// Get challenge comments
router.get('/:id/comments', getChallengeComments);

// ============================================
// PROTECTED ROUTES
// ============================================

// Create challenge
router.post('/', protect, createChallengeValidation, validate, createChallenge);

// Update challenge
router.put('/:id', protect, updateChallengeValidation, validate, updateChallenge);

// Cancel challenge
router.delete('/:id', protect, cancelChallenge);

// Join challenge
router.post('/:id/join', protect, joinRequestValidation, validate, requestToJoin);

// Accept/Reject join request
router.put('/:id/accept/:userId', protect, acceptRejectValidation, validate, acceptRejectJoinRequest);

// Start challenge
router.post('/:id/start', protect, startChallenge);

// End challenge
router.post('/:id/end', protect, endChallenge);

// Reject advertisement
router.post('/:id/reject-ad/:adId', protect, rejectAdValidation, validate, rejectAdvertisement);

module.exports = router;

// ============================================
// FILE: validators/challenge.validator.js
// Challenge Validation Rules
// ============================================

const { body, query, param } = require('express-validator');

/**
 * Create challenge validation
 */
exports.createChallengeValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['dialogue', 'science', 'talent'])
    .withMessage('Invalid category'),

  body('field')
    .trim()
    .notEmpty()
    .withMessage('Field is required')
    .isLength({ max: 100 })
    .withMessage('Field cannot exceed 100 characters'),

  body('rules.duration')
    .optional()
    .isInt({ min: 5, max: 300 })
    .withMessage('Duration must be between 5 and 300 minutes'),

  body('rules.rounds')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Rounds must be between 1 and 10'),

  body('rules.roundDuration')
    .optional()
    .isInt({ min: 1, max: 60 })
    .withMessage('Round duration must be between 1 and 60 minutes'),

  body('rules.customRules')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Custom rules cannot exceed 2000 characters'),

  body('scheduledTime')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Scheduled time must be in the future');
      }
      return true;
    }),

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
 * Update challenge validation
 */
exports.updateChallengeValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid challenge ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('rules')
    .optional()
    .isObject()
    .withMessage('Rules must be an object'),

  body('scheduledTime')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid date')
];

/**
 * Join request validation
 */
exports.joinRequestValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid challenge ID'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters')
];

/**
 * Accept/Reject validation
 */
exports.acceptRejectValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid challenge ID'),

  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['accept', 'reject'])
    .withMessage('Action must be either accept or reject'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters')
];

/**
 * Reject advertisement validation
 */
exports.rejectAdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid challenge ID'),

  param('adId')
    .isMongoId()
    .withMessage('Invalid advertisement ID'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
];

/**
 * List challenges query validation
 */
exports.listChallengesValidation = [
  query('status')
    .optional()
    .isIn(['pending', 'scheduled', 'live', 'completed', 'cancelled'])
    .withMessage('Invalid status'),

  query('category')
    .optional()
    .isIn(['dialogue', 'science', 'talent'])
    .withMessage('Invalid category'),

  query('language')
    .optional()
    .isIn(['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur'])
    .withMessage('Invalid language code'),

  query('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country code must be 2 characters'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('sort')
    .optional()
    .isIn(['createdAt', 'scheduledTime', 'viewerCount', 'totalRevenue'])
    .withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];