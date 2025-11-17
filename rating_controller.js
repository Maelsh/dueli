// controllers/rating.controller.js

const Rating = require('../models/Rating');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    إضافة/تحديث تقييم
 * @route   POST /api/v1/ratings/:challengeId
 * @access  Private
 */
exports.addRating = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { participant, score, comment } = req.body;
  const userId = req.user._id;

  // التحقق من وجود المنافسة
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  // التحقق من أن المنافسة في وضع البث المباشر
  if (challenge.status !== 'live') {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن التقييم إلا أثناء البث المباشر'
    });
  }

  // التحقق من أن المستخدم ليس أحد المتنافسين
  const isParticipant = challenge.participants.some(
    p => p.user.toString() === userId.toString()
  );
  
  if (isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'لا يمكن للمتنافسين تقييم أنفسهم'
    });
  }

  // التحقق من أن participant موجود في المنافسة
  const participantExists = challenge.participants.some(
    p => p.user.toString() === participant.toString()
  );

  if (!participantExists) {
    return res.status(400).json({
      success: false,
      message: 'المشارك المحدد غير موجود في هذه المنافسة'
    });
  }

  // البحث عن تقييم سابق
  let rating = await Rating.findOne({
    challenge: challengeId,
    rater: userId,
    participant
  });

  if (rating) {
    // تحديث التقييم الموجود
    rating.score = score;
    if (comment) rating.comment = comment;
    rating.updatedAt = Date.now();
    await rating.save();
  } else {
    // إنشاء تقييم جديد
    rating = await Rating.create({
      challenge: challengeId,
      rater: userId,
      participant,
      score,
      comment
    });
  }

  // حساب متوسط التقييمات للمشارك
  const ratings = await Rating.find({
    challenge: challengeId,
    participant
  });

  const averageScore = ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length;
  const totalRatings = ratings.length;

  // تحديث إحصائيات المشارك في المنافسة
  const participantIndex = challenge.participants.findIndex(
    p => p.user.toString() === participant.toString()
  );

  if (participantIndex !== -1) {
    challenge.participants[participantIndex].ratings = totalRatings;
    challenge.participants[participantIndex].averageRating = averageScore;
    await challenge.save();
  }

  // إرسال تحديث عبر WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`challenge_${challengeId}`).emit('ratings_update', {
      challengeId,
      participant,
      averageScore,
      totalRatings,
      timestamp: new Date()
    });
  }

  res.status(201).json({
    success: true,
    message: 'تم إضافة التقييم بنجاح',
    data: {
      rating,
      averageScore,
      totalRatings
    }
  });
});

/**
 * @desc    الحصول على تقييمات منافسة
 * @route   GET /api/v1/ratings/:challengeId
 * @access  Public
 */
exports.getChallengeRatings = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { participant, page = 1, limit = 50 } = req.query;

  // التحقق من وجود المنافسة
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  // بناء الاستعلام
  const query = { challenge: challengeId };
  if (participant) {
    query.participant = participant;
  }

  // جلب التقييمات مع pagination
  const skip = (page - 1) * limit;
  
  const ratings = await Rating.find(query)
    .populate('rater', 'username avatar')
    .populate('participant', 'username avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Rating.countDocuments(query);

  // حساب إحصائيات لكل مشارك
  const participantStats = await Rating.aggregate([
    { $match: { challenge: challenge._id } },
    {
      $group: {
        _id: '$participant',
        averageScore: { $avg: '$score' },
        totalRatings: { $sum: 1 },
        maxScore: { $max: '$score' },
        minScore: { $min: '$score' }
      }
    }
  ]);

  // إضافة معلومات المشاركين
  const participantStatsWithInfo = await Promise.all(
    participantStats.map(async (stat) => {
      const user = await User.findById(stat._id).select('username avatar');
      return {
        participant: user,
        averageScore: Math.round(stat.averageScore * 10) / 10,
        totalRatings: stat.totalRatings,
        maxScore: stat.maxScore,
        minScore: stat.minScore
      };
    })
  );

  res.status(200).json({
    success: true,
    count: ratings.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: {
      ratings,
      participantStats: participantStatsWithInfo
    }
  });
});

/**
 * @desc    حذف تقييم (للمستخدم أو الإدارة)
 * @route   DELETE /api/v1/ratings/:ratingId
 * @access  Private
 */
exports.deleteRating = asyncHandler(async (req, res) => {
  const { ratingId } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === 'admin';

  const rating = await Rating.findById(ratingId);
  
  if (!rating) {
    return res.status(404).json({
      success: false,
      message: 'التقييم غير موجود'
    });
  }

  // التحقق من الصلاحية (صاحب التقييم أو الإدارة)
  if (rating.rater.toString() !== userId.toString() && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بحذف هذا التقييم'
    });
  }

  const challengeId = rating.challenge;
  const participant = rating.participant;

  await rating.deleteOne();

  // إعادة حساب المتوسط
  const remainingRatings = await Rating.find({
    challenge: challengeId,
    participant
  });

  let averageScore = 0;
  if (remainingRatings.length > 0) {
    averageScore = remainingRatings.reduce((acc, r) => acc + r.score, 0) / remainingRatings.length;
  }

  // تحديث المنافسة
  const challenge = await Challenge.findById(challengeId);
  const participantIndex = challenge.participants.findIndex(
    p => p.user.toString() === participant.toString()
  );

  if (participantIndex !== -1) {
    challenge.participants[participantIndex].ratings = remainingRatings.length;
    challenge.participants[participantIndex].averageRating = averageScore;
    await challenge.save();
  }

  // إرسال تحديث عبر WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`challenge_${challengeId}`).emit('ratings_update', {
      challengeId,
      participant,
      averageScore,
      totalRatings: remainingRatings.length,
      timestamp: new Date()
    });
  }

  res.status(200).json({
    success: true,
    message: 'تم حذف التقييم بنجاح'
  });
});

/**
 * @desc    الحصول على تقييمات المستخدم
 * @route   GET /api/v1/ratings/user/:userId
 * @access  Public
 */
exports.getUserRatings = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // التحقق من وجود المستخدم
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  const skip = (page - 1) * limit;

  // التقييمات التي قام بها المستخدم
  const ratingsGiven = await Rating.find({ rater: userId })
    .populate('challenge', 'title category')
    .populate('participant', 'username avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  // التقييمات التي حصل عليها المستخدم
  const ratingsReceived = await Rating.find({ participant: userId })
    .populate('challenge', 'title category')
    .populate('rater', 'username avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  // إحصائيات التقييمات المستلمة
  const receivedStats = await Rating.aggregate([
    { $match: { participant: user._id } },
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$score' },
        totalRatings: { $sum: 1 },
        maxScore: { $max: '$score' },
        minScore: { $min: '$score' }
      }
    }
  ]);

  const totalGiven = await Rating.countDocuments({ rater: userId });
  const totalReceived = await Rating.countDocuments({ participant: userId });

  res.status(200).json({
    success: true,
    data: {
      ratingsGiven,
      ratingsReceived,
      stats: {
        given: {
          total: totalGiven,
          page: parseInt(page),
          pages: Math.ceil(totalGiven / limit)
        },
        received: {
          total: totalReceived,
          page: parseInt(page),
          pages: Math.ceil(totalReceived / limit),
          averageScore: receivedStats[0]?.averageScore || 0,
          maxScore: receivedStats[0]?.maxScore || 0,
          minScore: receivedStats[0]?.minScore || 0
        }
      }
    }
  });
});
