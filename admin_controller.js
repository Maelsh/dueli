// controllers/admin.controller.js

const User = require('../models/User');
const Challenge = require('../models/Challenge');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const Advertisement = require('../models/Advertisement');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    لوحة التحكم - إحصائيات عامة
 * @route   GET /api/v1/admin/dashboard
 * @access  Private (Admin only)
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // إحصائيات المستخدمين
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ status: 'active' });
  const verifiedUsers = await User.countDocuments({ verified: true });
  const bannedUsers = await User.countDocuments({ status: 'banned' });

  // إحصائيات المنافسات
  const totalChallenges = await Challenge.countDocuments();
  const liveChallenges = await Challenge.countDocuments({ status: 'live' });
  const completedChallenges = await Challenge.countDocuments({ status: 'completed' });
  const pendingChallenges = await Challenge.countDocuments({ status: 'scheduled' });

  // إحصائيات البلاغات
  const totalReports = await Report.countDocuments();
  const pendingReports = await Report.countDocuments({ status: 'pending' });
  const resolvedReports = await Report.countDocuments({ status: 'resolved' });

  // إحصائيات مالية
  const totalRevenue = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const platformRevenue = await Transaction.aggregate([
    {
      $match: { type: 'platform_fee' }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const userEarnings = await Transaction.aggregate([
    {
      $match: { type: 'challenge_earning' }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  // أحدث المستخدمين
  const recentUsers = await User.find()
    .sort('-createdAt')
    .limit(5)
    .select('username email avatar verified createdAt');

  // أحدث المنافسات
  const recentChallenges = await Challenge.find()
    .sort('-createdAt')
    .limit(5)
    .populate('creator', 'username')
    .select('title category status createdAt');

  // التقارير حسب النوع
  const reportsByType = await Report.aggregate([
    {
      $group: {
        _id: '$itemType',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        banned: bannedUsers
      },
      challenges: {
        total: totalChallenges,
        live: liveChallenges,
        completed: completedChallenges,
        pending: pendingChallenges
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        platform: platformRevenue[0]?.total || 0,
        users: userEarnings[0]?.total || 0
      },
      recentUsers,
      recentChallenges,
      reportsByType
    }
  });
});

/**
 * @desc    إدارة المستخدمين - قائمة
 * @route   GET /api/v1/admin/users
 * @access  Private (Admin only)
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    verified,
    role,
    search,
    sort = '-createdAt'
  } = req.query;

  // بناء الاستعلام
  const query = {};
  
  if (status) query.status = status;
  if (verified !== undefined) query.verified = verified === 'true';
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const users = await User.find(query)
    .select('-password -resetPasswordToken -resetPasswordExpire')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: users
  });
});

/**
 * @desc    حظر/إلغاء حظر مستخدم
 * @route   PUT /api/v1/admin/users/:userId/ban
 * @access  Private (Admin only)
 */
exports.banUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason, duration } = req.body; // duration in days, 0 = permanent

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'لا يمكن حظر المسؤولين'
    });
  }

  // تبديل حالة الحظر
  if (user.status === 'banned') {
    user.status = 'active';
    user.banReason = undefined;
    user.bannedUntil = undefined;
  } else {
    user.status = 'banned';
    user.banReason = reason;
    if (duration && duration > 0) {
      user.bannedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    }
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: user.status === 'banned' ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم',
    data: user
  });
});

/**
 * @desc    تحديث دور مستخدم
 * @route   PUT /api/v1/admin/users/:userId/role
 * @access  Private (Admin only)
 */
exports.updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'تم تحديث دور المستخدم بنجاح',
    data: user
  });
});

/**
 * @desc    التحقق من حساب مستخدم
 * @route   PUT /api/v1/admin/users/:userId/verify
 * @access  Private (Admin only)
 */
exports.verifyUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  user.verified = !user.verified;
  await user.save();

  res.status(200).json({
    success: true,
    message: user.verified ? 'تم التحقق من المستخدم بنجاح' : 'تم إلغاء التحقق من المستخدم',
    data: user
  });
});

/**
 * @desc    حذف مستخدم نهائياً
 * @route   DELETE /api/v1/admin/users/:userId
 * @access  Private (Admin only)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'لا يمكن حذف المسؤولين'
    });
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: 'تم حذف المستخدم نهائياً'
  });
});

/**
 * @desc    إدارة المنافسات
 * @route   GET /api/v1/admin/challenges
 * @access  Private (Admin only)
 */
