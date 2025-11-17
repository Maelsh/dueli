// ============================================
// FILE: controllers/auth.controller.js
// Authentication Controller - Complete
// ============================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../models');
const { encrypt, decrypt } = require('../config/encryption');
const { getAuthUrl, getTokensFromCode } = require('../config/youtube');
const logger = require('../config/logger');
const asyncHandler = require('../middleware/asyncHandler');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate JWT token
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role
 * @returns {string} - JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Send token in cookie
 * @param {object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {object} res - Express response object
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Generate token
  const token = generateToken(user._id, user.role);

  // Cookie options
  const options = {
    expires: new Date(
      Date.now() + (process.env.COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax'
  };

  // Prepare user data (without sensitive info)
  const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    language: user.language,
    country: user.country,
    youtubeLinked: user.youtubeLinked,
    youtubeChannelName: user.youtubeChannelName,
    followerCount: user.followerCount,
    reportCount: user.reportCount,
    overallRating: user.overallRating,
    totalEarnings: user.totalEarnings,
    totalChallenges: user.totalChallenges,
    createdAt: user.createdAt
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      data: {
        user: userData,
        token
      }
    });
};

// ============================================
// AUTHENTICATION CONTROLLERS
// ============================================

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { username, email, password, language, country } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    const field = existingUser.email === email ? 'Email' : 'Username';
    return res.status(409).json({
      success: false,
      error: {
        code: 'USER_EXISTS',
        message: `${field} already exists`,
        field: field.toLowerCase()
      }
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const user = await User.create({
    username,
    email,
    passwordHash,
    language: language || 'ar',
    country: country || 'EG'
  });

  logger.info(`New user registered: ${username} (${email})`);

  // Send token response
  sendTokenResponse(user, 201, res);
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Please provide email and password'
      }
    });
  }

  // Find user and include password
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    });
  }

  // Check if user is suspended
  if (user.isSuspended) {
    const message = user.suspendedUntil
      ? `Account suspended until ${user.suspendedUntil.toISOString()}. Reason: ${user.suspensionReason}`
      : `Account permanently suspended. Reason: ${user.suspensionReason}`;

    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message
      }
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  logger.info(`User logged in: ${user.username}`);

  // Send token response
  sendTokenResponse(user, 200, res);
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 1000),
    httpOnly: true
  });

  logger.info(`User logged out: ${req.user.username}`);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
        language: user.language,
        country: user.country,
        preferredCategories: user.preferredCategories,
        youtubeLinked: user.youtubeLinked,
        youtubeChannelName: user.youtubeChannelName,
        youtubeChannelId: user.youtubeChannelId,
        followerCount: user.followerCount,
        reportCount: user.reportCount,
        overallRating: user.overallRating,
        totalEarnings: user.totalEarnings,
        totalChallenges: user.totalChallenges,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/auth/update-profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowedFields = [
    'bio',
    'avatar',
    'preferredCategories',
    'language',
    'country'
  ];

  // Filter only allowed fields
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // Update user
  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    {
      new: true,
      runValidators: true
    }
  );

  logger.info(`User profile updated: ${user.username}`);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        language: user.language,
        country: user.country,
        preferredCategories: user.preferredCategories
      }
    }
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Please provide current and new password'
      }
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+passwordHash');

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect'
      }
    });
  }

  // Hash new password
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  logger.info(`Password changed for user: ${user.username}`);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// ============================================
// YOUTUBE OAUTH CONTROLLERS
// ============================================

/**
 * @desc    Initiate YouTube OAuth flow
 * @route   POST /api/v1/auth/youtube/connect
 * @access  Private
 */
exports.initiateYouTubeOAuth = asyncHandler(async (req, res, next) => {
  // Generate random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // Store state in session/cache (in production, use Redis)
  // For now, we'll include userId in state
  const stateData = JSON.stringify({
    userId: req.user._id.toString(),
    random: state
  });

  const encodedState = Buffer.from(stateData).toString('base64');

  // Generate OAuth URL
  const authUrl = getAuthUrl(encodedState);

  logger.info(`YouTube OAuth initiated for user: ${req.user.username}`);

  res.status(200).json({
    success: true,
    data: {
      authUrl,
      state: encodedState
    }
  });
});

/**
 * @desc    Handle YouTube OAuth callback
 * @route   GET /api/v1/auth/youtube/callback
 * @access  Public (but requires valid state)
 */
exports.handleYouTubeCallback = asyncHandler(async (req, res, next) => {
  const { code, state, error } = req.query;

  // Handle error from OAuth provider
  if (error) {
    logger.error(`YouTube OAuth error: ${error}`);
    return res.redirect(
      `${process.env.FRONTEND_URL}/settings?youtube_error=${error}`
    );
  }

  if (!code || !state) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/settings?youtube_error=missing_params`
    );
  }

  try {
    // Decode state
    const stateData = JSON.parse(
      Buffer.from(state, 'base64').toString('utf8')
    );

    const userId = stateData.userId;

    // Get tokens from code
    const tokens = await getTokensFromCode(code);

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Get YouTube channel info
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true
    });

    const channel = channelResponse.data.items[0];

    // Update user with YouTube info
    await User.findByIdAndUpdate(userId, {
      youtubeLinked: true,
      youtubeAccessToken: JSON.stringify(encryptedAccessToken),
      youtubeRefreshToken: JSON.stringify(encryptedRefreshToken),
      youtubeChannelId: channel.id,
      youtubeChannelName: channel.snippet.title
    });

    logger.info(`YouTube account linked for user ID: ${userId}`);

    // Redirect to frontend with success
    res.redirect(
      `${process.env.FRONTEND_URL}/settings?youtube_success=true`
    );
  } catch (error) {
    logger.error('Error handling YouTube callback:', error);
    res.redirect(
      `${process.env.FRONTEND_URL}/settings?youtube_error=auth_failed`
    );
  }
});

/**
 * @desc    Disconnect YouTube account
 * @route   DELETE /api/v1/auth/youtube/disconnect
 * @access  Private
 */
exports.disconnectYouTube = asyncHandler(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, {
    youtubeLinked: false,
    youtubeAccessToken: null,
    youtubeRefreshToken: null,
    youtubeChannelId: null,
    youtubeChannelName: null
  });

  logger.info(`YouTube account disconnected for user: ${req.user.username}`);

  res.status(200).json({
    success: true,
    message: 'YouTube account disconnected successfully'
  });
});

// ============================================
// PASSWORD RESET (Future Enhancement)
// ============================================

/**
 * @desc    Request password reset
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists or not
    return res.status(200).json({
      success: true,
      message: 'If the email exists, a reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Save to user (add these fields to User model in production)
  user.resetPasswordToken = resetTokenHash;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  // TODO: Send email with reset link
  // await sendEmail({
  //   email: user.email,
  //   subject: 'Password Reset Request',
  //   message: `Reset your password: ${resetUrl}`
  // });

  logger.info(`Password reset requested for: ${email}`);

  res.status(200).json({
    success: true,
    message: 'If the email exists, a reset link has been sent'
  });
});

/**
 * @desc    Reset password with token
 * @route   PUT /api/v1/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PASSWORD',
        message: 'Please provide new password'
      }
    });
  }

  // Hash token to compare with stored hash
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    resetPasswordToken: resetTokenHash,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token'
      }
    });
  }

  // Set new password
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  logger.info(`Password reset successful for user: ${user.username}`);

  // Send token response (log them in)
  sendTokenResponse(user, 200, res);
});

module.exports = exports;