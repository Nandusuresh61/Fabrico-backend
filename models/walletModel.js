import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  type: {
    type: String,
    required: true,
    enum: ['credit', 'debit'],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
  },
  orderId: {
    type: String,
    
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed',
  },
});

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'USD',
    required: true,
  },
  transactions: [transactionSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for faster queries
walletSchema.index({ 'transactions.date': -1 });
// walletSchema.index({ userId: 1 });

// Method to add a new transaction
walletSchema.methods.addTransaction = async function(transaction) {
  this.transactions.push(transaction);
  
  // Update balance based on transaction type
  if (transaction.type === 'credit') {
    this.balance += transaction.amount;
  } else {
    this.balance -= transaction.amount;
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method to get recent transactions
walletSchema.methods.getRecentTransactions = function(limit = 5) {
  return this.transactions
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
};

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
