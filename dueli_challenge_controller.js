// ============================================
// FILE: controllers/challenge.controller.js
// Challenge Controller - Complete
// ============================================

const { Challenge, User, Rating, Comment, ChallengeInvitation, Transaction, Advertisement, Notification } = require('../models');
const { getYouTubeService, createLiveBroadcast } = require('../config/youtube');
const { decrypt } = require('../config/encryption');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

// ============================================
// LIST & SEARCH CHALLENGES
// ============================================

/**
 * @desc    List challenges with filters
 * @route   GET /api/v1/challenges
 * @access  Public
 */
exports.listChallenges = asyncHandler(async (req, res, next) => {
  const {
    status,
    category,
    field,
    language,
    country,
    search,
    page = 1,
    limit = 20,
    sort = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query = {};

  if (status) query.status = status;
  if (category) query.category = category;
  if (field) query.field = { $regex: field, $options: 'i' };
  if (language) query.language = language;
  if (country) query.country = country;
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  // Sort
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj = { [sort]: sortOrder };

  // Get challenges
  const challenges = await Challenge.find(query)
    .populate('creator', 'username avatar overallRating')
    .populate('opponent', 'username avatar overallRating')
    .sort(sortObj)
    .skip(skip)
    .limit(maxLimit);

  const total = await Challenge.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      challenges,
      pagination: {
        page: parseInt(page),
        limit: maxLimit,
        total,
        pages: Math.ceil(total / maxLimit),
        hasNext: skip + maxLimit < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * @desc    Get challenge details
 * @route   GET /api/v1/challenges/:id
 * @access  Public
 */
exports.getChallengeDetails = asyncHandler(async (req, res, next) => {
  const challenge = await Challenge.findById(req.params.id)
    .populate('creator', 'username avatar bio overallRating followerCount')
    .populate('opponent', 'username avatar bio overallRating followerCount');

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  res.status(200).json({
    success: true,
    data: { challenge }
  });
});

// ============================================
// CREATE & UPDATE CHALLENGES
// ============================================

/**
 * @desc    Create new challenge
 * @route   POST /api/v1/challenges
 * @access  Private
 */
exports.createChallenge = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    category,
    field,
    rules,
    scheduledTime,
    language,
    country
  } = req.body;

  // Validate scheduled time
  if (scheduledTime && new Date(scheduledTime) < new Date()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_SCHEDULE',
        message: 'Scheduled time must be in the future'
      }
    });
  }

  // Create challenge
  const challenge = await Challenge.create({
    title,
    description,
    category,
    field,
    rules,
    scheduledTime: scheduledTime || null,
    language: language || req.user.language,
    country: country || req.user.country,
    creator: req.user._id,
    status: scheduledTime ? 'scheduled' : 'pending'
  });

  await challenge.populate('creator', 'username avatar overallRating');

  logger.info(`Challenge created: ${title} by ${req.user.username}`);

  res.status(201).json({
    success: true,
    message: 'Challenge created successfully',
    data: { challenge }
  });
});

/**
 * @desc    Update challenge
 * @route   PUT /api/v1/challenges/:id
 * @access  Private (creator only)
 */
exports.updateChallenge = asyncHandler(async (req, res, next) => {
  let challenge = await Challenge.findById(req.params.id);

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  // Check ownership
  if (challenge.creator.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_CREATOR',
        message: 'Only the creator can update this challenge'
      }
    });
  }

  // Check if already started
  if (['live', 'completed'].includes(challenge.status)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_UPDATE',
        message: 'Cannot update a challenge that has started or completed'
      }
    });
  }

  // Update allowed fields
  const allowedFields = ['title', 'description', 'rules', 'scheduledTime'];
  const updates = {};
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  challenge = await Challenge.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  ).populate('creator', 'username avatar');

  logger.info(`Challenge updated: ${challenge.title}`);

  res.status(200).json({
    success: true,
    message: 'Challenge updated successfully',
    data: { challenge }
  });
});

/**
 * @desc    Cancel challenge
 * @route   DELETE /api/v1/challenges/:id
 * @access  Private (creator or admin)
 */
