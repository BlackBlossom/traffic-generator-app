const mongoose = require('mongoose');

const SocialSchema = new mongoose.Schema({
  Facebook: { type: Boolean, required: true },
  Twitter: { type: Boolean, required: true },
  Instagram: { type: Boolean, required: true },
  LinkedIn: { type: Boolean, required: true }
}, { _id: false });

// Define the Cookie schema
const CookieSchema = new mongoose.Schema({
  name: {
    type: String,
    unique : true, // Ensure cookie names are unique per campaign
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    default: '/',
    trim: true
  },
  expires: {
    type: Number, // Unix timestamp in milliseconds
    default: null
  },
  httpOnly: {
    type: Boolean,
    default: false
  },
  secure: {
    type: Boolean,
    default: false
  },
  sameSite: {
    type: String,
    enum: ['Strict', 'Lax', 'None'],
    default: 'Lax'
  }
}, { _id: false }); // Disable _id for subdocuments


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
  startDate: {
    type: String, // YYYY-MM-DD format
    default: ''
  },
  endDate: {
    type: String, // YYYY-MM-DD format
    default: ''
  },
  startTime: {
    type: String, // HH:MM format
    default: ''
  },
  endTime: {
    type: String, // HH:MM format
    default: ''
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
    default: 'Desktop'
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
  // Add cookies array field
  cookies: {
    type: [CookieSchema],
    default: [],
    validate: {
      validator: function(cookies) {
        // Optional: Limit number of cookies per campaign
        return cookies.length <= 50;
      },
      message: 'Maximum 50 cookies allowed per campaign'
    }
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

// Virtual field to get start datetime as a proper Date object
CampaignSchema.virtual('startDateTime').get(function() {
  if (this.startDate && this.startTime) {
    return new Date(`${this.startDate}T${this.startTime}:00`);
  }
  return null;
});

// Virtual field to get end datetime as a proper Date object
CampaignSchema.virtual('endDateTime').get(function() {
  if (this.endDate && this.endTime) {
    return new Date(`${this.endDate}T${this.endTime}:00`);
  }
  return null;
});

// Instance method to check if campaign should be active now
CampaignSchema.methods.shouldBeActiveNow = function() {
  if (!this.scheduling) return this.isActive;
  
  const now = new Date();
  const startDateTime = this.startDateTime;
  const endDateTime = this.endDateTime;
  
  if (!startDateTime || !endDateTime) return false;
  
  return now >= startDateTime && now <= endDateTime;
};

// Instance method to get next scheduled start time
CampaignSchema.methods.getNextScheduledTime = function() {
  if (!this.scheduling || !this.startDateTime) return null;
  
  const now = new Date();
  if (this.startDateTime > now) {
    return this.startDateTime;
  }
  return null;
};

// Static method to find campaigns that should start now
CampaignSchema.statics.findCampaignsToStart = function() {
  const now = new Date();
  return this.find({
    scheduling: true,
    isActive: false,
    $expr: {
      $and: [
        { $ne: ['$startDate', ''] },
        { $ne: ['$startTime', ''] },
        { $lte: [{ $dateFromString: { dateString: { $concat: ['$startDate', 'T', '$startTime', ':00'] } } }, now] }
      ]
    }
  });
};

// Static method to find campaigns that should stop now
CampaignSchema.statics.findCampaignsToStop = function() {
  const now = new Date();
  return this.find({
    scheduling: true,
    isActive: true,
    $expr: {
      $and: [
        { $ne: ['$endDate', ''] },
        { $ne: ['$endTime', ''] },
        { $lte: [{ $dateFromString: { dateString: { $concat: ['$endDate', 'T', '$endTime', ':00'] } } }, now] }
      ]
    }
  });
};

module.exports = mongoose.model('Campaigns', CampaignSchema);
