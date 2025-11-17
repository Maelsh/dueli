// controllers/message.controller.js

const Message = require('../models/Message');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    إرسال رسالة
 * @route   POST /api/v1/messages
 * @access  Private
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const { receiver, content, attachments } = req.body;
  const senderId = req.user._id;

  // التحقق من عدم إرسال رسالة للنفس
  if (receiver.toString() === senderId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'لا يمكنك إرسال رسالة لنفسك'
    });
  }

  // التحقق من وجود المستقبل
  const receiverUser = await User.findById(receiver);
  if (!receiverUser) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم المستقبل غير موجود'
    });
  }

  // التحقق من عدم وجود حظر
  if (receiverUser.blockedUsers.includes(senderId)) {
    return res.status(403).json({
      success: false,
      message: 'لا يمكنك إرسال رسائل لهذا المستخدم'
    });
  }

  const sender = await User.findById(senderId);
  if (sender.blockedUsers.includes(receiver)) {
    return res.status(403).json({
      success: false,
      message: 'لا يمكنك إرسال رسائل لمستخدم محظور'
    });
  }

  // إنشاء الرسالة
  const message = await Message.create({
    sender: senderId,
    receiver,
    content,
    attachments: attachments || []
  });

  // تحميل معلومات المرسل والمستقبل
  await message.populate([
    { path: 'sender', select: 'username avatar' },
    { path: 'receiver', select: 'username avatar' }
  ]);

  // إرسال إشعار عبر WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${receiver}`).emit('new_message', {
      message: {
        _id: message._id,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'تم إرسال الرسالة بنجاح',
    data: message
  });
});

/**
 * @desc    الحصول على المحادثات
 * @route   GET /api/v1/messages/conversations
 * @access  Private
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  // جلب آخر رسالة مع كل مستخدم
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: userId },
          { receiver: userId }
        ],
        isDeleted: false
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$sender', userId] },
            '$receiver',
            '$sender'
          ]
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiver', userId] },
                  { $eq: ['$read', false] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    },
    {
      $skip: (page - 1) * limit
    },
    {
      $limit: parseInt(limit)
    }
  ]);

  // تحميل معلومات المستخدمين
  const conversationsWithUsers = await Promise.all(
    conversations.map(async (conv) => {
      const otherUser = await User.findById(conv._id).select('username avatar verified status');
      return {
        user: otherUser,
        lastMessage: {
          _id: conv.lastMessage._id,
          content: conv.lastMessage.content,
          sender: conv.lastMessage.sender,
          receiver: conv.lastMessage.receiver,
          read: conv.lastMessage.read,
          createdAt: conv.lastMessage.createdAt
        },
        unreadCount: conv.unreadCount
      };
    })
  );

  // حساب إجمالي عدد المحادثات
  const totalConversations = await Message.aggregate([
    {
      $match: {
        $or: [
          { sender: userId },
          { receiver: userId }
        ],
        isDeleted: false
      }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$sender', userId] },
            '$receiver',
            '$sender'
          ]
        }
      }
    },
    {
      $count: 'total'
    }
  ]);

  const total = totalConversations[0]?.total || 0;

  res.status(200).json({
    success: true,
    count: conversationsWithUsers.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: conversationsWithUsers
  });
});

/**
 * @desc    الحصول على رسائل محادثة
 * @route   GET /api/v1/messages/:userId
 * @access  Private
 */
