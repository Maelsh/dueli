// ============================================
// routes/message.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversations,
  getConversationMessages,
  markAsRead,
  deleteMessage,
  deleteConversation,
  searchMessages,
  getUnreadCount
} = require('../controllers/message.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  sendMessageValidator,
  getConversationMessagesValidator,
  searchMessagesValidator
} = require('../validators/message.validator');

// @route   POST /api/v1/messages
// @desc    إرسال رسالة
// @access  Private
router.post(
  '/',
  protect,
  sendMessageValidator,
  validate,
  sendMessage
);

// @route   GET /api/v1/messages/conversations
// @desc    الحصول على المحادثات
// @access  Private
router.get(
  '/conversations',
  protect,
  getConversations
);

// @route   GET /api/v1/messages/unread/count
// @desc    الحصول على عدد الرسائل غير المقروءة
// @access  Private
router.get(
  '/unread/count',
  protect,
  getUnreadCount
);

// @route   GET /api/v1/messages/search
// @desc    البحث في الرسائل
// @access  Private
router.get(
  '/search',
  protect,
  searchMessagesValidator,
  validate,
  searchMessages
);

// @route   GET /api/v1/messages/:userId
// @desc    الحصول على رسائل محادثة
// @access  Private
router.get(
  '/:userId',
  protect,
  getConversationMessagesValidator,
  validate,
  getConversationMessages
);

// @route   PUT /api/v1/messages/:messageId/read
// @desc    وضع علامة مقروء على رسالة
// @access  Private
router.put(
  '/:messageId/read',
  protect,
  markAsRead
);

// @route   DELETE /api/v1/messages/:messageId
// @desc    حذف رسالة
// @access  Private
router.delete(
  '/:messageId',
  protect,
  deleteMessage
);

// @route   DELETE /api/v1/messages/conversation/:userId
// @desc    حذف محادثة كاملة
// @access  Private
router.delete(
  '/conversation/:userId',
  protect,
  deleteConversation
);

module.exports = router;

// ============================================
// validators/message.validator.js
// ============================================

const { param, body, query } = require('express-validator');

/**
 * Validator: إرسال رسالة
 */
exports.sendMessageValidator = [
  body('receiver')
    .notEmpty()
    .withMessage('معرف المستقبل مطلوب')
    .isMongoId()
    .withMessage('معرف المستقبل غير صحيح'),
  
  body('content')
    .notEmpty()
    .withMessage('محتوى الرسالة مطلوب')
    .isString()
    .withMessage('المحتوى يجب أن يكون نص')
    .isLength({ min: 1, max: 2000 })
    .withMessage('الرسالة يجب أن تكون بين 1 و 2000 حرف')
    .trim(),
  
  body('attachments')
    .optional()
    .isArray()
    .withMessage('المرفقات يجب أن تكون مصفوفة')
    .custom((attachments) => {
      if (attachments.length > 5) {
        throw new Error('لا يمكن إرفاق أكثر من 5 ملفات');
      }
      return true;
    }),
  
  body('attachments.*.type')
    .optional()
    .isIn(['image', 'video', 'audio', 'document'])
    .withMessage('نوع المرفق غير صحيح'),
  
  body('attachments.*.url')
    .optional()
    .isURL()
    .withMessage('رابط المرفق غير صحيح'),
  
  body('attachments.*.name')
    .optional()
    .isString()
    .withMessage('اسم المرفق يجب أن يكون نص')
    .isLength({ max: 255 })
    .withMessage('اسم المرفق يجب ألا يتجاوز 255 حرف')
];

/**
 * Validator: الحصول على رسائل محادثة
 */
exports.getConversationMessagesValidator = [
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

/**
 * Validator: البحث في الرسائل
 */
exports.searchMessagesValidator = [
  query('query')
    .notEmpty()
    .withMessage('كلمة البحث مطلوبة')
    .isString()
    .withMessage('كلمة البحث يجب أن تكون نص')
    .isLength({ min: 2, max: 100 })
    .withMessage('كلمة البحث يجب أن تكون بين 2 و 100 حرف')
    .trim(),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون رقم موجب'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100')
];