exports.cancelChallenge = asyncHandler(async (req, res, next) => {
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

  // Check permission
  const isCreator = challenge.creator.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isCreator && !isAdmin) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the creator or admin can cancel this challenge'
      }
    });
  }

  // Can't cancel if already completed
  if (challenge.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_CANCEL',
        message: 'Cannot cancel a completed challenge'
      }
    });
  }

  challenge.status = 'cancelled';
  await challenge.save();

  logger.info(`Challenge cancelled: ${challenge.title}`);

  res.status(200).json({
    success: true,
    message: 'Challenge cancelled successfully'
  });
});

// ============================================
// JOIN & INVITATION MANAGEMENT
// ============================================

/**
 * @desc    Request to join challenge
 * @route   POST /api/v1/challenges/:id/join
 * @access  Private
 */
exports.requestToJoin = asyncHandler(async (req, res, next) => {
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

  // Check if creator
  if (challenge.creator.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_JOIN_OWN',
        message: 'You cannot join your own challenge'
      }
    });
  }

  // Check if challenge is pending
  if (challenge.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS',
        message: 'Challenge is not open for joining'
      }
    });
  }

  // Check if already has opponent
  if (challenge.opponent) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ALREADY_HAS_OPPONENT',
        message: 'Challenge already has an opponent'
      }
    });
  }

  // Check for existing invitation
  const existingInvitation = await ChallengeInvitation.findOne({
    challenge: challenge._id,
    invitee: req.user._id,
    status: 'pending'
  });

  if (existingInvitation) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_REQUESTED',
        message: 'You have already requested to join this challenge'
      }
    });
  }

  // Create invitation
  const invitation = await ChallengeInvitation.create({
    challenge: challenge._id,
    inviter: req.user._id,
    invitee: challenge.creator,
    message: req.body.message || '',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });

  // Notify creator
  await Notification.create({
    user: challenge.creator,
    type: 'challenge_invite',
    content: `${req.user.username} طلب الانضمام لمنافستك: ${challenge.title}`,
    link: `/challenges/${challenge._id}`,
    metadata: {
      challengeId: challenge._id,
      userId: req.user._id
    }
  });

  logger.info(`Join request: ${req.user.username} → Challenge ${challenge.title}`);

  res.status(201).json({
    success: true,
    message: 'Join request sent successfully',
    data: { invitation }
  });
});

/**
 * @desc    Accept/Reject join request
 * @route   PUT /api/v1/challenges/:id/accept/:userId
 * @access  Private (creator only)
 */
exports.acceptRejectJoinRequest = asyncHandler(async (req, res, next) => {
  const { id: challengeId, userId } = req.params;
  const { action, message } = req.body;

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ACTION',
        message: 'Action must be either accept or reject'
      }
    });
  }

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

  // Check ownership
  if (challenge.creator.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_CREATOR',
        message: 'Only the creator can accept/reject requests'
      }
    });
  }

  // Find invitation
  const invitation = await ChallengeInvitation.findOne({
    challenge: challengeId,
    inviter: userId,
    status: 'pending'
  });

  if (!invitation) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'INVITATION_NOT_FOUND',
        message: 'Join request not found'
      }
    });
  }

  if (action === 'accept') {
    // Set opponent
    challenge.opponent = userId;
    challenge.status = challenge.scheduledTime ? 'scheduled' : 'pending';
    await challenge.save();

    invitation.status = 'accepted';
    invitation.responseMessage = message || '';
    invitation.respondedAt = new Date();
    await invitation.save();

    // Notify inviter
    await Notification.create({
      user: userId,
      type: 'invite_accepted',
      content: `${req.user.username} قبل طلبك للانضمام للمنافسة: ${challenge.title}`,
      link: `/challenges/${challengeId}`,
      metadata: { challengeId: challenge._id }
    });

    logger.info(`Join accepted: ${challenge.title}`);

    await challenge.populate(['creator', 'opponent']);

    res.status(200).json({
      success: true,
      message: 'Opponent accepted successfully',
      data: { challenge }
    });

  } else {
    // Reject
    invitation.status = 'rejected';
    invitation.responseMessage = message || '';
    invitation.respondedAt = new Date();
    await invitation.save();

    // Notify inviter
    await Notification.create({
      user: userId,
      type: 'invite_rejected',
      content: `${req.user.username} رفض طلبك للانضمام للمنافسة: ${challenge.title}`,
      link: `/challenges/${challengeId}`,
      metadata: { challengeId: challenge._id }
    });

    logger.info(`Join rejected: ${challenge.title}`);

    res.status(200).json({
      success: true,
      message: 'Join request rejected'
    });
  }
});