exports.getConversationMessages = asyncHandler(async (req, res) => {
  const { userId: otherUserId } = req.params;
  const currentUserId = req.user._id;
  const { page = 1, limit = 50 } = req.query;

  // التحقق من وجود المستخدم
  const otherUser = await User.findById(otherUserId);
  if (!otherUser) {
    return res.status(404).json({
      success: false,
      message: 'المستخدم غير موجود'
    });
  }

  const skip = (page - 1) * limit;

  // جلب الرسائل
  const messages = await Message.find({
    $or: [
      { sender: currentUserId, receiver: otherUserId },
      { sender: otherUserId, receiver: currentUserId }
    ],
    isDeleted: false
  })
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .populate('sender', 'username avatar')
    .populate('receiver', 'username avatar');

  const total = await Message.countDocuments({
    $or: [
      { sender: currentUserId, receiver: otherUserId },
      { sender: otherUserId, receiver: currentUserId }
    ],
    isDeleted: false
  });

  // عكس ترتيب الرسائل لتكون الأقدم أولاً
  messages.reverse();

  // وضع علامة "مقروء" على جميع الرسائل الواردة غير المقروءة
  await Message.updateMany(
    {
      sender: otherUserId,
      receiver: currentUserId,
      read: false
    },
    {
      $set: { read: true, readAt: new Date() }
    }
  );

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: messages
  });
});

/**
 * @desc    وضع علامة مقروء على رسالة
 * @route   PUT /api/v1/messages/:messageId/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'الرسالة غير موجودة'
    });
  }

  // التحقق من أن المستخدم هو المستقبل
  if (message.receiver.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بتحديث هذه الرسالة'
    });
  }

  if (message.read) {
    return res.status(200).json({
      success: true,
      message: 'الرسالة مقروءة بالفعل'
    });
  }

  message.read = true;
  message.readAt = new Date();
  await message.save();

  // إرسال إشعار للمرسل
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${message.sender}`).emit('message_read', {
      messageId: message._id,
      readAt: message.readAt
    });
  }

  res.status(200).json({
    success: true,
    message: 'تم وضع علامة مقروء بنجاح',
    data: message
  });
});

/**
 * @desc    حذف رسالة
 * @route   DELETE /api/v1/messages/:messageId
 * @access  Private
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  
  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'الرسالة غير موجودة'
    });
  }

  // التحقق من أن المستخدم هو المرسل أو المستقبل
  if (
    message.sender.toString() !== userId.toString() &&
    message.receiver.toString() !== userId.toString()
  ) {
    return res.status(403).json({
      success: false,
      message: 'غير مصرح لك بحذف هذه الرسالة'
    });
  }

  // حذف منطقي
  message.isDeleted = true;
  await message.save();

  res.status(200).json({
    success: true,
    message: 'تم حذف الرسالة بنجاح'
  });
});

/**
 * @desc    حذف محادثة كاملة
 * @route   DELETE /api/v1/messages/conversation/:userId
 * @access  Private
 */
exports.deleteConversation = asyncHandler(async (req, res) => {
  const { userId: otherUserId } = req.params;
  const currentUserId = req.user._id;

  // حذف جميع الرسائل بين المستخدمين
  const result = await Message.updateMany(
    {
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    },
    {
      $set: { isDeleted: true }
    }
  );

  res.status(200).json({
    success: true,
    message: 'تم حذف المحادثة بنجاح',
    deletedCount: result.modifiedCount
  });
});

/**
 * @desc    البحث في الرسائل
 * @route   GET /api/v1/messages/search
 * @access  Private
 */
exports.searchMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { query, page = 1, limit = 20 } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن يكون البحث 2 حرف على الأقل'
    });
  }

  const skip = (page - 1) * limit;

  // البحث في محتوى الرسائل
  const messages = await Message.find({
    $or: [
      { sender: userId },
      { receiver: userId }
    ],
    content: { $regex: query, $options: 'i' },
    isDeleted: false
  })
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .populate('sender', 'username avatar')
    .populate('receiver', 'username avatar');

  const total = await Message.countDocuments({
    $or: [
      { sender: userId },
      { receiver: userId }
    ],
    content: { $regex: query, $options: 'i' },
    isDeleted: false
  });

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: messages
  });
});

/**
 * @desc    الحصول على عدد الرسائل غير المقروءة
 * @route   GET /api/v1/messages/unread/count
 * @access  Private
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const unreadCount = await Message.countDocuments({
    receiver: userId,
    read: false,
    isDeleted: false
  });

  res.status(200).json({
    success: true,
    data: {
      unreadCount
    }
  });
});
