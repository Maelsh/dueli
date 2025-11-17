// ============================================
// FILE: scripts/generateEncryptionKey.js
// Generate AES-256 Encryption Key
// ============================================

const crypto = require('crypto');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║         DUELI PLATFORM - ENCRYPTION KEY GENERATOR         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Generate 32 bytes (256 bits) for AES-256
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('Your new AES-256 encryption key:');
console.log('═'.repeat(66));
console.log(encryptionKey);
console.log('═'.repeat(66));
console.log('\n⚠️  IMPORTANT:');
console.log('1. Copy this key to your .env file as ENCRYPTION_KEY');
console.log('2. Keep this key SECRET and NEVER commit it to git');
console.log('3. If you lose this key, you CANNOT decrypt existing data');
console.log('4. Use the same key across all server instances\n');

// Also generate JWT secret
const jwtSecret = crypto.randomBytes(64).toString('base64');

console.log('\nBonus: JWT Secret (also add to .env as JWT_SECRET):');
console.log('═'.repeat(66));
console.log(jwtSecret);
console.log('═'.repeat(66));
console.log('');

// ============================================
// FILE: scripts/createAdmin.js
// Create Admin User Script
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const adminEmail = process.argv[2] || 'admin@dueli.platform';
    const adminPassword = process.argv[3] || 'Admin@123456';

    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('❌ Admin user with this email already exists!');
      process.exit(1);
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    
    const admin = await User.create({
      username: 'admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      bio: 'Platform Administrator',
      language: 'en',
      country: 'US'
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('═'.repeat(50));
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('═'.repeat(50));
    console.log('\n⚠️  Please change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createAdmin();
}

module.exports = createAdmin;

// ============================================
// FILE: scripts/seedDatabase.js
// Seed Database with Test Data
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Challenge, Rating, Comment } = require('../models');
const bcrypt = require('bcrypt');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Challenge.deleteMany({});
    await Rating.deleteMany({});
    await Comment.deleteMany({});

    // Create test users
    console.log('Creating test users...');
    const passwordHash = await bcrypt.hash('Test@123', 10);

    const users = await User.create([
      {
        username: 'john_doe',
        email: 'john@test.com',
        passwordHash,
        bio: 'Science enthusiast and debater',
        language: 'en',
        country: 'US',
        preferredCategories: ['science', 'dialogue']
      },
      {
        username: 'jane_smith',
        email: 'jane@test.com',
        passwordHash,
        bio: 'Passionate about climate issues',
        language: 'en',
        country: 'US',
        preferredCategories: ['dialogue']
      },
      {
        username: 'ahmed_ali',
        email: 'ahmed@test.com',
        passwordHash,
        bio: 'مناقش في القضايا الدينية',
        language: 'ar',
        country: 'EG',
        preferredCategories: ['dialogue', 'science']
      },
      {
        username: 'maria_garcia',
        email: 'maria@test.com',
        passwordHash,
        bio: 'Talented singer and performer',
        language: 'es',
        country: 'ES',
        preferredCategories: ['talent']
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create test challenges
    console.log('Creating test challenges...');
    const challenges = await Challenge.create([
      {
        title: 'Climate Change: Fact or Fiction?',
        description: 'A debate on the reality and impact of climate change',
        category: 'dialogue',
        field: 'Environmental Issues',
        creator: users[0]._id,
        opponent: users[1]._id,
        status: 'completed',
        rules: {
          duration: 60,
          rounds: 3,
          roundDuration: 15,
          customRules: 'Cite scientific sources'
        },
        language: 'en',
        country: 'US',
        viewerCount: 250,
        peakViewers: 300,
        totalRevenue: 100,
        revenueDistribution: {
          platform: 20,
          creator: 40,
          opponent: 40
        },
        creatorRatingSum: 420,
        creatorRatingCount: 100,
        opponentRatingSum: 480,
        opponentRatingCount: 100,
        startedAt: new Date('2024-11-10T15:00:00Z'),
        endedAt: new Date('2024-11-10T16:00:00Z')
      },
      {
        title: 'Quantum Physics Explained',
        description: 'Discussion on quantum mechanics basics',
        category: 'science',
        field: 'Physics',
        creator: users[0]._id,
        opponent: users[2]._id,
        status: 'scheduled',
        rules: {
          duration: 90,
          rounds: 2,
          roundDuration: 30,
          customRules: 'Educational focus'
        },
        scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        language: 'en',
        country: 'US'
      },
      {
        title: 'Singing Competition',
        description: 'Show your vocal talents!',
        category: 'talent',
        field: 'Vocal Performance',
        creator: users[3]._id,
        status: 'pending',
        rules: {
          duration: 30,
          rounds: 1,
          customRules: 'Original songs only'
        },
        language: 'es',
        country: 'ES'
      }
    ]);

    console.log(`✅ Created ${challenges.length} challenges`);

    // Create follow relationships
    console.log('Creating social connections...');
    users[0].followers.push(users[1]._id, users[2]._id);
    users[0].following.push(users[1]._id);
    users[1].followers.push(users[0]._id);
    users[1].following.push(users[0]._id, users[2]._id);

    await Promise.all(users.map(u => u.save()));

    console.log('\n✅ Database seeded successfully!');
    console.log('═'.repeat(50));
    console.log('Test Users:');
    console.log('  - john@test.com / Test@123');
    console.log('  - jane@test.com / Test@123');
    console.log('  - ahmed@test.com / Test@123');
    console.log('  - maria@test.com / Test@123');
    console.log('═'.repeat(50));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;

// ============================================
// FILE: scripts/cleanup.js
// Database Cleanup Script
// ============================================

require('dotenv').config();
const mongoose = require('mongoose');
const {
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
} = require('../models');

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\n⚠️  WARNING: This will delete ALL data from the database!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Deleting data...');

    await User.deleteMany({});
    await Challenge.deleteMany({});
    await Rating.deleteMany({});
    await Comment.deleteMany({});
    await Report.deleteMany({});
    await Transaction.deleteMany({});
    await Advertisement.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});
    await ChallengeInvitation.deleteMany({});

    console.log('✅ All data deleted successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning database:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  cleanup();
}

module.exports = cleanup;