// ============================================
// START & END CHALLENGE (LIVE)
// ============================================

/**
 * @desc    Start live challenge
 * @route   POST /api/v1/challenges/:id/start
 * @access  Private (participants only)
 */
exports.startChallenge = asyncHandler(async (req, res, next) => {
  const challenge = await Challenge.findById(req.params.id)
    .populate('creator')
    .populate('opponent');

  if (!challenge) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found'
      }
    });
  }

  // Check if user is participant
  const isParticipant = 
    challenge.creator._id.toString() === req.user._id.toString() ||
    (challenge.opponent && challenge.opponent._id.toString() === req.user._id.toString());

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_PARTICIPANT',
        message: 'Only participants can start the challenge'
      }
    });
  }

  // Check if ready to start
  if (!challenge.opponent) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_OPPONENT',
        message: 'Challenge needs an opponent to start'
      }
    });
  }

  if (challenge.status === 'live') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ALREADY_LIVE',
        message: 'Challenge is already live'
      }
    });
  }

  if (challenge.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ALREADY_COMPLETED',
        message: 'Challenge is already completed'
      }
    });
  }

  // Check YouTube linking
  if (!challenge.creator.youtubeLinked || !challenge.opponent.youtubeLinked) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'YOUTUBE_NOT_LINKED',
        message: 'Both participants must link their YouTube accounts'
      }
    });
  }

  try {
    // Create YouTube live broadcasts for both participants
    const creatorTokens = {
      access_token: decrypt(JSON.parse(challenge.creator.youtubeAccessToken)),
      refresh_token: decrypt(JSON.parse(challenge.creator.youtubeRefreshToken))
    };

    const opponentTokens = {
      access_token: decrypt(JSON.parse(challenge.opponent.youtubeAccessToken)),
      refresh_token: decrypt(JSON.parse(challenge.opponent.youtubeRefreshToken))
    };

    const creatorYoutube = getYouTubeService(creatorTokens.access_token, creatorTokens.refresh_token);
    const opponentYoutube = getYouTubeService(opponentTokens.access_token, opponentTokens.refresh_token);

    const broadcastData = {
      title: challenge.title,
      description: challenge.description,
      scheduledStartTime: new Date()
    };

    const [creatorBroadcast, opponentBroadcast] = await Promise.all([
      createLiveBroadcast(creatorYoutube, broadcastData),
      createLiveBroadcast(opponentYoutube, broadcastData)
    ]);

    // Update challenge
    challenge.status = 'live';
    challenge.startedAt = new Date();
    challenge.creatorYoutubeUrl = creatorBroadcast.embedUrl;
    challenge.opponentYoutubeUrl = opponentBroadcast.embedUrl;
    challenge.creatorStreamKey = creatorBroadcast.streamKey;
    challenge.opponentStreamKey = opponentBroadcast.streamKey;
    challenge.creatorBroadcastId = creatorBroadcast.broadcastId;
    challenge.opponentBroadcastId = opponentBroadcast.broadcastId;
    await challenge.save();

    // Notify followers
    const io = req.app.get('io');
    io.to(`challenge:${challenge._id}`).emit('challenge_status_changed', {
      challengeId: challenge._id,
      status: 'live',
      message: 'Challenge has started!',
      timestamp: new Date()
    });

    logger.info(`Challenge started: ${challenge.title}`);

    res.status(200).json({
      success: true,
      message: 'Challenge started successfully',
      data: {
        challenge: {
          id: challenge._id,
          status: challenge.status,
          startedAt: challenge.startedAt,
          creatorYoutubeUrl: challenge.creatorYoutubeUrl,
          opponentYoutubeUrl: challenge.opponentYoutubeUrl,
          creatorStreamKey: challenge.creatorStreamKey,
          opponentStreamKey: challenge.opponentStreamKey
        }
      }
    });

  } catch (error) {
    logger.error('Error starting challenge:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'YOUTUBE_API_ERROR',
        message: 'Failed to start YouTube broadcast'
      }
    });
  }
});

