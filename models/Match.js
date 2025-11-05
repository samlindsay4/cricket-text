const mongoose = require('mongoose');

const inningsSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  battingTeam: { type: String, required: true },
  bowlingTeam: { type: String, required: true },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  overs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  extras: {
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 }
  },
  batsmen: [{ type: mongoose.Schema.Types.Mixed }],
  bowlers: [{ type: mongoose.Schema.Types.Mixed }],
  ballsArray: [{ type: mongoose.Schema.Types.Mixed }]
}, { _id: false });

const matchSchema = new mongoose.Schema({
  // External API reference
  externalId: {
    type: String,
    index: true,
    sparse: true
  },
  
  // Basic match information
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  teamA: { type: String, required: true },
  teamB: { type: String, required: true },
  
  // Match details
  format: {
    type: String,
    enum: ['Test', 'ODI', 'T20I', 'T20', 'Other'],
    default: 'Other',
    index: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'completed'],
    default: 'upcoming',
    index: true
  },
  
  // Venue and time
  venue: String,
  date: { type: Date, index: true },
  series: String,
  
  // Toss information
  tossWinner: String,
  tossDecision: String,
  
  // Match result
  result: String,
  winner: String,
  
  // Innings data
  innings: [inningsSchema],
  
  // Commentary
  commentary: [{ type: mongoose.Schema.Types.Mixed }],
  
  // Match type (to distinguish API-sourced from manually created)
  source: {
    type: String,
    enum: ['api', 'manual'],
    default: 'manual',
    index: true
  },
  
  // Timestamps
  lastUpdated: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for efficient querying
matchSchema.index({ status: 1, lastUpdated: -1 });
matchSchema.index({ status: 1, date: -1 });
matchSchema.index({ format: 1, status: 1 });
matchSchema.index({ source: 1, status: 1 });

// Methods
matchSchema.methods.isInternational = function() {
  const internationalFormats = ['Test', 'ODI', 'T20I'];
  return internationalFormats.includes(this.format);
};

matchSchema.methods.getCurrentScore = function() {
  if (!this.innings || this.innings.length === 0) {
    return null;
  }
  
  const currentInnings = this.innings[this.innings.length - 1];
  return {
    runs: currentInnings.runs,
    wickets: currentInnings.wickets,
    overs: `${currentInnings.overs}.${currentInnings.balls}`
  };
};

// Static methods
matchSchema.statics.findLiveMatches = function() {
  return this.find({ status: 'live' }).sort({ lastUpdated: -1 });
};

matchSchema.statics.findUpcomingMatches = function(limit = 20) {
  return this.find({ status: 'upcoming' })
    .sort({ date: 1 })
    .limit(limit);
};

matchSchema.statics.findRecentResults = function(limit = 20) {
  return this.find({ status: 'completed' })
    .sort({ date: -1 })
    .limit(limit);
};

matchSchema.statics.findInternationalMatches = function(status) {
  const query = { format: { $in: ['Test', 'ODI', 'T20I'] } };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ lastUpdated: -1 });
};

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
