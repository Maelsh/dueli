// controllers/comment.controller.js

const Comment = require('../models/Comment');
const Challenge = require('../models/Challenge');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    إضافة تعليق
 * @route   POST /api/v1/comments/:challengeId
 * @access  Private
 */
exports.addComment = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { content, parentComment } = req.body;
  const userId = req.user._id;

  // التحقق من وجود المنافسة
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  // التحقق من أن المنافسة مفعّلة للتعليقات
  if (challenge.status !== 'live' && challenge.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'لا يمكن التعليق على هذه المنافسة في الوقت الحالي'
    });
  }

  // إذا كان رداً على تعليق، التحقق من وجود التعليق الأصلي
  if (parentComment) {
    const parent = await Comment.findById(parentComment);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'التعليق الأصلي غير موجود'
      });
    }
    if (parent.challenge.toString() !== challengeId) {
      return res.status(400).json({
        success: false,
        message: 'التعليق الأصلي لا ينتمي لهذه المنافسة'
      });
    }
  }

  // إنشاء التعليق
  const comment = await Comment.create({
    challenge: challengeId,
    user: userId,
    content,
    parentComment: parentComment || null
  });

  // تحميل معلومات المستخدم
  await comment.populate('user', 'username avatar verified');

  // تحديث عدد التعليقات في المنافسة
  challenge.stats.comments += 1;
  await challenge.save();

  // إذا كان رداً، تحديث عدد الردود في التعليق الأصلي
  if (parentComment) {
    await Comment.findByIdAndUpdate(parentComment, {
      $inc: { repliesCount: 1 }
    });
  }

  // إرسال التعليق عبر WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`challenge_${challengeId}`).emit('comment_added', {
      challengeId,
      comment: {
        _id: comment._id,
        content: comment.content,
        user: comment.user,
        parentComment: comment.parentComment,
        createdAt: comment.createdAt
      },
      timestamp: new Date()
    });
  }

  res.status(201).json({
    success: true,
    message: 'تم إضافة التعليق بنجاح',
    data: comment
  });
});

/**
 * @desc    الحصول على تعليقات منافسة
 * @route   GET /api/v1/comments/:challengeId
 * @access  Public
 */
exports.getChallengeComments = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;
  const { page = 1, limit = 20, sort = '-createdAt', parentOnly = 'false' } = req.query;

  // التحقق من وجود المنافسة
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    return res.status(404).json({
      success: false,
      message: 'المنافسة غير موجودة'
    });
  }

  // بناء الاستعلام
  const query = {
    challenge: challengeId,
    isDeleted: false
  };

  // إذا أردنا التعليقات الرئيسية فقط (بدون ردود)
  if (parentOnly === 'true') {
    query.parentComment = null;
  }

  const skip = (page - 1) * limit;

  // جلب التعليقات
  const comments = await Comment.find(query)
    .populate('user', 'username avatar verified')
    .populate({
      path: 'parentComment',
      select: 'content user',
      populate: {
        path: 'user',
        select: 'username avatar'
      }
    })
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Comment.countDocuments(query);

  // إذا كانت تعليقات رئيسية، جلب بعض الردود لكل تعليق
  if (parentOnly === 'true') {
    for (let comment of comments) {
      if (comment.repliesCount > 0) {
        const replies = await Comment.find({
          parentComment: comment._id,
          isDeleted: false
        })
          .populate('user', 'username avatar verified')
          .sort('-likes')
          .limit(3);
        
        comment._doc.topReplies = replies;
      }
    }
  }

  res.status(200).json({
    success: true,
    count: comments.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: comments
  });
});

/**
 * @desc    الحصول على ردود تعليق
 * @route   GET /api/v1/comments/:commentId/replies
 * @access  Public
 */
exports.getCommentReplies = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // التحقق من وجود التعليق
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    return res.status(404).json({
      success: false,
      message: 'التعليق غير موجود'
    });
  }

  const skip = (page - 1) * limit;

  // جلب الردود
  const replies = await Comment.find({
    parentComment: commentId,
    isDeleted: false
  })
    .populate('user', 'username avatar verified')
    .sort('createdAt')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Comment.countDocuments({
    parentComment: commentId,
    isDeleted: false
  });

  res.status(200).json({
    success: true,
    count: replies.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: replies
  });
});

