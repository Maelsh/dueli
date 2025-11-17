// ============================================
// controllers/report.controller.js
// ============================================

const Report = require('../models/Report');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    إنشاء بلاغ
 * @route   POST /api/v1/reports
 * @access  Private
 */
exports.createReport = asyncHandler(async (req, res) => {
  const { reportedItem, itemType, reason, description } = req.body;
  const reporterId = req.user._id;

  // التحقق من وجود العنصر المُبلغ عنه
  let itemExists = false;
  let itemDetails = null;

  switch (itemType) {
    case 'user':
      itemDetails = await User.findById(reportedItem);
      itemExists = !!itemDetails;
      break;
    case 'challenge':
      itemDetails = await Challenge.findById(reportedItem);
      itemExists = !!itemDetails;
      break;
    case 'comment':
      const Comment = require('../models/Comment');
      itemDetails = await Comment.findById(reportedItem);
      itemExists = !!itemDetails;
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'نوع العنصر غير صحيح'
      });
  }

  if (!itemExists) {
    return res.status(404).json({
      success: false,
      message: 'العنصر المُبلغ عنه غير موجود'
    });
  }

  // التحقق من عدم الإبلاغ عن نفسه (للمستخدمين)
  if (itemType === 'user' && reportedItem.toString() === reporterId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكنك الإبلاغ عن نفسك'
    });
  }

  // التحقق من عدم تكرار البلاغ
  const existingReport = await Report.findOne({
    reporter: reporterId,
    reportedItem,
    itemType,
    status: { $in: ['pending', 'under_review'] }
  });

  if (existingReport) {
    return res.status(400).json({
      success: false,
      message: 'لقد قمت بالإبلاغ عن هذا العنصر مسبقاً'
    });
  }

  // إنشاء البلاغ
  const report = await Report.create({
    reporter: reporterId,
    reportedItem,
    itemType,
    reason,
    description
  });

  await report.populate('reporter', 'username email');

  res.status(201).json({
    success: true,
    message: 'تم إرسال البلاغ بنجاح',
    data: report
  });
});

/**
 * @desc    الحصول على جميع البلاغات (للإدارة)
 * @route   GET /api/v1/reports
 * @access  Private (Admin only)
 */
exports.getAllReports = asyncHandler(async (req, res) => {
  const {
    status,
    itemType,
    reason,
    page = 1,
    limit = 20,
    sort = '-createdAt'
  } = req.query;

  // بناء الاستعلام
  const query = {};
  
  if (status) query.status = status;
  if (itemType) query.itemType = itemType;
  if (reason) query.reason = reason;

  const skip = (page - 1) * limit;

  // جلب البلاغات
  const reports = await Report.find(query)
    .populate('reporter', 'username email avatar')
    .populate('reviewedBy', 'username email')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Report.countDocuments(query);

  // إحصائيات البلاغات
  const stats = await Report.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statsObject = stats.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  res.status(200).json({
    success: true,
    count: reports.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    stats: statsObject,
    data: reports
  });
});

/**
 * @desc    الحصول على تفاصيل بلاغ
 * @route   GET /api/v1/reports/:reportId
 * @access  Private (Admin only)
 */
exports.getReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await Report.findById(reportId)
    .populate('reporter', 'username email avatar verified')
    .populate('reviewedBy', 'username email');

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'البلاغ غير موجود'
    });
  }

  // جلب تفاصيل العنصر المُبلغ عنه
  let itemDetails = null;
  
  switch (report.itemType) {
    case 'user':
      itemDetails = await User.findById(report.reportedItem)
        .select('username email avatar verified createdAt');
      break;
    case 'challenge':
      itemDetails = await Challenge.findById(report.reportedItem)
        .select('title category creator status');
      break;
    case 'comment':
      const Comment = require('../models/Comment');
      itemDetails = await Comment.findById(report.reportedItem)
        .populate('user', 'username')
        .populate('challenge', 'title');
      break;
  }

  res.status(200).json({
    success: true,
    data: {
      report,
      itemDetails
    }
  });
});

