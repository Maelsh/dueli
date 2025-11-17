// ============================================
// FILE: controllers/user.controller.js
// User Controller - Complete
// ============================================

const { User, Challenge, Transaction } = require('../models');
const { encrypt, decrypt } = require('../config/encryption');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

// ============================================
// USER PROFILE CONTROLLERS
// ============================================

/**
 * @desc    Get user profile (public)
 * @route   GET /api/v1/users/:id
 * @access  Public (but more details if authenticated)
 */
exports.getUserProfile = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;

  // Try to find by ID or username
  const user = await User.findOne({
    $or: [{ _id: userId }, { username: userId }]
  }).select('-passwordHash -youtubeAccessToken -youtubeRefreshToken -bankDetails');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  // Check if current user is following this user
  let isFollowing = false;
  let isBlocked = false;

  if (req.user) {
    isFollowing = req.user.following.includes(user._id);
    isBlocked = req.user.blockedUsers.includes(user._id) || 
                user.blockedUsers.includes(req.user._id);
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        bio: user.bio,
        avatar: user.avatar,
        language: user.language,
        country: user.country,
        preferredCategories: user.preferredCategories,
        followerCount: user.followerCount,
        reportCount: user.reportCount,
        overallRating: user.overallRating,
        totalChallenges: user.totalChallenges,
        youtubeLinked: user.youtubeLinked,
        youtubeChannelName: user.youtubeChannelName,
        createdAt: user.createdAt,
        isFollowing,
        isBlocked
      }
    }
  });
});

/**
 * @desc    Get user's challenges
 * @route   GET /api/v1/users/:id/challenges
 * @access  Public
 */
exports.getUserChallenges = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const { status, page = 1, limit = 10 } = req.query;

  // Build query
  const query = {
    $or: [{ creator: userId }, { opponent: userId }]
  };

  if (status) {
    query.status = status;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  // Get challenges
  const challenges = await Challenge.find(query)
    .populate('creator', 'username avatar overallRating')
    .populate('opponent', 'username avatar overallRating')
    .sort('-createdAt')
    .skip(skip)
    .limit(maxLimit);

  // Get total count
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

// ============================================
// FOLLOW/UNFOLLOW CONTROLLERS
// ============================================

/**
 * @desc    Follow a user
 * @route   POST /api/v1/users/:id/follow
 * @access  Private
 */
exports.followUser = asyncHandler(async (req, res, next) => {
  const userToFollowId = req.params.id;
  const currentUserId = req.user._id;

  // Check if trying to follow self
  if (userToFollowId === currentUserId.toString()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_FOLLOW_SELF',
        message: 'You cannot follow yourself'
      }
    });
  }

  // Get user to follow
  const userToFollow = await User.findById(userToFollowId);

  if (!userToFollow) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  // Check if already following
  if (req.user.following.includes(userToFollowId)) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_FOLLOWING',
        message: 'You are already following this user'
      }
    });
  }

  // Add to following
  req.user.following.push(userToFollowId);
  await req.user.save();

  // Add to followers
  userToFollow.followers.push(currentUserId);
  userToFollow.followerCount = userToFollow.followers.length;
  await userToFollow.save();

  logger.info(`${req.user.username} followed ${userToFollow.username}`);

  res.status(200).json({
    success: true,
    message: 'User followed successfully',
    data: {
      following: true,
      followerCount: userToFollow.followerCount
    }
  });
});

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/v1/users/:id/follow
 * @access  Private
 */
