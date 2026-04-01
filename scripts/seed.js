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

// Generate transactions for the current year
function generateTransactions(adminUserId) {
  const currentYear = new Date().getFullYear();
  const transactions = [];

  const incomeCategories = ['Salary', 'Freelance', 'Investment', 'Bonus', 'Refund'];
  const expenseCategories = ['Food', 'Rent', 'Utilities', 'Healthcare', 'Transportation', 'Entertainment', 'Shopping', 'Education'];

  // Generate monthly salary income
  for (let month = 0; month < 12; month++) {
    transactions.push({
      amount: 75000 + Math.floor(Math.random() * 5000),
      type: 'income',
      category: 'Salary',
      date: new Date(currentYear, month, 1),
      notes: `Salary for ${new Date(currentYear, month).toLocaleString('default', { month: 'long' })}`,
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate random freelance income (6 entries)
  for (let i = 0; i < 6; i++) {
    const month = Math.floor(Math.random() * 12);
    transactions.push({
      amount: 10000 + Math.floor(Math.random() * 20000),
      type: 'income',
      category: 'Freelance',
      date: new Date(currentYear, month, Math.floor(Math.random() * 28) + 1),
      notes: `Freelance project ${i + 1}`,
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate investment returns (4 entries)
  for (let i = 0; i < 4; i++) {
    const month = (i * 3) + 2; // Quarterly
    transactions.push({
      amount: 5000 + Math.floor(Math.random() * 10000),
      type: 'income',
      category: 'Investment',
      date: new Date(currentYear, month, 15),
      notes: `Q${i + 1} investment returns`,
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate monthly rent expense
  for (let month = 0; month < 12; month++) {
    transactions.push({
      amount: 25000,
      type: 'expense',
      category: 'Rent',
      date: new Date(currentYear, month, 5),
      notes: `Rent for ${new Date(currentYear, month).toLocaleString('default', { month: 'long' })}`,
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate monthly utilities
  for (let month = 0; month < 12; month++) {
    transactions.push({
      amount: 3000 + Math.floor(Math.random() * 2000),
      type: 'expense',
      category: 'Utilities',
      date: new Date(currentYear, month, 10),
      notes: 'Electricity, Water, Internet',
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate food expenses (2-3 per month)
  for (let month = 0; month < 12; month++) {
    const foodCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < foodCount; i++) {
      transactions.push({
        amount: 2000 + Math.floor(Math.random() * 3000),
        type: 'expense',
        category: 'Food',
        date: new Date(currentYear, month, Math.floor(Math.random() * 28) + 1),
        notes: 'Groceries and dining',
        createdBy: adminUserId,
        isDeleted: false
      });
    }
  }

  // Generate transportation expenses
  for (let month = 0; month < 12; month++) {
    transactions.push({
      amount: 2000 + Math.floor(Math.random() * 1500),
      type: 'expense',
      category: 'Transportation',
      date: new Date(currentYear, month, 20),
      notes: 'Fuel and commute',
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate healthcare expenses (quarterly)
  for (let i = 0; i < 4; i++) {
    transactions.push({
      amount: 1500 + Math.floor(Math.random() * 3000),
      type: 'expense',
      category: 'Healthcare',
      date: new Date(currentYear, i * 3, 15),
      notes: 'Medical checkup and medicines',
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate entertainment expenses
  for (let month = 0; month < 12; month++) {
    transactions.push({
      amount: 1000 + Math.floor(Math.random() * 2000),
      type: 'expense',
      category: 'Entertainment',
      date: new Date(currentYear, month, Math.floor(Math.random() * 28) + 1),
      notes: 'Movies, subscriptions, outings',
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  // Generate shopping expenses (random)
  for (let i = 0; i < 8; i++) {
    const month = Math.floor(Math.random() * 12);
    transactions.push({
      amount: 3000 + Math.floor(Math.random() * 7000),
      type: 'expense',
      category: 'Shopping',
      date: new Date(currentYear, month, Math.floor(Math.random() * 28) + 1),
      notes: 'Clothing and accessories',
      createdBy: adminUserId,
      isDeleted: false
    });
  }

  return transactions;
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

    // Clear existing data (optional - comment out to append)
    console.log('🗑️  Clearing existing finance data...');
    await User.deleteMany({ email: { $in: users.map(u => u.email) } });
    await Transaction.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // Create users
    console.log('👤 Creating users...');
    const createdUsers = [];
    
    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await User.create({
        ...userData,
        password: hashedPassword
      });
      createdUsers.push(user);
      console.log(`   ✅ Created ${userData.role}: ${userData.email}`);
    }
    console.log('');

    // Get admin user for transaction creation
    const adminUser = createdUsers.find(u => u.role === 'admin');

    // Create transactions
    console.log('💰 Creating transactions...');
    const transactions = generateTransactions(adminUser._id);
    await Transaction.insertMany(transactions);
    console.log(`   ✅ Created ${transactions.length} transactions\n`);

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 SEED SUMMARY');
    console.log('═'.repeat(50));
    console.log(`\n👤 Users Created: ${createdUsers.length}`);
    console.log('─'.repeat(50));
    
    for (const user of users) {
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    }

    console.log(`💰 Transactions Created: ${transactions.length}`);
    console.log('─'.repeat(50));
    
    const incomeTotal = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    console.log(`   Total Income: ₹${incomeTotal.toLocaleString()}`);
    console.log(`   Total Expenses: ₹${expenseTotal.toLocaleString()}`);
    console.log(`   Net Balance: ₹${(incomeTotal - expenseTotal).toLocaleString()}`);
    
    console.log('\n═'.repeat(50));
    console.log('✅ Database seeded successfully!');
    console.log('═'.repeat(50));

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