/**
 * @desc    مراجعة بلاغ
 * @route   PUT /api/v1/reports/:reportId/review
 * @access  Private (Admin only)
 */
exports.reviewReport = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { action, adminNotes } = req.body;
  const adminId = req.user._id;

  const report = await Report.findById(reportId);

  if (!report) {
    return res.status(404).json({
      success: false,
      message: 'البلاغ غير موجود'
    });
  }

  if (report.status === 'resolved' || report.status === 'rejected') {
    return res.status(400).json({
      success: false,
      message: 'تمت مراجعة هذا البلاغ مسبقاً'
    });
  }

  // تحديث حالة البلاغ
  report.status = action === 'approve' ? 'resolved' : 'rejected';
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  report.adminNotes = adminNotes;

  await report.save();

  // إذا تم الموافقة، اتخاذ إجراء على العنصر المُبلغ عنه
  if (action === 'approve') {
    switch (report.itemType) {
      case 'user':
        // يمكن حظر المستخدم أو تحذيره
        await User.findByIdAndUpdate(report.reportedItem, {
          $inc: { warningCount: 1 }
        });
        break;
      case 'challenge':
        // يمكن إيقاف المنافسة
        await Challenge.findByIdAndUpdate(report.reportedItem, {
          status: 'suspended'
        });
        break;
      case 'comment':
        // حذف التعليق
        const Comment = require('../models/Comment');
        await Comment.findByIdAndUpdate(report.reportedItem, {
          isDeleted: true,
          content: '[تم حذف التعليق من قبل الإدارة]'
        });
        break;
    }
  }

  await report.populate([
    { path: 'reporter', select: 'username email' },
    { path: 'reviewedBy', select: 'username email' }
  ]);

  res.status(200).json({
    success: true,
    message: 'تمت مراجعة البلاغ بنجاح',
    data: report
  });
});

// ============================================
// controllers/notification.controller.js
// ============================================

const Notification = require('../models/Notification');

/**
 * @desc    الحصول على إشعارات المستخدم
 * @route   GET /api/v1/notifications
 * @access  Private
 */
exports.getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

  // بناء الاستعلام
  const query = { recipient: userId };
  
  if (unreadOnly === 'true') {
    query.read = false;
  }

  const skip = (page - 1) * limit;

  // جلب الإشعارات
  const notifications = await Notification.find(query)
    .populate('sender', 'username avatar verified')
    .populate('relatedChallenge', 'title')
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    read: false
  });

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: notifications
  });
});

/**
 * @desc    وضع علامة مقروء على إشعار
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'الإشعار غير موجود'
    });
  }

  if (notification.read) {
    return res.status(200).json({
      success: true,
      message: 'الإشعار مقروء بالفعل'
    });
  }

  notification.read = true;
  notification.readAt = new Date();
  await notification.save();

  res.status(200).json({
    success: true,
    message: 'تم وضع علامة مقروء بنجاح',
    data: notification
  });
});

/**
 * @desc    وضع علامة مقروء على جميع الإشعارات
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.updateMany(
    {
      recipient: userId,
      read: false
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );

  res.status(200).json({
    success: true,
    message: 'تم وضع علامة مقروء على جميع الإشعارات',
    modifiedCount: result.modifiedCount
  });
});

/**
 * @desc    حذف إشعار
 * @route   DELETE /api/v1/notifications/:notificationId
 * @access  Private
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'الإشعار غير موجود'
    });
  }

  await notification.deleteOne();

  res.status(200).json({
    success: true,
    message: 'تم حذف الإشعار بنجاح'
  });
});

/**
 * @desc    حذف جميع الإشعارات المقروءة
 * @route   DELETE /api/v1/notifications/read
 * @access  Private
 */
exports.deleteReadNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Notification.deleteMany({
    recipient: userId,
    read: true
  });

  res.status(200).json({
    success: true,
    message: 'تم حذف جميع الإشعارات المقروءة',
    deletedCount: result.deletedCount
  });
});