exports.unfollowUser = asyncHandler(async (req, res, next) => {
  const userToUnfollowId = req.params.id;
  const currentUserId = req.user._id;

  // Get user to unfollow
  const userToUnfollow = await User.findById(userToUnfollowId);

  if (!userToUnfollow) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  // Check if not following
  if (!req.user.following.includes(userToUnfollowId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NOT_FOLLOWING',
        message: 'You are not following this user'
      }
    });
  }

  // Remove from following
  req.user.following = req.user.following.filter(
    id => id.toString() !== userToUnfollowId
  );
  await req.user.save();

  // Remove from followers
  userToUnfollow.followers = userToUnfollow.followers.filter(
    id => id.toString() !== currentUserId.toString()
  );
  userToUnfollow.followerCount = userToUnfollow.followers.length;
  await userToUnfollow.save();

  logger.info(`${req.user.username} unfollowed ${userToUnfollow.username}`);

  res.status(200).json({
    success: true,
    message: 'User unfollowed successfully',
    data: {
      following: false,
      followerCount: userToUnfollow.followerCount
    }
  });
});

// ============================================
// BLOCK/UNBLOCK CONTROLLERS
// ============================================

/**
 * @desc    Block a user
 * @route   POST /api/v1/users/:id/block
 * @access  Private
 */
exports.blockUser = asyncHandler(async (req, res, next) => {
  const userToBlockId = req.params.id;
  const currentUserId = req.user._id;

  // Check if trying to block self
  if (userToBlockId === currentUserId.toString()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_BLOCK_SELF',
        message: 'You cannot block yourself'
      }
    });
  }

  // Get user to block
  const userToBlock = await User.findById(userToBlockId);

  if (!userToBlock) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  // Check if already blocked
  if (req.user.blockedUsers.includes(userToBlockId)) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_BLOCKED',
        message: 'User is already blocked'
      }
    });
  }

  // Add to blocked list
  req.user.blockedUsers.push(userToBlockId);
  
  // Auto-unfollow
  req.user.following = req.user.following.filter(
    id => id.toString() !== userToBlockId
  );

  await req.user.save();

  // Remove from their followers
  userToBlock.followers = userToBlock.followers.filter(
    id => id.toString() !== currentUserId.toString()
  );
  userToBlock.followerCount = userToBlock.followers.length;
  await userToBlock.save();

  logger.info(`${req.user.username} blocked ${userToBlock.username}`);

  res.status(200).json({
    success: true,
    message: 'User blocked successfully'
  });
});

/**
 * @desc    Unblock a user
 * @route   DELETE /api/v1/users/:id/block
 * @access  Private
 */
exports.unblockUser = asyncHandler(async (req, res, next) => {
  const userToUnblockId = req.params.id;

  // Check if blocked
  if (!req.user.blockedUsers.includes(userToUnblockId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NOT_BLOCKED',
        message: 'User is not blocked'
      }
    });
  }

  // Remove from blocked list
  req.user.blockedUsers = req.user.blockedUsers.filter(
    id => id.toString() !== userToUnblockId
  );
  await req.user.save();

  logger.info(`${req.user.username} unblocked user ${userToUnblockId}`);

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully'
  });
});

/**
 * @desc    Get blocked users list
 * @route   GET /api/v1/users/blocked
 * @access  Private
 */
exports.getBlockedUsers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate('blockedUsers', 'username avatar');

  res.status(200).json({
    success: true,
    data: {
      blockedUsers: user.blockedUsers
    }
  });
});

// ============================================
// EARNINGS CONTROLLERS
// ============================================

/**
 * @desc    Get user earnings history
 * @route   GET /api/v1/users/:id/earnings
 * @access  Private (own profile only)
 */
exports.getUserEarnings = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;

  // Only allow users to see their own earnings
  if (userId !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You can only view your own earnings'
      }
    });
  }

  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  // Get transactions
  const transactions = await Transaction.find({ user: userId })
    .populate('challenge', 'title category')
    .sort('-createdAt')
    .skip(skip)
    .limit(maxLimit);

  // Get total
  const total = await Transaction.countDocuments({ user: userId });

  // Get user for total earnings
  const user = await User.findById(userId);

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: user.totalEarnings,
      transactions,
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
 * @desc    Update bank details
 * @route   PUT /api/v1/users/bank-details
 * @access  Private
 */