/**
 * @desc    End challenge and calculate revenue
 * @route   POST /api/v1/challenges/:id/end
 * @access  Private (participants only)
 */
exports.endChallenge = asyncHandler(async (req, res, next) => {
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

  // Check if user is participant
  const isParticipant = 
    challenge.creator.toString() === req.user._id.toString() ||
    (challenge.opponent && challenge.opponent.toString() === req.user._id.toString());

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_PARTICIPANT',
        message: 'Only participants can end the challenge'
      }
    });
  }

  if (challenge.status !== 'live') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NOT_LIVE',
        message: 'Challenge is not currently live'
      }
    });
  }

  // Calculate revenue
  const displayedAds = challenge.advertisements.filter(ad => ad.status === 'displayed');
  const totalRevenue = displayedAds.reduce((sum, ad) => {
    const adDoc = await Advertisement.findById(ad.adId);
    return sum + (adDoc ? adDoc.paidAmount : 0);
  }, 0);

  const platformShare = totalRevenue * 0.20;
  const competitorsShare = totalRevenue * 0.80;

  // Get ratings
  const creatorRatings = await Rating.find({
    challenge: challenge._id,
    competitorRated: challenge.creator
  });

  const opponentRatings = await Rating.find({
    challenge: challenge._id,
    competitorRated: challenge.opponent
  });

  const creatorTotalScore = creatorRatings.reduce((sum, r) => sum + r.score, 0);
  const opponentTotalScore = opponentRatings.reduce((sum, r) => sum + r.score, 0);
  const totalScore = creatorTotalScore + opponentTotalScore;

  let creatorRevenue = 0;
  let opponentRevenue = 0;

  if (totalScore > 0) {
    const creatorPercentage = (creatorTotalScore / totalScore) * 100;
    const opponentPercentage = (opponentTotalScore / totalScore) * 100;

    creatorRevenue = competitorsShare * (creatorPercentage / 100);
    opponentRevenue = competitorsShare * (opponentPercentage / 100);
  } else {
    // Equal split if no ratings
    creatorRevenue = competitorsShare / 2;
    opponentRevenue = competitorsShare / 2;
  }

  // Update challenge
  challenge.status = 'completed';
  challenge.endedAt = new Date();
  challenge.totalRevenue = totalRevenue;
  challenge.revenueDistribution = {
    platform: platformShare,
    creator: creatorRevenue,
    opponent: opponentRevenue
  };
  await challenge.save();

  // Create transactions
  const transactions = [];

  if (creatorRevenue > 0) {
    const creatorTransaction = await Transaction.create({
      user: challenge.creator,
      challenge: challenge._id,
      amount: creatorRevenue,
      type: 'challenge_earning',
      status: 'pending',
      metadata: {
        ratingPercentage: totalScore > 0 ? (creatorTotalScore / totalScore) * 100 : 50,
        totalChallengeRevenue: totalRevenue,
        competitorRole: 'creator'
      }
    });
    transactions.push(creatorTransaction);

    // Update user earnings
    await User.findByIdAndUpdate(challenge.creator, {
      $inc: { totalEarnings: creatorRevenue, totalChallenges: 1 }
    });
  }

  if (opponentRevenue > 0) {
    const opponentTransaction = await Transaction.create({
      user: challenge.opponent,
      challenge: challenge._id,
      amount: opponentRevenue,
      type: 'challenge_earning',
      status: 'pending',
      metadata: {
        ratingPercentage: totalScore > 0 ? (opponentTotalScore / totalScore) * 100 : 50,
        totalChallengeRevenue: totalRevenue,
        competitorRole: 'opponent'
      }
    });
    transactions.push(opponentTransaction);

    // Update user earnings
    await User.findByIdAndUpdate(challenge.opponent, {
      $inc: { totalEarnings: opponentRevenue, totalChallenges: 1 }
    });
  }

  // Notify via WebSocket
  const io = req.app.get('io');
  io.to(`challenge:${challenge._id}`).emit('challenge_status_changed', {
    challengeId: challenge._id,
    status: 'completed',
    message: 'Challenge has ended!',
    timestamp: new Date()
  });

  logger.info(`Challenge ended: ${challenge.title}, Revenue: $${totalRevenue}`);

  res.status(200).json({
    success: true,
    message: 'Challenge ended successfully',
    data: {
      challenge: {
        status: challenge.status,
        endedAt: challenge.endedAt,
        totalRevenue: challenge.totalRevenue,
        revenueDistribution: challenge.revenueDistribution,
        creatorAvgRating: creatorRatings.length > 0 ? creatorTotalScore / creatorRatings.length : 0,
        opponentAvgRating: opponentRatings.length > 0 ? opponentTotalScore / opponentRatings.length : 0
      },
      transactions
    }
  });
});

