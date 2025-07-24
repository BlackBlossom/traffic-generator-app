const mongoose = require('mongoose');

const SocialSchema = new mongoose.Schema({
  Facebook: { type: Boolean, required: true },
  Twitter: { type: Boolean, required: true },
  Instagram: { type: Boolean, required: true },
  LinkedIn: { type: Boolean, required: true }
}, { _id: false });

const CampaignSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  visitDuration: {
    type: Number,
    min: 1,
    default: null // Keep for backward compatibility
  },
  visitDurationMin: {
    type: Number,
    required: true,
    min: 5,
    default: 20
  },
  visitDurationMax: {
    type: Number,
    required: true,
    min: 5,
    default: 40
  },
  delay: {
    type: Number,
    required: true,
    min: 0
  },
  bounceRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  concurrent: {
    type: Number,
    required: true,
    min: 1
  },
  totalSessions: {
    type: Number,
    min: 0, // Allow 0 for unlimited sessions
    default: null // null means unlimited sessions
  },
  scrolling: {
    type: Boolean,
    required: true
  },
  quality: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  priority: {
    type: Number,
    required: true,
    min: 1
  },
  organic: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  headfulPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  desktopPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 70
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Campaign scheduling
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'running', 'completed', 'paused', 'cancelled', 'error', 'expired', 'scheduled'],
    default: 'pending'
  },
  
  // Legacy scheduling fields (keep for backward compatibility)
  scheduling: {
    type: Boolean,
    required: true
  },
  startTime: {
    type: String,
    default: ''
    // Optionally, use Date type if always ISO 8601
    // type: Date
  },
  endTime: {
    type: String,
    default: ''
    // Optionally, use Date type if always ISO 8601
    // type: Date
  },
  social: {
    type: SocialSchema,
    required: true
  },
  custom: {
    type: String,
    default: ''
  },
  geo: {
    type: String,
    required: true
  },
  device: {
    type: String,
    enum: ['Desktop', 'Mobile'],
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  adSelectors: {
    type: String,
    default: ''
  },
  adsXPath: {
    type: String,
    default: ''
  },
  // Campaign Analytics - stored permanently in DB
  analytics: {
    totalSessions: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 }, // Includes bounced sessions
    bouncedSessions: { type: Number, default: 0 },
    erroredSessions: { type: Number, default: 0 }, // Failed/incomplete sessions
    activeSessions: { type: Number, default: 0 }, // Currently running sessions
    totalDuration: { type: Number, default: 0 }, // Sum of all session durations
    avgDuration: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 }, // bouncedSessions/completedSessions * 100
    efficiency: { type: Number, default: 0 }, // completedSessions / totalSessions * 100
    
    // Traffic Sources
    sources: {
      organic: { type: Number, default: 0 },
      direct: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
      referral: { type: Number, default: 0 }
    },
    
    // Device breakdown
    devices: {
      mobile: { type: Number, default: 0 },
      desktop: { type: Number, default: 0 }
    },
    
    // Specific referrers used (stored as object to avoid Map key restrictions)
    referrers: {
      type: Object,
      default: {}
    },
    
    // Campaign status tracking
    startedAt: Date,
    completedAt: Date,
    lastUpdated: { type: Date, default: Date.now }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campaigns', CampaignSchema);
