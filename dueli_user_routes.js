// ============================================
// FILE: routes/user.routes.js
// User Routes
// ============================================

const express = require('express');
const router = express.Router();

const {
  getUserProfile,
  getUserChallenges,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUserEarnings,
  updateBankDetails,
  getBankDetails,
  searchUsers,
  getFollowers,
  getFollowing
} = require('../controllers/user.controller');

const { protect, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const checkBlocked = require('../middleware/checkBlocked');
const {
  updateBankDetailsValidation,
  searchUsersValidation
} = require('../validators/user.validator');

// ============================================
// PUBLIC ROUTES
// ============================================

// Search users
router.get('/search', searchUsersValidation, validate, searchUsers);

// Get user profile (optional auth for more details)
router.get('/:id', optionalAuth, getUserProfile);

// Get user's challenges
router.get('/:id/challenges', getUserChallenges);

// Get followers/following
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

// ============================================
// PROTECTED ROUTES
// ============================================

// Follow/Unfollow
router.post('/:id/follow', protect, checkBlocked, followUser);
router.delete('/:id/follow', protect, unfollowUser);

// Block/Unblock
router.post('/:id/block', protect, blockUser);
router.delete('/:id/block', protect, unblockUser);
router.get('/blocked', protect, getBlockedUsers);

// Earnings
router.get('/:id/earnings', protect, getUserEarnings);

// Bank details
router.put('/bank-details', protect, updateBankDetailsValidation, validate, updateBankDetails);
router.get('/bank-details', protect, getBankDetails);

module.exports = router;

// ============================================
// FILE: validators/user.validator.js
// User Validation Rules
// ============================================

const { body, query, param } = require('express-validator');

/**
 * Update bank details validation
 */
exports.updateBankDetailsValidation = [
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .isLength({ min: 8, max: 30 })
    .withMessage('Account number must be between 8 and 30 characters')
    .matches(/^[0-9]+$/)
    .withMessage('Account number must contain only numbers'),

  body('bankName')
    .trim()
    .notEmpty()
    .withMessage('Bank name is required')
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters'),

  body('accountHolder')
    .trim()
    .notEmpty()
    .withMessage('Account holder name is required')
    .isLength({ max: 100 })
    .withMessage('Account holder name cannot exceed 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Account holder name must contain only letters and spaces'),

  body('iban')
    .optional()
    .trim()
    .isLength({ max: 34 })
    .withMessage('IBAN cannot exceed 34 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('IBAN must contain only uppercase letters and numbers')
];

/**
 * Search users validation
 */
exports.searchUsersValidation = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),

  query('language')
    .optional()
    .isIn(['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur'])
    .withMessage('Invalid language code'),

  query('country')
    .optional()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country code must be 2 characters')
    .isAlpha()
    .withMessage('Country code must contain only letters'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

/**
 * User ID parameter validation
 */
exports.userIdValidation = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .custom((value) => {
      // Check if it's a valid MongoDB ObjectId or username
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isUsername = /^[a-zA-Z0-9_]{3,30}$/.test(value);
      
      if (!isObjectId && !isUsername) {
        throw new Error('Invalid user ID or username format');
      }
      
      return true;
    })
];