exports.getChallenges = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = {};
  
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) {
    query.title = { $regex: search, $options: 'i' };
  }

  const skip = (page - 1) * limit;

  const challenges = await Challenge.find(query)
    .populate('creator', 'username email')
    .populate('participants.user', 'username')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Challenge.countDocuments(query);

  res.status(200).json({
    success: true,
    count: challenges.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: challenges
  });
});

/**
 * @desc    إيقاف/تفعيل منافسة
 * @route   PUT /api/v1/admin/challenges/:challengeId/suspend
 * @access  Private (Admin only)
 */
exports.suspendChallenge = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { reason } = req.body;

  const challenge = await Challenge.findById(challengeId);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  if (challenge.status === 'suspended') {
    challenge.status = 'scheduled';
  } else {
    challenge.previousStatus = challenge.status;
    challenge.status = 'suspended';
    challenge.suspensionReason = reason;
  }

  await challenge.save();

  res.status(200).json({
    success: true,
    message: challenge.status === 'suspended' ? 'تم إيقاف المنافسة' : 'تم تفعيل المنافسة',
    data: challenge
  });
});

/**
 * @desc    حذف منافسة نهائياً
 * @route   DELETE /api/v1/admin/challenges/:challengeId
 * @access  Private (Admin only)
 */
exports.deleteChallenge = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;

  const challenge = await Challenge.findById(challengeId);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  await challenge.deleteOne();

  res.status(200).json({
    success: true,
    message: 'تم حذف المنافسة نهائياً'
  });
});

/**
 * @desc    إدارة الإعلانات
 * @route   GET /api/v1/admin/advertisements
 * @access  Private (Admin only)
 */
exports.getAdvertisements = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    sort = '-createdAt'
  } = req.query;

  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const advertisements = await Advertisement.find(query)
    .populate('advertiser', 'username email')
    .populate('challenge', 'title')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Advertisement.countDocuments(query);

  res.status(200).json({
    success: true,
    count: advertisements.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: advertisements
  });
});

/**
 * @desc    الموافقة/رفض إعلان
 * @route   PUT /api/v1/admin/advertisements/:adId/review
 * @access  Private (Admin only)
 */
exports.reviewAdvertisement = asyncHandler(async (req, res) => {
  const { adId } = req.params;
  const { action, reason } = req.body; // action: 'approve' or 'reject'

  const ad = await Advertisement.findById(adId);

  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'الإعلان غير موجود'
    });
  }

  if (action === 'approve') {
    ad.status = 'approved';
  } else {
    ad.status = 'rejected';
    ad.rejectionReason = reason;
  }

  ad.reviewedAt = new Date();
  await ad.save();

  res.status(200).json({
    success: true,
    message: action === 'approve' ? 'تمت الموافقة على الإعلان' : 'تم رفض الإعلان',
    data: ad
  });
});

/**
 * @desc    إحصائيات مالية مفصلة
 * @route   GET /api/v1/admin/financial-stats
 * @access  Private (Admin only)
 */
exports.getFinancialStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const query = {};
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  // إجمالي المعاملات
  const totalTransactions = await Transaction.countDocuments(query);

  // الإيرادات حسب النوع
  const revenueByType = await Transaction.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // أعلى الأرباح للمستخدمين
  const topEarners = await Transaction.aggregate([
    {
      $match: { type: 'challenge_earning', ...query }
    },
    {
      $group: {
        _id: '$user',
        totalEarnings: { $sum: '$amount' },
        transactionsCount: { $sum: 1 }
      }
    },
    { $sort: { totalEarnings: -1 } },
    { $limit: 10 }
  ]);

  // تحميل معلومات المستخدمين
  const topEarnersWithInfo = await Promise.all(
    topEarners.map(async (earner) => {
      const user = await User.findById(earner._id).select('username email avatar');
      return {
        user,
        totalEarnings: earner.totalEarnings,
        transactionsCount: earner.transactionsCount
      };
    })
  );

  // الإيرادات الشهرية
  const monthlyRevenue = await Transaction.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalTransactions,
      revenueByType,
      topEarners: topEarnersWithInfo,
      monthlyRevenue
    }
  });
});
