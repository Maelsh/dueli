// ============================================
// DUELI PLATFORM - MONGOOSE MODELS
// Complete Database Schema for MongoDB
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============================================
// 1. USER MODEL
// ============================================
const userSchema = new mongoose.Schema({
  // Authentication
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 60
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  // Profile Information
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: '/default-avatar.png'
  },
  preferredCategories: [{
    type: String,
    enum: ['dialogue', 'science', 'talent']
  }],
  language: {
    type: String,
    default: 'ar',
    enum: ['ar', 'en', 'fr', 'es', 'de', 'tr', 'ur']
  },
  country: {
    type: String,
    default: 'EG',
    maxlength: 2
  },

  // YouTube Integration
  youtubeLinked: {
    type: Boolean,
    default: false
  },
  youtubeAccessToken: String, // Encrypted
  youtubeRefreshToken: String, // Encrypted
  youtubeChannelId: String,
  youtubeChannelName: String,

  // Financial Information (Encrypted)
  bankDetails: {
    accountNumber: String, // AES-256 encrypted
    accountNumberIV: String,
    accountNumberAuthTag: String,
    bankName: String,
    accountHolder: String,
    iban: String
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },

  // Transparency Stats
  followerCount: {
    type: Number,
    default: 0,
    min: 0
  },
  reportCount: {
    type: Number,
    default: 0,
    min: 0
  },
  overallRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalChallenges: {
    type: Number,
    default: 0,
    min: 0
  },

  // Social Connections
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: String,
  suspendedUntil: Date,
  lastLogin: Date,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ language: 1, country: 1 });
userSchema.index({ youtubeChannelId: 1 });

// Virtual for full profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/users/${this._id}`;
});

// Method: Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Pre-save hook: Hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

const User = mongoose.model('User', userSchema);

// ============================================
// 2. CHALLENGE MODEL
// ============================================
const challengeSchema = new mongoose.Schema({
  // Participants
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Classification
  category: {
    type: String,
    enum: ['dialogue', 'science', 'talent'],
    required: [true, 'Category is required']
  },
  field: {
    type: String,
    required: [true, 'Field is required'],
    maxlength: 100
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },

  // Rules & Settings
  rules: {
    duration: {
      type: Number,
      min: 5,
      max: 300,
      default: 60
    },
    rounds: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    roundDuration: {
      type: Number,
      min: 1,
      max: 60
    },
    customRules: {
      type: String,
      maxlength: 2000
    }
  },

  // Scheduling
  scheduledTime: {
    type: Date,
    index: true
  },
  startedAt: Date,
  endedAt: Date,
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'live', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // YouTube Streaming
  creatorYoutubeUrl: String,
  opponentYoutubeUrl: String,
  creatorStreamKey: String,
  opponentStreamKey: String,
  creatorBroadcastId: String,
  opponentBroadcastId: String,

  // Financial Data
  advertisements: [{
    adId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Advertisement'
    },
    displayTime: Date,
    displayDuration: Number,
    status: {
      type: String,
      enum: ['pending', 'displayed', 'rejected'],
      default: 'pending'
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: String
  }],
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  revenueDistribution: {
    platform: {
      type: Number,
      default: 0
    },
    creator: {
      type: Number,
      default: 0
    },
    opponent: {
      type: Number,
      default: 0
    }
  },

  // Statistics
  viewerCount: {
    type: Number,
    default: 0,
    min: 0
  },
  peakViewers: {
    type: Number,
    default: 0,
    min: 0
  },
  totalComments: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRatings: {
    type: Number,
    default: 0,
    min: 0
  },

  // Rating Summary
  creatorRatingSum: {
    type: Number,
    default: 0
  },
  opponentRatingSum: {
    type: Number,
    default: 0
  },
  creatorRatingCount: {
    type: Number,
    default: 0
  },
  opponentRatingCount: {
    type: Number,
    default: 0
  },

  // Localization
  language: {
    type: String,
    default: 'ar',
    index: true
  },
  country: {
    type: String,
    default: 'EG',
    index: true
  },

  // Moderation
  isReported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Compound indexes for queries
challengeSchema.index({ status: 1, scheduledTime: 1 });
challengeSchema.index({ category: 1, field: 1 });
challengeSchema.index({ creator: 1, status: 1 });
challengeSchema.index({ opponent: 1, status: 1 });
challengeSchema.index({ language: 1, country: 1, status: 1 });
challengeSchema.index({ createdAt: -1 });

// Virtual: Average creator rating
challengeSchema.virtual('creatorAvgRating').get(function() {
  return this.creatorRatingCount > 0 
    ? this.creatorRatingSum / this.creatorRatingCount 
    : 0;
});

// Virtual: Average opponent rating
challengeSchema.virtual('opponentAvgRating').get(function() {
  return this.opponentRatingCount > 0 
    ? this.opponentRatingSum / this.opponentRatingCount 
    : 0;
});

const Challenge = mongoose.model('Challenge', challengeSchema);

// ============================================
// 3. RATING MODEL
// ============================================
const ratingSchema = new mongoose.Schema({
  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true
  },
  rater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  competitorRated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Compound indexes for aggregation
ratingSchema.index({ challenge: 1, competitorRated: 1 });
ratingSchema.index({ challenge: 1, timestamp: 1 });
ratingSchema.index({ rater: 1, challenge: 1, competitorRated: 1 }, { unique: true });

const Rating = mongoose.model('Rating', ratingSchema);

// ============================================
// 4. COMMENT MODEL
// ============================================
const commentSchema = new mongoose.Schema({
  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [500, 'Comment cannot exceed 500 characters'],
    trim: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Indexes
commentSchema.index({ challenge: 1, timestamp: -1 });
commentSchema.index({ author: 1, timestamp: -1 });

const Comment = mongoose.model('Comment', commentSchema);

// ============================================
// 5. REPORT MODEL
// ============================================
const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reportedChallenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge'
  },
  reportedComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },

  // Report Details
  reason: {
    type: String,
    enum: ['offensive', 'fraud', 'misconduct', 'misleading', 'rules_violation', 'spam', 'harassment', 'other'],
    required: true
  },
  description: {
    type: String,
    required: [true, 'Report description is required'],
    maxlength: 1000
  },
  evidence: {
    type: String,
    maxlength: 500
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending',
    index: true
  },

  // Admin Action
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminAction: {
    type: String,
    enum: ['none', 'warn', 'suspend', 'ban', 'delete_content', 'cancel_challenge']
  },
  actionReason: {
    type: String,
    maxlength: 1000
  },
  actionDate: Date,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ reviewedBy: 1 });

const Report = mongoose.model('Report', reportSchema);

// ============================================
// 6. TRANSACTION MODEL
// ============================================
const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true
  },

  // Amount Details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED']
  },

  // Transaction Type
  type: {
    type: String,
    enum: ['challenge_earning', 'withdrawal', 'refund', 'bonus'],
    default: 'challenge_earning'
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Payment Details
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'stripe', 'manual']
  },
  paymentDate: Date,
  paymentReference: String,

  // Metadata
  metadata: {
    ratingPercentage: Number,
    totalChallengeRevenue: Number,
    competitorRole: {
      type: String,
      enum: ['creator', 'opponent']
    }
  },

  // Notes
  notes: {
    type: String,
    maxlength: 500
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ invoiceNumber: 1 });