/**
 * @desc    الإعجاب بتعليق / إلغاء الإعجاب
 * @route   POST /api/v1/comments/:commentId/like
 * @access  Private
 */
exports.toggleLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'التعليق غير موجود'
    });
  }

  if (comment.isDeleted) {
    return res.status(400).json({
      success: false,
      message: 'التعليق محذوف'
    });
  }

  const likeIndex = comment.likes.indexOf(userId);
  let action = '';

  if (likeIndex > -1) {
    // إلغاء الإعجاب
    comment.likes.splice(likeIndex, 1);
    action = 'unliked';
  } else {
    // إضافة إعجاب
    comment.likes.push(userId);
    action = 'liked';
  }

  await comment.save();

  res.status(200).json({
    success: true,
    message: action === 'liked' ? 'تم الإعجاب بالتعليق' : 'تم إلغاء الإعجاب',
    data: {
      action,
      likesCount: comment.likes.length
    }
  });
});

/**
 * @desc    تعديل تعليق
 * @route   PUT /api/v1/comments/:commentId
 * @access  Private
 */
exports.updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'التعليق غير موجود'
    });
  }

  if (comment.isDeleted) {
    return res.status(400).json({
      success: false,
      message: 'التعليق محذوف'
    });
  }

  // التحقق من الصلاحية
  if (comment.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بتعديل هذا التعليق'
    });
  }

  // التحقق من وقت التعديل (مثلاً خلال 15 دقيقة)
  const timeDiff = Date.now() - comment.createdAt;
  const maxEditTime = 15 * 60 * 1000; // 15 دقيقة

  if (timeDiff > maxEditTime) {
    return res.status(400).json({
      success: false,
      message: 'انتهت مدة تعديل التعليق (15 دقيقة)'
    });
  }

  comment.content = content;
  comment.isEdited = true;
  await comment.save();

  await comment.populate('user', 'username avatar verified');

  res.status(200).json({
    success: true,
    message: 'تم تعديل التعليق بنجاح',
    data: comment
  });
});

/**
 * @desc    حذف تعليق
 * @route   DELETE /api/v1/comments/:commentId
 * @access  Private
 */
exports.deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === 'admin';

  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'التعليق غير موجود'
    });
  }

  // التحقق من الصلاحية
  if (comment.user.toString() !== userId.toString() && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بحذف هذا التعليق'
    });
  }

  // حذف منطقي (soft delete)
  comment.isDeleted = true;
  comment.content = '[تم حذف التعليق]';
  await comment.save();

  // تحديث عدد التعليقات في المنافسة
  await Challenge.findByIdAndUpdate(comment.challenge, {
    $inc: { 'stats.comments': -1 }
  });

  // إذا كان له تعليق أب، تقليل عدد الردود
  if (comment.parentComment) {
    await Comment.findByIdAndUpdate(comment.parentComment, {
      $inc: { repliesCount: -1 }
    });
  }

  res.status(200).json({
    success: true,
    message: 'تم حذف التعليق بنجاح'
  });
});

/**
 * @desc    الإبلاغ عن تعليق
 * @route   POST /api/v1/comments/:commentId/report
 * @access  Private
 */
exports.reportComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  const comment = await Comment.findById(commentId);
  
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'التعليق غير موجود'
    });
  }

  if (comment.isDeleted) {
    return res.status(400).json({
      success: false,
      message: 'التعليق محذوف بالفعل'
    });
  }

  // التحقق من عدم الإبلاغ سابقاً
  const alreadyReported = comment.reports.some(
    report => report.reporter.toString() === userId.toString()
  );

  if (alreadyReported) {
    return res.status(400).json({
      success: false,
      message: 'لقد قمت بالإبلاغ عن هذا التعليق مسبقاً'
    });
  }

  // إضافة البلاغ
  comment.reports.push({
    reporter: userId,
    reason,
    reportedAt: new Date()
  });

  await comment.save();

  // إذا تجاوز عدد البلاغات حد معين (مثلاً 5)، حذف تلقائي
  if (comment.reports.length >= 5) {
    comment.isDeleted = true;
    comment.content = '[تم حذف التعليق تلقائياً بسبب البلاغات]';
    await comment.save();
  }

  res.status(200).json({
    success: true,
    message: 'تم الإبلاغ عن التعليق بنجاح'
  });
});
