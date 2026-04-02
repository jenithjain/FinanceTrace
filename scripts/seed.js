/**
 * Database Seed Script
 * Creates sample users and transactions for testing
 * 
 * Run with: node scripts/seed.js
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// ============================================
// Schema Definitions (inline for standalone script)
// ============================================

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  authProvider: { type: String, default: 'credentials' },
  role: { type: String, enum: ['viewer', 'analyst', 'admin'], default: 'viewer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

const TransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

// ============================================
// Seed Data
// ============================================

const CLI_ARGS = new Set(process.argv.slice(2));
const SHOULD_RESET = CLI_ARGS.has('--reset');
const FORCE_SEED_TRANSACTIONS = CLI_ARGS.has('--force-transactions');

const users = [
  {
    name: 'Admin User',
    email: 'admin@finance.com',
    password: 'Admin@123',
    role: 'admin',
    status: 'active'
  },
  {
    name: 'Analyst User',
    email: 'analyst@finance.com',
    password: 'Analyst@123',
    role: 'analyst',
    status: 'active'
  },
  {
    name: 'Viewer User',
    email: 'viewer@finance.com',
    password: 'Viewer@123',
    role: 'viewer',
    status: 'active'
  }
];

function getEndOfYesterday() {
  const now = new Date();
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  return endOfYesterday;
}

function daysAgoToDate(daysAgo) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

// Generate a small, realistic seed set capped at yesterday.
function generateTransactions(adminUserId, endDate) {
  const templates = [
    { daysAgo: 0, amount: 12694, type: 'income', category: 'Investment', notes: 'Investment returns' },
    { daysAgo: 1, amount: 315, type: 'expense', category: 'Food', notes: 'Groceries and dining' },
    { daysAgo: 3, amount: 1069, type: 'expense', category: 'Entertainment', notes: 'Movies and subscriptions' },
    { daysAgo: 4, amount: 2064, type: 'expense', category: 'Transportation', notes: 'Fuel and commute' },
    { daysAgo: 8, amount: 3984, type: 'expense', category: 'Food', notes: 'Groceries and dining' },
    { daysAgo: 10, amount: 3194, type: 'expense', category: 'Utilities', notes: 'Electricity, water, internet' },
    { daysAgo: 15, amount: 25000, type: 'expense', category: 'Rent', notes: 'Monthly rent payment' },
    { daysAgo: 18, amount: 77651, type: 'income', category: 'Salary', notes: 'Monthly salary credit' },
    { daysAgo: 29, amount: 2907, type: 'expense', category: 'Transportation', notes: 'Fuel and commute' },
    { daysAgo: 33, amount: 3064, type: 'expense', category: 'Food', notes: 'Groceries and dining' },
    { daysAgo: 41, amount: 1888, type: 'expense', category: 'Healthcare', notes: 'Pharmacy and clinic visit' },
    { daysAgo: 47, amount: 5420, type: 'income', category: 'Freelance', notes: 'Consulting payout' },
    { daysAgo: 56, amount: 2300, type: 'expense', category: 'Utilities', notes: 'Utility bill payment' },
    { daysAgo: 64, amount: 1499, type: 'expense', category: 'Education', notes: 'Professional course subscription' },
    { daysAgo: 73, amount: 6800, type: 'income', category: 'Bonus', notes: 'Performance bonus credit' },
    { daysAgo: 82, amount: 4200, type: 'expense', category: 'Shopping', notes: 'Household essentials' },
    { daysAgo: 90, amount: 3200, type: 'expense', category: 'Food', notes: 'Groceries and dining' }
  ];

  return templates
    .map((template) => ({
      ...template,
      date: daysAgoToDate(template.daysAgo),
      createdBy: adminUserId,
      isDeleted: false
    }))
    .filter((transaction) => transaction.date <= endDate)
    .sort((a, b) => a.date - b.date)
    .map(({ daysAgo, ...transaction }) => transaction);
}

// ============================================
// Main Seed Function
// ============================================

async function seed() {
  try {
    console.log('🌱 Starting database seed...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    if (SHOULD_RESET) {
      console.log('🗑️  Reset mode enabled: clearing all transactions...');
      await Transaction.deleteMany({});
      console.log('✅ Transactions cleared\n');
    } else {
      console.log('ℹ️  Non-destructive mode: existing transactions are preserved\n');
    }

    // Ensure users
    console.log('👤 Ensuring users...');
    const createdUsers = [];
    let createdUserCount = 0;
    let existingUserCount = 0;
    
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        existingUser.name = userData.name;
        existingUser.role = userData.role;
        existingUser.status = userData.status;
        existingUser.authProvider = 'credentials';
        await existingUser.save();

        createdUsers.push(existingUser);
        existingUserCount += 1;
        console.log(`   ♻️  Reused ${userData.role}: ${userData.email}`);
      } else {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const user = await User.create({
          ...userData,
          password: hashedPassword,
          authProvider: 'credentials'
        });
        createdUsers.push(user);
        createdUserCount += 1;
        console.log(`   ✅ Created ${userData.role}: ${userData.email}`);
      }
    }
    console.log('');

    // Get admin user for transaction creation
    const adminUser = createdUsers.find(u => u.role === 'admin');

    const existingTransactions = await Transaction.countDocuments({ isDeleted: false });
    const canSeedTransactions = SHOULD_RESET || FORCE_SEED_TRANSACTIONS || existingTransactions === 0;
    let transactions = [];

    if (canSeedTransactions) {
      console.log('💰 Creating sample transactions...');
      const seedEndDate = getEndOfYesterday();
      transactions = generateTransactions(adminUser._id, seedEndDate);

      if (transactions.length > 0) {
        await Transaction.insertMany(transactions);
      }

      console.log(`   ✅ Added ${transactions.length} sample transactions (up to ${seedEndDate.toDateString()})\n`);
    } else {
      console.log('ℹ️  Transactions already exist. Skipping sample transaction seed.');
      console.log('   Use --force-transactions to append sample data or --reset to rebuild from scratch.\n');
    }

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 SEED SUMMARY');
    console.log('═'.repeat(50));
    console.log(`\n👤 Users ensured: ${createdUsers.length}`);
    console.log(`   New users: ${createdUserCount}`);
    console.log(`   Existing users reused: ${existingUserCount}`);
    console.log('─'.repeat(50));
    
    for (const user of users) {
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    }

    const totalTransactionCount = await Transaction.countDocuments({ isDeleted: false });
    console.log(`💰 Transactions currently in DB: ${totalTransactionCount}`);
    console.log(`   Newly seeded in this run: ${transactions.length}`);
    console.log('─'.repeat(50));
    
    const incomeTotal = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    if (transactions.length > 0) {
      console.log(`   Seed Income Total: ₹${incomeTotal.toLocaleString()}`);
      console.log(`   Seed Expenses Total: ₹${expenseTotal.toLocaleString()}`);
      console.log(`   Seed Net Balance: ₹${(incomeTotal - expenseTotal).toLocaleString()}`);
    }
    
    console.log('\n═'.repeat(50));
    console.log('✅ Database seeded successfully!');
    console.log('═'.repeat(50));
    console.log('\nUsage tips:');
    console.log('  node scripts/seed.js                  # Safe mode (non-destructive)');
    console.log('  node scripts/seed.js --force-transactions  # Append sample transactions');
    console.log('  node scripts/seed.js --reset          # Clear transactions and reseed');

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run seed
seed();