// Pre-save: Generate invoice number
transactionSchema.pre('save', function(next) {
  if (!this.invoiceNumber && this.type === 'challenge_earning') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    this.invoiceNumber = `INV-${timestamp}-${random}`;
  }
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// ============================================
// 7. ADVERTISEMENT MODEL
// ============================================
const advertisementSchema = new mongoose.Schema({
  advertiser: {
    type: String,
    required: [true, 'Advertiser name is required'],
    maxlength: 200
  },
  advertiserContact: {
    email: String,
    phone: String
  },

  // Content
  content: {
    type: {
      type: String,
      enum: ['video', 'image', 'text'],
      required: true
    },
    url: String,
    text: String,
    thumbnailUrl: String
  },

  // Financial
  paidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  calculatedDuration: {
    type: Number,
    required: true,
    min: 5
  },

  // Assignment
  assignedChallenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    index: true
  },
  displayTime: Date,

  // Status
  status: {
    type: String,
    enum: ['pending', 'assigned', 'displayed', 'rejected', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Rejection Info
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  rejectionDate: Date,

  // Admin Info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
}, {
  timestamps: true
});

// Indexes
advertisementSchema.index({ status: 1 });
advertisementSchema.index({ assignedChallenge: 1 });
advertisementSchema.index({ createdAt: -1 });

const Advertisement = mongoose.model('Advertisement', advertisementSchema);

// ============================================
// 8. MESSAGE MODEL
// ============================================
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Content
  subject: {
    type: String,
    maxlength: 200,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: 2000,
    trim: true
  },

  // Status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,

  // Soft Delete
  deletedBySender: {
    type: Boolean,
    default: false
  },
  deletedByReceiver: {
    type: Boolean,
    default: false
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Compound indexes
messageSchema.index({ receiver: 1, read: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

// ============================================
// 9. NOTIFICATION MODEL
// ============================================
const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type & Content
  type: {
    type: String,
    enum: [
      'challenge_invite',
      'invite_accepted',
      'invite_rejected',
      'challenge_starting',
      'challenge_completed',
      'new_comment',
      'new_follower',
      'new_message',
      'earnings_received',
      'admin_action',
      'report_update',
      'system_announcement'
    ],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  link: {
    type: String,
    maxlength: 200
  },

  // Status
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,

  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Metadata
  metadata: {
    challengeId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    amount: Number,
    reportId: mongoose.Schema.Types.ObjectId
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

// Indexes
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

// ============================================
// 10. CHALLENGE INVITATION MODEL
// ============================================
const challengeInvitationSchema = new mongoose.Schema({
  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true
  },
  inviter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
    index: true
  },

  // Message
  message: {
    type: String,
    maxlength: 500
  },

  // Response
  responseMessage: {
    type: String,
    maxlength: 500
  },
  respondedAt: Date,

  // Expiry
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Indexes
challengeInvitationSchema.index({ challenge: 1, invitee: 1 }, { unique: true });
challengeInvitationSchema.index({ invitee: 1, status: 1 });

const ChallengeInvitation = mongoose.model('ChallengeInvitation', challengeInvitationSchema);

// ============================================
// EXPORT ALL MODELS
// ============================================
module.exports = {
  User,
  Challenge,
  Rating,
  Comment,
  Report,
  Transaction,
  Advertisement,
  Message,
  Notification,
  ChallengeInvitation
};