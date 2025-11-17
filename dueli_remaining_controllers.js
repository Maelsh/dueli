// ============================================
// FILE: controllers/rating.controller.js
// Rating Controller
// ============================================

const { Rating, Challenge } = require('../models');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Submit rating during live challenge
 * @route   POST /api/v1/ratings
 * @access  Private (registered viewers only)
 */
exports.submitRating = asyncHandler(async (req, res, next) => {
  const { challenge: challengeId, competitorRated, score } = req.body;

  // Get challenge
  const challenge = await Challenge.findById(challengeId);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  // Check if challenge is live
  if (challenge.status !== 'live') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NOT_LIVE',
        message: 'Can only rate during live challenges'
      }
    });
  }

  // Check if competitor is participant
  const isParticipant = 
    competitorRated === challenge.creator.toString() ||
    competitorRated === challenge.opponent.toString();

  if (!isParticipant) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_COMPETITOR',
        message: 'Competitor is not a participant in this challenge'
      }
    });
  }

  // Check if user already rated this competitor
  const existingRating = await Rating.findOne({
    challenge: challengeId,
    rater: req.user._id,
    competitorRated
  });

  if (existingRating) {
    // Update existing rating
    existingRating.score = score;
    existingRating.timestamp = new Date();
    await existingRating.save();
  } else {
    // Create new rating
    await Rating.create({
      challenge: challengeId,
      rater: req.user._id,
      competitorRated,
      score
    });
  }

  // Update challenge stats
  const creatorRatings = await Rating.find({
    challenge: challengeId,
    competitorRated: challenge.creator
  });

  const opponentRatings = await Rating.find({
    challenge: challengeId,
    competitorRated: challenge.opponent
  });

  challenge.creatorRatingSum = creatorRatings.reduce((sum, r) => sum + r.score, 0);
  challenge.creatorRatingCount = creatorRatings.length;
  challenge.opponentRatingSum = opponentRatings.reduce((sum, r) => sum + r.score, 0);
  challenge.opponentRatingCount = opponentRatings.length;
  challenge.totalRatings = creatorRatings.length + opponentRatings.length;
  await challenge.save();

  // Broadcast rating update via WebSocket
  const io = req.app.get('io');
  io.to(`challenge:${challengeId}`).emit('ratings_update', {
    challengeId,
    ratings: {
      creator: {
        totalScore: challenge.creatorRatingSum,
        count: challenge.creatorRatingCount,
        average: challenge.creatorRatingCount > 0 
          ? challenge.creatorRatingSum / challenge.creatorRatingCount 
          : 0
      },
      opponent: {
        totalScore: challenge.opponentRatingSum,
        count: challenge.opponentRatingCount,
        average: challenge.opponentRatingCount > 0
          ? challenge.opponentRatingSum / challenge.opponentRatingCount
          : 0
      }
    },
    timestamp: new Date()
  });

  logger.info(`Rating submitted: ${req.user.username} → ${score} stars`);

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: {
      rating: {
        challenge: challengeId,
        competitorRated,
        score,
        timestamp: new Date()
      },
      aggregated: {
        average: competitorRated === challenge.creator.toString()
          ? challenge.creatorRatingSum / challenge.creatorRatingCount
          : challenge.opponentRatingSum / challenge.opponentRatingCount,
        count: competitorRated === challenge.creator.toString()
          ? challenge.creatorRatingCount
          : challenge.opponentRatingCount
      }
    }
  });
});

/**
 * @desc    Get challenge ratings (aggregated)
 * @route   GET /api/v1/ratings/challenge/:id
 * @access  Public
 */
exports.getChallengeRatings = asyncHandler(async (req, res, next) => {
  const challenge = await Challenge.findById(req.params.id);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  const totalRatings = challenge.creatorRatingSum + challenge.opponentRatingSum;

  res.status(200).json({
    success: true,
    data: {
      ratings: {
        creator: {
          totalScore: challenge.creatorRatingSum,
          count: challenge.creatorRatingCount,
          average: challenge.creatorRatingCount > 0
            ? challenge.creatorRatingSum / challenge.creatorRatingCount
            : 0,
          percentage: totalRatings > 0
            ? (challenge.creatorRatingSum / totalRatings) * 100
            : 0
        },
        opponent: {
          totalScore: challenge.opponentRatingSum,
          count: challenge.opponentRatingCount,
          average: challenge.opponentRatingCount > 0
            ? challenge.opponentRatingSum / challenge.opponentRatingCount
            : 0,
          percentage: totalRatings > 0
            ? (challenge.opponentRatingSum / totalRatings) * 100
            : 0
        },
        totalRatings: challenge.totalRatings
      }
    }
  });
});

module.exports = exports;

// ============================================
// FILE: controllers/comment.controller.js
// Comment Controller
// ============================================

const { Comment, Challenge } = require('../models');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Post comment on challenge
 * @route   POST /api/v1/comments
 * @access  Private (registered users only)
 */
