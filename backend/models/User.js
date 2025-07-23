const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpUsed: {
    type: Boolean,
    default: false
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  otpResendAfter: {
    type: Date,
    default: null
  },
  resetOtp: {
    type: String,
    default: null
  },
  resetOtpExpiry: {
    type: Date,
    default: null
  },
  resetOtpUsed: {
    type: Boolean,
    default: false
  },
  apiKeys: [{
    key: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  campaigns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaigns'
  }],
  // Dashboard Analytics - aggregated data for quick dashboard display
  dashboardAnalytics: {
    totalVisits: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    activeSessions: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
    
    // Proxy statistics
    totalProxies: { type: Number, default: 0 },
    activeProxies: { type: Number, default: 0 },
    
    // Campaign statistics
    totalCampaigns: { type: Number, default: 0 },
    activeCampaigns: { type: Number, default: 0 },
    completedCampaigns: { type: Number, default: 0 },
    
    // Traffic sources distribution (percentages)
    trafficSources: {
      organic: { type: Number, default: 0 },
      direct: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
      referral: { type: Number, default: 0 }
    },
    
    // Top performing campaign
    topCampaign: {
      name: { type: String, default: '' },
      visits: { type: Number, default: 0 },
      efficiency: { type: Number, default: 0 }
    },
    
    // Performance metrics
    totalEfficiency: { type: Number, default: 0 },
    
    // Last update timestamp
    lastUpdated: { type: Date, default: Date.now }
  },
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;