exports.updateBankDetails = asyncHandler(async (req, res, next) => {
  const { accountNumber, bankName, accountHolder, iban } = req.body;

  if (!accountNumber || !bankName || !accountHolder) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Please provide all required bank details'
      }
    });
  }

  // Encrypt account number
  const encryptedAccountNumber = encrypt(accountNumber);

  // Update user
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      bankDetails: {
        accountNumber: encryptedAccountNumber.encryptedData,
        accountNumberIV: encryptedAccountNumber.iv,
        accountNumberAuthTag: encryptedAccountNumber.authTag,
        bankName,
        accountHolder,
        iban: iban || ''
      }
    },
    { new: true }
  );

  logger.info(`Bank details updated for user: ${user.username}`);

  res.status(200).json({
    success: true,
    message: 'Bank details updated successfully (encrypted)'
  });
});

/**
 * @desc    Get own bank details (decrypted)
 * @route   GET /api/v1/users/bank-details
 * @access  Private
 */
exports.getBankDetails = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user.bankDetails || !user.bankDetails.accountNumber) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NO_BANK_DETAILS',
        message: 'No bank details found'
      }
    });
  }

  // Decrypt account number
  let decryptedAccountNumber;
  try {
    decryptedAccountNumber = decrypt({
      encryptedData: user.bankDetails.accountNumber,
      iv: user.bankDetails.accountNumberIV,
      authTag: user.bankDetails.accountNumberAuthTag
    });
  } catch (error) {
    logger.error('Error decrypting account number:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DECRYPTION_ERROR',
        message: 'Error retrieving bank details'
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      bankDetails: {
        accountNumber: decryptedAccountNumber,
        bankName: user.bankDetails.bankName,
        accountHolder: user.bankDetails.accountHolder,
        iban: user.bankDetails.iban
      }
    }
  });
});

// ============================================
// SEARCH CONTROLLERS
// ============================================

/**
 * @desc    Search users
 * @route   GET /api/v1/users/search
 * @access  Public
 */
exports.searchUsers = asyncHandler(async (req, res, next) => {
  const { q, language, country, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_QUERY',
        message: 'Search query must be at least 2 characters'
      }
    });
  }

  // Build query
  const query = {
    $or: [
      { username: { $regex: q, $options: 'i' } },
      { bio: { $regex: q, $options: 'i' } }
    ],
    isSuspended: false
  };

  if (language) {
    query.language = language;
  }

  if (country) {
    query.country = country;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const maxLimit = Math.min(parseInt(limit), 50);

  // Search
  const users = await User.find(query)
    .select('username avatar bio language country followerCount overallRating totalChallenges')
    .sort('-followerCount')
    .skip(skip)
    .limit(maxLimit);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    data: {
      users,
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
 * @desc    Get followers list
 * @route   GET /api/v1/users/:id/followers
 * @access  Public
 */
exports.getFollowers = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const { page = 1, limit = 20 } = req.query;

  const user = await User.findById(userId)
    .populate({
      path: 'followers',
      select: 'username avatar bio overallRating',
      options: {
        skip: (parseInt(page) - 1) * parseInt(limit),
        limit: Math.min(parseInt(limit), 50)
      }
    });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      followers: user.followers,
      total: user.followerCount
    }
  });
});

/**
 * @desc    Get following list
 * @route   GET /api/v1/users/:id/following
 * @access  Public
 */
exports.getFollowing = asyncHandler(async (req, res, next) => {
  const userId = req.params.id;
  const { page = 1, limit = 20 } = req.query;

  const user = await User.findById(userId)
    .populate({
      path: 'following',
      select: 'username avatar bio overallRating',
      options: {
        skip: (parseInt(page) - 1) * parseInt(limit),
        limit: Math.min(parseInt(limit), 50)
      }
    });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      following: user.following,
      total: user.following.length
    }
  });
});

module.exports = exports;