// ============================================
// ADVERTISEMENT MANAGEMENT
// ============================================

/**
 * @desc    Reject advertisement
 * @route   POST /api/v1/challenges/:id/reject-ad/:adId
 * @access  Private (participants only)
 */
exports.rejectAdvertisement = asyncHandler(async (req, res, next) => {
  const { id: challengeId, adId } = req.params;
  const { reason } = req.body;

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

  // Check if user is participant
  const isParticipant = 
    challenge.creator.toString() === req.user._id.toString() ||
    (challenge.opponent && challenge.opponent.toString() === req.user._id.toString());

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'NOT_PARTICIPANT',
        message: 'Only participants can reject advertisements'
      }
    });
  }

  // Find ad in challenge
  const adIndex = challenge.advertisements.findIndex(
    ad => ad.adId.toString() === adId
  );

  if (adIndex === -1) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'AD_NOT_FOUND',
        message: 'Advertisement not found in this challenge'
      }
    });
  }

  // Update ad status
  challenge.advertisements[adIndex].status = 'rejected';
  challenge.advertisements[adIndex].rejectedBy = req.user._id;
  challenge.advertisements[adIndex].rejectionReason = reason || 'Conflicts with principles';
  await challenge.save();

  // Update advertisement document
  await Advertisement.findByIdAndUpdate(adId, {
    status: 'rejected',
    rejectedBy: req.user._id,
    rejectionReason: reason,
    rejectionDate: new Date()
  });

  // Notify via WebSocket
  const io = req.app.get('io');
  io.to(`challenge:${challengeId}`).emit('ad_rejected', {
    challengeId,
    adId,
    rejectedBy: req.user.username,
    reason: reason || 'Conflicts with principles',
    timestamp: new Date()
  });

  logger.info(`Ad rejected in challenge ${challengeId} by ${req.user.username}`);

  res.status(200).json({
    success: true,
    message: 'Advertisement rejected successfully',
    data: {
      advertisement: challenge.advertisements[adIndex]
    }
  });
});

// ============================================
// GET RATINGS & COMMENTS
// ============================================

/**
 * @desc    Get challenge ratings (aggregated)
 * @route   GET /api/v1/challenges/:id/ratings
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
          percentage: challenge.totalRatings > 0
            ? (challenge.creatorRatingSum / (challenge.creatorRatingSum + challenge.opponentRatingSum)) * 100
            : 0
        },
        opponent: {
          totalScore: challenge.opponentRatingSum,
          count: challenge.opponentRatingCount,
          average: challenge.opponentRatingCount > 0
            ? challenge.opponentRatingSum / challenge.opponentRatingCount
            : 0,
          percentage: challenge.totalRatings > 0
            ? (challenge.opponentRatingSum / (challenge.creatorRatingSum + challenge.opponentRatingSum)) * 100
            : 0
        },
        totalRatings: challenge.totalRatings
      }
    }
  });
});

/**
 * @desc    Get challenge comments
 * @route   GET /api/v1/challenges/:id/comments
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

module.exports = exports;