exports.postComment = asyncHandler(async (req, res, next) => {
  const { challenge: challengeId, content } = req.body;

  // Get challenge
  const challenge = await Challenge.findById(challengeId);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  // Can comment on live or completed challenges
  if (!['live', 'completed'].includes(challenge.status)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: 'Can only comment on live or completed challenges'
      }
    });
  }

  // Create comment
  const comment = await Comment.create({
    challenge: challengeId,
    author: req.user._id,
    content
  });

  await comment.populate('author', 'username avatar');

  // Update challenge comment count
  challenge.totalComments += 1;
  await challenge.save();

  // Broadcast comment via WebSocket
  const io = req.app.get('io');
  io.to(`challenge:${challengeId}`).emit('comment_added', {
    challengeId,
    comment: {
      id: comment._id,
      author: {
        id: comment.author._id,
        username: comment.author.username,
        avatar: comment.author.avatar
      },
      content: comment.content,
      timestamp: comment.timestamp
    },
    timestamp: new Date()
  });

  logger.info(`Comment posted: ${req.user.username} on challenge ${challengeId}`);

  res.status(201).json({
    success: true,
    message: 'Comment posted successfully',
    data: { comment }
  });
});

/**
 * @desc    Get challenge comments
 * @route   GET /api/v1/comments/challenge/:id
 * @access  Public
 */
exports.getChallengeComments = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 100);

  const comments = await Comment.find({
    challenge: req.params.id,
    isDeleted: false
  })
    .populate('author', 'username avatar')
    .sort('-timestamp')
    .skip(skip)
    .limit(maxLimit);

  const total = await Comment.countDocuments({
    challenge: req.params.id,
    isDeleted: false
  });

  res.status(200).json({
    success: true,
    data: {
      comments,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit)
      }
    }
  });
});

/**
 * @desc    Delete comment (soft delete)
 * @route   DELETE /api/v1/comments/:id
 * @access  Private (author or admin only)
 */
exports.deleteComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'COMMENT_NOT_FOUND',
        message: 'Comment not found'
      }
    });
  }

  // Check permission
  const isAuthor = comment.author.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You can only delete your own comments'
      }
    });
  }

  // Soft delete
  comment.isDeleted = true;
  await comment.save();

  logger.info(`Comment deleted: ${req.params.id}`);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully'
  });
});

module.exports = exports;

// ============================================
// FILE: controllers/message.controller.js
// Message Controller
// ============================================

const { Message, User } = require('../models');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get inbox messages
 * @route   GET /api/v1/messages
 * @access  Private
 */
exports.getInbox = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, unread } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  const query = {
    receiver: req.user._id,
    deletedByReceiver: false
  };

  if (unread === 'true') {
    query.read = false;
  }

  const messages = await Message.find(query)
    .populate('sender', 'username avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(maxLimit);

  const total = await Message.countDocuments(query);
  const unreadCount = await Message.countDocuments({
    receiver: req.user._id,
    read: false,
    deletedByReceiver: false
  });

  res.status(200).json({
    success: true,
    data: {
      messages,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit)
      },
      unreadCount
    }
  });
});

/**
 * @desc    Get sent messages
 * @route   GET /api/v1/messages/sent
 * @access  Private
 */
exports.getSentMessages = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  const messages = await Message.find({
    sender: req.user._id,
    deletedBySender: false
  })
    .populate('receiver', 'username avatar')
    .sort('-createdAt')
    .skip(skip)
    .limit(maxLimit);

  const total = await Message.countDocuments({
    sender: req.user._id,
    deletedBySender: false
  });

  res.status(200).json({
    success: true,
    data: {
      messages,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit)
      }
    }
  });
});

/**
 * @desc    Send message
 * @route   POST /api/v1/messages
 * @access  Private
 */
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { receiver: receiverId, subject, content } = req.body;

  // Check if receiver exists
  const receiver = await User.findById(receiverId);

  if (!receiver) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Receiver not found'
      }
    });
  }

  // Check if blocked (already handled by checkBlocked middleware)

  // Create message
  const message = await Message.create({
    sender: req.user._id,
    receiver: receiverId,
    subject: subject || 'No Subject',
    content
  });

  await message.populate(['sender', 'receiver'], 'username avatar');

  // Create notification
  const { Notification } = require('../models');
  await Notification.create({
    user: receiverId,
    type: 'new_message',
    content: `رسالة جديدة من ${req.user.username}`,
    link: '/messages',
    metadata: {
      userId: req.user._id
    }
  });

  logger.info(`Message sent: ${req.user.username} → ${receiver.username}`);

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { message }
  });
});

/**
 * @desc    Mark message as read
 * @route   PUT /api/v1/messages/:id/read
 * @access  Private (receiver only)
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found'
      }
    });
  }

  // Check if receiver
  if (message.receiver.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You can only mark your own messages as read'
      }
    });
  }

  message.read = true;
  message.readAt = new Date();
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Message marked as read'
  });
});

/**
 * @desc    Delete message (soft delete)
 * @route   DELETE /api/v1/messages/:id
 * @access  Private
 */
exports.deleteMessage = asyncHandler(async (req, res, next) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message not found'
      }
    });
  }

  // Check if sender or receiver
  const isSender = message.sender.toString() === req.user._id.toString();
  const isReceiver = message.receiver.toString() === req.user._id.toString();

  if (!isSender && !isReceiver) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You can only delete your own messages'
      }
    });
  }

  // Soft delete
  if (isSender) {
    message.deletedBySender = true;
  }
  if (isReceiver) {
    message.deletedByReceiver = true;
  }

  await message.save();

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully'
  });
});

module.exports = exports;