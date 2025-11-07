require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RECENT_OVERS = 10; // Maximum number of recent overs to keep
const BALLS_PER_OVER = 6; // Standard cricket over

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data storage
const dataDir = path.join(__dirname, 'data');
const matchFile = path.join(dataDir, 'match.json');

// Helper function to check if player is unavailable
function isPlayerUnavailable(status) {
  return status === 'out' || status === 'retired hurt' || status === 'retired out' || status === 'retired not out';
}

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize empty match if doesn't exist
function initializeMatch() {
  if (!fs.existsSync(matchFile)) {
    const emptyMatch = {
      id: null,
      title: null,
      venue: null,
      date: null,
      status: 'no-match', // no-match, upcoming, live, completed
      currentInnings: 0,
      innings: [],
      squads: {}
    };
    fs.writeFileSync(matchFile, JSON.stringify(emptyMatch, null, 2));
  }
}

function loadMatch() {
  try {
    initializeMatch();
    const data = fs.readFileSync(matchFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading match:', error);
    return null;
  }
}

function saveMatch(match) {
  try {
    fs.writeFileSync(matchFile, JSON.stringify(match, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving match:', error);
    return false;
  }
}

// Recalculation functions for undo and edit ball functionality
function processBall(innings, ball, ballIndex) {
  // Ensure overthrows field exists (for backward compatibility)
  const overthrows = ball.overthrows || 0;
  
  // Update runs (include overthrows)
  innings.runs += (ball.runs + overthrows + ball.extras);
  
  // Determine if legal delivery
  const isLegal = (ball.extraType !== 'Wd' && ball.extraType !== 'Nb');
  
  // Update striker stats
  if (!innings.allBatsmen[ball.batsman]) {
    innings.allBatsmen[ball.batsman] = { 
      name: ball.batsman,
      runs: 0, 
      balls: 0, 
      fours: 0, 
      sixes: 0, 
      status: 'batting' 
    };
  }
  
  innings.allBatsmen[ball.batsman].runs += (ball.runs + overthrows);
  // BUG FIX #2: No-ball counts for batsman (they faced it), but not for over
  // Wide doesn't count for batsman or over
  if (ball.extraType !== 'Wd') {
    innings.allBatsmen[ball.batsman].balls++;
  }
  // Check for boundaries (without overthrows)
  if (ball.runs === 4 && overthrows === 0) innings.allBatsmen[ball.batsman].fours++;
  if (ball.runs === 6 && overthrows === 0) innings.allBatsmen[ball.batsman].sixes++;
  
  // Update bowler stats
  if (!innings.allBowlers[ball.bowler]) {
    innings.allBowlers[ball.bowler] = { 
      name: ball.bowler,
      balls: 0, 
      overs: 0, 
      maidens: 0, 
      runs: 0, 
      wickets: 0 
    };
  }
  
  // Only add certain extras to bowler's runs
  // Wides (Wd) and No-balls (Nb) go to bowler
  // Byes (Bye/B) and Leg-byes (LB) do NOT go to bowler (only overthrows do)
  // Note: For byes/leg-byes, ball.runs is always 0 (no runs off bat), so only overthrows are added
  if (ball.extraType === 'Wd' || ball.extraType === 'Nb') {
    innings.allBowlers[ball.bowler].runs += (ball.runs + overthrows + ball.extras);
  } else if (ball.extraType === 'Bye' || ball.extraType === 'B' || ball.extraType === 'LB') {
    // Byes/leg-byes: only overthrows go to bowler (ball.runs is 0 for these)
    innings.allBowlers[ball.bowler].runs += (ball.runs + overthrows);
  } else {
    // No extras, just runs off the bat plus overthrows
    innings.allBowlers[ball.bowler].runs += (ball.runs + overthrows);
  }
  if (isLegal) innings.allBowlers[ball.bowler].balls++;
  
  // Handle wickets
  if (ball.wicket) {
    innings.wickets++;
    innings.allBatsmen[ball.dismissedBatsman].status = 'out';
    innings.allBatsmen[ball.dismissedBatsman].howOut = ball.wicketType;
    
    innings.fallOfWickets.push({
      runs: innings.runs,
      wickets: innings.wickets,
      batsman: ball.dismissedBatsman
    });
    
    // BUG FIX #1: Use incomingBatsman from ball record if available
    // This ensures recalculation uses the batsman selected by the user, not just next in order
    if (ball.incomingBatsman) {
      const nextBat = ball.incomingBatsman;
      
      // Initialize batsman if not already in allBatsmen
      if (!innings.allBatsmen[nextBat]) {
        innings.allBatsmen[nextBat] = { 
          name: nextBat,
          runs: 0, 
          balls: 0, 
          fours: 0, 
          sixes: 0, 
          status: 'batting' 
        };
      } else if (innings.allBatsmen[nextBat].status === 'retired hurt') {
        // BUG FIX #2: Resuming retired hurt batsman - keep stats, change status
        innings.allBatsmen[nextBat].status = 'batting';
      } else {
        // Batsman already exists, just update status to batting
        innings.allBatsmen[nextBat].status = 'batting';
      }
      
      // Replace dismissed batsman
      if (ball.dismissedBatsman === innings.striker) {
        innings.striker = nextBat;
      } else {
        innings.nonStriker = nextBat;
      }
      
      // Update nextBatsmanIndex if this was the next in order
      const batsmanIndex = innings.battingOrder.indexOf(nextBat);
      if (batsmanIndex === innings.nextBatsmanIndex) {
        innings.nextBatsmanIndex++;
      }
    }
    // Fallback: If no incomingBatsman stored (old balls), use next in order
    else if (innings.nextBatsmanIndex < innings.battingOrder.length) {
      const nextBat = innings.battingOrder[innings.nextBatsmanIndex];
      innings.nextBatsmanIndex++;
      
      if (!innings.allBatsmen[nextBat]) {
        innings.allBatsmen[nextBat] = { 
          name: nextBat,
          runs: 0, 
          balls: 0, 
          fours: 0, 
          sixes: 0, 
          status: 'batting' 
        };
      } else if (innings.allBatsmen[nextBat].status === 'retired hurt') {
        // BUG FIX #2: Resuming retired hurt batsman - keep stats, change status
        innings.allBatsmen[nextBat].status = 'batting';
      } else {
        // Batsman already exists, just update status to batting
        innings.allBatsmen[nextBat].status = 'batting';
      }
      
      // Replace dismissed batsman
      if (ball.dismissedBatsman === innings.striker) {
        innings.striker = nextBat;
      } else {
        innings.nonStriker = nextBat;
      }
    }
  }
  
  // Rotate strike if odd total runs (runs + overthrows)
  const overthrowsForStrike = ball.overthrows || 0;
  const totalRunsForStrike = ball.runs + overthrowsForStrike;
  if (totalRunsForStrike % 2 === 1) {
    [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
  }
  
  // Add to current over
  innings.currentOver.push(ball);
  
  // Increment ball count and check over complete
  if (isLegal) {
    innings.balls++;
    
    if (innings.balls === 6) {
      innings.overs++;
      innings.balls = 0;
      
      // Update bowler overs
      const bowlerBalls = innings.allBowlers[ball.bowler].balls;
      innings.allBowlers[ball.bowler].overs = Math.floor(bowlerBalls / 6);
      
      // Store last completed over with full ball details
      const overRuns = innings.currentOver.reduce((sum, b) => sum + b.runs + (b.overthrows || 0) + b.extras, 0);
      innings.lastCompletedOver = {
        overNum: innings.overs,
        bowler: ball.bowler,
        balls: [...innings.currentOver],
        runs: overRuns
      };
      
      // Store completed over summary
      if (!innings.recentOvers) {
        innings.recentOvers = [];
      }
      innings.recentOvers.push({
        over: innings.overs,
        bowler: ball.bowler,
        runs: overRuns
      });
      
      // Keep only last MAX_RECENT_OVERS overs
      if (innings.recentOvers.length > MAX_RECENT_OVERS) {
        innings.recentOvers.shift();
      }
      
      // Swap ends
      [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
      
      // Clear current over
      innings.currentOver = [];
      
      // BUG FIX #3: Don't auto-update current bowler during recalculation
      // It will be set to the last ball's bowler after all balls are processed
    }
  }
}

function recalculateInnings(innings) {
  // Reset innings to initial state
  innings.runs = 0;
  innings.wickets = 0;
  innings.overs = 0;
  innings.balls = 0;
  innings.currentOver = [];
  innings.fallOfWickets = [];
  innings.allBatsmen = Object.create(null);
  innings.allBowlers = Object.create(null);
  innings.striker = innings.battingOrder[0];
  innings.nonStriker = innings.battingOrder[1];
  innings.nextBatsmanIndex = 2;
  innings.recentOvers = [];
  
  // Replay each ball in order
  innings.allBalls.forEach((ball, index) => {
    processBall(innings, ball, index);
  });
  
  // BUG FIX #3: Set current bowler to whoever bowled the LAST ball (not the over-complete bowler)
  // This ensures edit-ball doesn't incorrectly change the current bowler
  if (innings.allBalls.length > 0) {
    const lastBall = innings.allBalls[innings.allBalls.length - 1];
    innings.currentBowler = { name: lastBall.bowler };
  }
  
  // Update current batsmen display (keep compatibility with existing code)
  innings.currentBatsmen = [];
  if (innings.allBatsmen[innings.striker]) {
    innings.currentBatsmen.push(innings.allBatsmen[innings.striker]);
  }
  if (innings.allBatsmen[innings.nonStriker]) {
    innings.currentBatsmen.push(innings.allBatsmen[innings.nonStriker]);
  }
  
  return innings;
}

// BUG FIX #4: Validate innings state to prevent ghost dismissals
function validateInningsState(innings) {
  // Count batsmen at crease (should always be exactly 2, unless all out)
  const atCrease = [innings.striker, innings.nonStriker].filter(Boolean);
  
  if (innings.wickets < 10 && atCrease.length !== 2) {
    console.error('CRITICAL ERROR: Not exactly 2 batsmen at crease!');
    console.error('Wickets:', innings.wickets);
    console.error('Striker:', innings.striker);
    console.error('Non-striker:', innings.nonStriker);
    console.error('At crease count:', atCrease.length);
  }
  
  // Count wickets - verify wickets count matches out batsmen
  const outBatsmen = Object.values(innings.allBatsmen).filter(b => b.status === 'out');
  if (outBatsmen.length !== innings.wickets) {
    console.error('CRITICAL ERROR: Wicket count mismatch!');
    console.error('innings.wickets:', innings.wickets);
    console.error('Actually out:', outBatsmen.length);
    console.error('Out batsmen:', outBatsmen.map(b => b.name || 'unknown'));
  }
}

// Calculate match situation for Test Match
function calculateMatchSituation(match) {
  if (!match || !match.innings || match.innings.length === 0) {
    return;
  }
  
  const innings = match.innings;
  
  // BUG FIX #4: Update lead/trail during 2nd innings (not just when completed)
  if (innings.length >= 2) {
    const innings1 = innings[0];
    const innings2 = innings[1];
    
    const team1Score = innings1.runs;
    const team2Score = innings2.runs;
    const deficit = team1Score - team2Score;
    
    // Check follow-on availability when 2nd innings completes
    if (innings[1].status === 'completed' && deficit >= match.followOn.deficit) {
      match.followOn.available = true;
    }
    
    // Update lead/trail situation
    if (team1Score > team2Score) {
      match.matchSituation.lead = innings1.battingTeam;
      match.matchSituation.leadBy = deficit;
    } else if (team2Score > team1Score) {
      match.matchSituation.lead = innings2.battingTeam;
      match.matchSituation.leadBy = team2Score - team1Score;
    } else {
      match.matchSituation.lead = null;
      match.matchSituation.leadBy = 0;
    }
  }
  
  // BUG FIX #4: Calculate target during 3rd innings (not just when completed)
  if (innings.length >= 3) {
    const innings1 = innings[0];
    const innings2 = innings[1];
    const innings3 = innings[2];
    
    // Team that batted first's total (innings 1 + innings 3 if applicable)
    const team1Total = innings1.runs + (innings3.battingTeam === innings1.battingTeam ? innings3.runs : 0);
    
    // Team that batted second's total (innings 2 + innings 3 if applicable)
    const team2Total = innings2.runs + (innings3.battingTeam === innings2.battingTeam ? innings3.runs : 0);
    
    // Target is the deficit + 1
    if (team1Total > team2Total) {
      match.matchSituation.target = team1Total - team2Total + 1;
      match.matchSituation.toWin = match.matchSituation.target;
      match.matchSituation.lead = innings1.battingTeam;
      match.matchSituation.leadBy = team1Total - team2Total;
    } else if (team2Total > team1Total) {
      match.matchSituation.target = team2Total - team1Total + 1;
      match.matchSituation.toWin = match.matchSituation.target;
      match.matchSituation.lead = innings2.battingTeam;
      match.matchSituation.leadBy = team2Total - team1Total;
    }
  }
  
  // BUG FIX #4: Update chase situation during 4th innings
  if (innings.length === 4) {
    const innings4 = innings[3];
    if (match.matchSituation.target) {
      match.matchSituation.toWin = match.matchSituation.target - innings4.runs;
    }
    
    // Check if match is over
    if (innings4.status === 'completed' || innings4.wickets >= 10) {
      calculateMatchResult(match);
    }
  }
}

// Calculate match result
function calculateMatchResult(match) {
  if (!match || !match.innings || match.innings.length < 2) {
    return;
  }
  
  const innings = match.innings;
  
  // Match can end after 4 innings or if team batting 4th is all out or declares
  if (innings.length === 4 && (innings[3].status === 'completed' || innings[3].wickets >= 10)) {
    const innings4 = innings[3];
    const target = match.matchSituation.target || 0;
    
    if (innings4.runs >= target) {
      // Batting team won
      match.result.status = 'completed';
      match.result.winner = innings4.battingTeam;
      match.result.winType = 'wickets';
      match.result.margin = 10 - innings4.wickets;
    } else {
      // Bowling team won
      match.result.status = 'completed';
      match.result.winner = innings4.bowlingTeam;
      match.result.winType = 'runs';
      match.result.margin = target - innings4.runs - 1;
    }
    
    match.status = 'completed';
  } else if (innings.length === 2 && innings[1].status === 'completed' && innings[1].wickets >= 10) {
    // If batting second and all out with deficit, batting first team wins
    const deficit = innings[0].runs - innings[1].runs;
    if (deficit > 0) {
      match.result.status = 'completed';
      match.result.winner = innings[0].battingTeam;
      match.result.winType = 'innings';
      match.result.margin = deficit;
      match.status = 'completed';
    }
  }
}

// Simple session storage (in-memory for simplicity)
// NOTE: Sessions are lost on server restart. For production, consider using
// a persistent session store like Redis or a database-backed session store.
let sessions = {};

// Simple rate limiting for API endpoints
const requestCounts = {};
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

function checkRateLimit(req, res, next) {
  const identifier = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts[identifier]) {
    requestCounts[identifier] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
  } else {
    if (now > requestCounts[identifier].resetTime) {
      requestCounts[identifier] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    } else {
      requestCounts[identifier].count++;
      if (requestCounts[identifier].count > MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
    }
  }
  
  next();
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(requestCounts).forEach(key => {
    if (now > requestCounts[key].resetTime + RATE_LIMIT_WINDOW_MS) {
      delete requestCounts[key];
    }
  });
}, RATE_LIMIT_WINDOW_MS);

// Admin authentication
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  // Require admin password to be set in production
  if (!adminPassword && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ 
      success: false, 
      message: 'Admin password not configured' 
    });
  }
  
  // Use default password only in development
  const effectivePassword = adminPassword || 'ashes2025';
  
  if (password === effectivePassword) {
    // Use cryptographically secure random for session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions[sessionId] = { authenticated: true, createdAt: Date.now() };
    res.json({ success: true, sessionId });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (sessionId && sessions[sessionId]) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Get current match data
app.get('/api/match', checkRateLimit, (req, res) => {
  const match = loadMatch();
  res.json(match);
});

// Create new Ashes test match (admin only)
app.post('/api/match/create', requireAuth, (req, res) => {
  const { testNumber, venue, date, englandSquad, australiaSquad } = req.body;
  
  // Validate squads
  if (!englandSquad || !Array.isArray(englandSquad) || englandSquad.length !== 11) {
    return res.status(400).json({ error: 'England squad must contain exactly 11 players' });
  }
  if (!australiaSquad || !Array.isArray(australiaSquad) || australiaSquad.length !== 11) {
    return res.status(400).json({ error: 'Australia squad must contain exactly 11 players' });
  }
  
  // Validate player names are not empty
  const allPlayers = [...englandSquad, ...australiaSquad];
  if (allPlayers.some(name => !name || name.trim() === '')) {
    return res.status(400).json({ error: 'All player names must be filled in' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (allPlayers.some(name => dangerousNames.includes(name))) {
    return res.status(400).json({ error: 'Invalid player names detected' });
  }
  
  const match = {
    id: `ashes-test-${testNumber}`,
    title: `The Ashes - ${testNumber}${testNumber === 1 ? 'st' : testNumber === 2 ? 'nd' : testNumber === 3 ? 'rd' : 'th'} Test`,
    venue: venue,
    date: date,
    status: 'upcoming',
    format: 'test',
    maxInnings: 4,
    currentInnings: 0,
    innings: [],
    squads: {
      England: englandSquad,
      Australia: australiaSquad
    },
    matchSituation: {
      lead: null,
      leadBy: 0,
      target: null,
      toWin: null
    },
    followOn: {
      available: false,
      deficit: 200,
      enforced: false
    },
    result: {
      status: 'in-progress',
      winner: null,
      winType: null,
      margin: null
    }
  };
  
  if (saveMatch(match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Start new innings (admin only)
app.post('/api/match/start-innings', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  // For Test Match: Block 5th innings
  if (match.format === 'test' && match.innings.length >= match.maxInnings) {
    return res.status(400).json({ error: 'Maximum 4 innings allowed in Test Match' });
  }
  
  const { battingTeam, bowlingTeam, battingOrder, openingBowler, enforceFollowOn } = req.body;
  
  // Validate batting order
  if (!battingOrder || battingOrder.length !== 11) {
    return res.status(400).json({ error: 'Batting order must contain exactly 11 players' });
  }
  
  // Prevent prototype pollution - check for dangerous property names
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  const hasDangerousName = battingOrder.some(name => dangerousNames.includes(name));
  if (hasDangerousName) {
    return res.status(400).json({ error: 'Invalid player names detected' });
  }
  
  // Validate that all batsmen are from the batting team's squad
  const battingSquad = match.squads[battingTeam] || [];
  const invalidPlayers = battingOrder.filter(player => !battingSquad.includes(player));
  if (invalidPlayers.length > 0) {
    return res.status(400).json({ error: `Invalid players in batting order: ${invalidPlayers.join(', ')}` });
  }
  
  // Allow opening bowler to be manually entered (not restricted to squad - handles substitutes)
  // Just prevent prototype pollution in bowler name
  if (openingBowler && dangerousNames.includes(openingBowler)) {
    return res.status(400).json({ error: 'Invalid bowler name detected' });
  }
  
  // Handle follow-on enforcement
  if (enforceFollowOn && match.followOn.available) {
    match.followOn.enforced = true;
  }
  
  const innings = {
    number: match.innings.length + 1,
    battingTeam: battingTeam,
    bowlingTeam: bowlingTeam,
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    declared: false,
    status: 'live',
    battingOrder: battingOrder, // Array of 11 player names in batting order
    nextBatsmanIndex: 2, // Next batsman to come in (starts at 2, as 0 and 1 are opening batsmen)
    // BUG FIX #5: Auto-add openers when innings starts
    striker: battingOrder[0], // First opener at striker
    nonStriker: battingOrder[1], // Second opener at non-striker
    allBatsmen: Object.create(null), // Map of player name -> { runs, balls, fours, sixes, status, howOut }
    allBowlers: Object.create(null), // Map of bowler name -> { balls, overs, maidens, runs, wickets }
    currentBowler: openingBowler ? { name: openingBowler } : null,
    currentOver: [],
    fallOfWickets: [],
    allBalls: [],
    recentOvers: [] // Store last 5-10 overs
  };
  
  // BUG FIX #5: Initialize openers in allBatsmen
  innings.allBatsmen[battingOrder[0]] = {
    name: battingOrder[0],
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    status: 'batting'
  };
  innings.allBatsmen[battingOrder[1]] = {
    name: battingOrder[1],
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    status: 'batting'
  };
  
  match.innings.push(innings);
  match.currentInnings = innings.number;
  match.status = 'live';
  
  if (saveMatch(match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to start innings' });
  }
});

// Record a ball (admin only)
app.post('/api/match/ball', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { 
    runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman, bowler
  } = req.body;
  
  // Prevent prototype pollution in input names
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (bowler && dangerousNames.includes(bowler)) {
    return res.status(400).json({ error: 'Invalid bowler name' });
  }
  if (dismissedBatsman && dangerousNames.includes(dismissedBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  // Initialize striker and non-striker on first ball
  if (!currentInnings.striker && !currentInnings.nonStriker) {
    currentInnings.striker = currentInnings.battingOrder[0];
    currentInnings.nonStriker = currentInnings.battingOrder[1];
    
    // Initialize their stats
    currentInnings.allBatsmen[currentInnings.striker] = { 
      runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' 
    };
    currentInnings.allBatsmen[currentInnings.nonStriker] = { 
      runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' 
    };
  }
  
  // Set or update current bowler
  if (bowler) {
    currentInnings.currentBowler = { name: bowler };
    if (!currentInnings.allBowlers[bowler]) {
      currentInnings.allBowlers[bowler] = { 
        balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
      };
    }
  }
  
  // Ensure currentBowler is set
  if (!currentInnings.currentBowler || !currentInnings.currentBowler.name) {
    return res.status(400).json({ error: 'No bowler specified' });
  }
  
  const striker = currentInnings.striker;
  const nonStriker = currentInnings.nonStriker;
  const currentBowlerName = currentInnings.currentBowler.name;
  
  // 1. Determine if legal delivery
  const isLegalDelivery = (extraType !== 'Wd' && extraType !== 'Nb');
  
  // 2. Create ball record with CURRENT over.ball before incrementing
  // For illegal deliveries (wide/no-ball), use current ball number (not +1)
  // For legal deliveries, use next ball number (+1)
  const ballNumber = isLegalDelivery ? currentInnings.balls + 1 : Math.max(1, currentInnings.balls);
  
  const ball = {
    over: currentInnings.overs,
    ball: ballNumber, // Ball number in current over (1-6)
    batsman: striker,
    bowler: currentBowlerName,
    runs: parseInt(runs) || 0,
    overthrows: parseInt(overthrows) || 0,
    extras: parseInt(extras) || 0,
    extraType: extraType || null,
    wicket: wicket || false,
    wicketType: wicketType || null,
    dismissedBatsman: dismissedBatsman || null,
    timestamp: new Date().toISOString()
  };
  
  // 3. Update innings totals (include overthrows in total)
  currentInnings.runs += (ball.runs + ball.overthrows + ball.extras);
  
  // 4. Update striker stats (include overthrows in batsman's runs)
  currentInnings.allBatsmen[striker].runs += (ball.runs + ball.overthrows);
  // BUG FIX #2: No-ball counts for batsman (they faced it), but not for over
  // Wide doesn't count for batsman or over
  if (ball.extraType !== 'Wd') {
    currentInnings.allBatsmen[striker].balls++;
  }
  // Check for boundaries (without overthrows)
  if (ball.runs === 4 && ball.overthrows === 0) currentInnings.allBatsmen[striker].fours++;
  if (ball.runs === 6 && ball.overthrows === 0) currentInnings.allBatsmen[striker].sixes++;
  
  // 5. Update bowler stats
  if (!currentInnings.allBowlers[currentBowlerName]) {
    currentInnings.allBowlers[currentBowlerName] = { 
      balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
    };
  }
  // Only add certain extras to bowler's runs
  // Wides (Wd) and No-balls (Nb) go to bowler
  // Byes (Bye/B) and Leg-byes (LB) do NOT go to bowler (only overthrows do)
  // Note: For byes/leg-byes, ball.runs is always 0 (no runs off bat), so only overthrows are added
  if (ball.extraType === 'Wd' || ball.extraType === 'Nb') {
    currentInnings.allBowlers[currentBowlerName].runs += (ball.runs + ball.overthrows + ball.extras);
  } else if (ball.extraType === 'Bye' || ball.extraType === 'B' || ball.extraType === 'LB') {
    // Byes/leg-byes: only overthrows go to bowler (ball.runs is 0 for these)
    currentInnings.allBowlers[currentBowlerName].runs += (ball.runs + ball.overthrows);
  } else {
    // No extras, just runs off the bat plus overthrows
    currentInnings.allBowlers[currentBowlerName].runs += (ball.runs + ball.overthrows);
  }
  if (isLegalDelivery) {
    currentInnings.allBowlers[currentBowlerName].balls++;
  }
  
  // 6. Handle wickets
  if (ball.wicket) {
    currentInnings.wickets++;
    const dismissedName = dismissedBatsman || striker;
    
    // BUG FIX #4: Validate that only one batsman is dismissed
    // Ensure dismissed batsman is either striker or non-striker
    if (dismissedName !== striker && dismissedName !== nonStriker) {
      return res.status(400).json({ error: 'Dismissed batsman must be striker or non-striker' });
    }
    
    // Update batsman status if exists
    // Note: allBatsmen is created with Object.create(null) to prevent prototype pollution
    // and all names are validated against squad lists
    if (currentInnings.allBatsmen[dismissedName]) {
      currentInnings.allBatsmen[dismissedName].status = 'out';
      currentInnings.allBatsmen[dismissedName].howOut = wicketType;
    }
    
    // Update bowler wicket count
    // Note: allBowlers is created with Object.create(null) to prevent prototype pollution
    currentInnings.allBowlers[currentBowlerName].wickets++;
    
    currentInnings.fallOfWickets.push({
      runs: currentInnings.runs,
      wickets: currentInnings.wickets,
      batsman: dismissedName
    });
    
    // BUG FIX #1: Don't auto-add next batsman here
    // User will select incoming batsman via modal (showChooseBatsmanModal)
    // This ensures modal can show ALL remaining batsmen including next in order
  }
  
  // 7. Rotate strike if odd total runs (runs + overthrows)
  const totalRunsForStrike = ball.runs + ball.overthrows;
  if (totalRunsForStrike % 2 === 1) {
    [currentInnings.striker, currentInnings.nonStriker] = 
      [currentInnings.nonStriker, currentInnings.striker];
  }
  
  // 8. Add ball to current over FIRST
  currentInnings.currentOver.push(ball);
  
  // 9. Increment ball count if legal delivery
  if (isLegalDelivery) {
    currentInnings.balls++;
    
    // 10. Check if over complete
    if (currentInnings.balls === 6) {
      currentInnings.overs++;
      currentInnings.balls = 0;
      
      // Update bowler's over count
      const bowlerBalls = currentInnings.allBowlers[currentBowlerName].balls;
      currentInnings.allBowlers[currentBowlerName].overs = Math.floor(bowlerBalls / 6);
      
      // Store last completed over with full ball details
      currentInnings.lastCompletedOver = {
        overNum: currentInnings.overs, // The over that just completed
        bowler: currentBowlerName,
        balls: [...currentInnings.currentOver], // Deep copy of balls
        runs: currentInnings.currentOver.reduce((sum, b) => sum + b.runs + (b.overthrows || 0) + b.extras, 0)
      };
      
      // Store completed over summary in recent overs
      if (!currentInnings.recentOvers) {
        currentInnings.recentOvers = [];
      }
      currentInnings.recentOvers.push({
        over: currentInnings.overs, // Use the newly incremented over number
        bowler: currentBowlerName,
        runs: currentInnings.lastCompletedOver.runs
      });
      
      // Keep only last MAX_RECENT_OVERS overs
      if (currentInnings.recentOvers.length > MAX_RECENT_OVERS) {
        currentInnings.recentOvers.shift();
      }
      
      // Swap ends
      [currentInnings.striker, currentInnings.nonStriker] = 
        [currentInnings.nonStriker, currentInnings.striker];
      
      // Clear current over
      currentInnings.currentOver = [];
    }
  }
  
  // 11. Store in all balls
  currentInnings.allBalls.push(ball);
  
  // BUG FIX #4: Validate innings state to prevent ghost dismissals
  validateInningsState(currentInnings);
  
  // BUG FIX #4: Update match situation after EVERY ball (not just 4th innings)
  if (match.format === 'test') {
    calculateMatchSituation(match);
  }
  
  if (saveMatch(match)) {
    res.json({ match, ball });
  } else {
    res.status(500).json({ error: 'Failed to record ball' });
  }
});

// Undo last ball (admin only)
app.post('/api/match/undo', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  if (!currentInnings.allBalls || currentInnings.allBalls.length === 0) {
    return res.status(400).json({ error: 'No balls to undo' });
  }
  
  // Remove last ball
  currentInnings.allBalls.pop();
  
  // Recalculate innings from all balls
  recalculateInnings(currentInnings);
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to undo' });
  }
});

// Edit a specific ball (admin only)
app.post('/api/match/edit-ball', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { ballIndex, runs, extras, extraType, wicket, wicketType, dismissedBatsman, bowler, batsman } = req.body;
  
  if (ballIndex < 0 || ballIndex >= currentInnings.allBalls.length) {
    return res.status(400).json({ error: 'Invalid ball index' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dismissedBatsman && dangerousNames.includes(dismissedBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  // BUG FIX #3: Add validation for bowler and batsman
  if (bowler && dangerousNames.includes(bowler)) {
    return res.status(400).json({ error: 'Invalid bowler name' });
  }
  if (batsman && dangerousNames.includes(batsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  // Validate extraType and wicketType to prevent prototype pollution
  if (extraType && dangerousNames.includes(extraType)) {
    return res.status(400).json({ error: 'Invalid extra type' });
  }
  if (wicketType && dangerousNames.includes(wicketType)) {
    return res.status(400).json({ error: 'Invalid wicket type' });
  }
  
  // Update ball at index
  const ball = currentInnings.allBalls[ballIndex];
  ball.runs = parseInt(runs) || 0;
  ball.extras = parseInt(extras) || 0;
  ball.extraType = extraType || null;
  ball.wicket = wicket || false;
  ball.wicketType = wicketType || null;
  ball.dismissedBatsman = dismissedBatsman || null;
  // BUG FIX #3: Allow editing bowler and batsman facing
  if (bowler && bowler.trim()) ball.bowler = bowler;
  if (batsman && batsman.trim()) ball.batsman = batsman;
  
  // Recalculate innings from all balls
  recalculateInnings(currentInnings);
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to edit ball' });
  }
});

// Change bowler (admin only)
app.post('/api/match/change-bowler', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { bowlerName } = req.body;
  
  if (!bowlerName || bowlerName.trim() === '') {
    return res.status(400).json({ error: 'Bowler name required' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(bowlerName)) {
    return res.status(400).json({ error: 'Invalid bowler name' });
  }
  
  // Update current bowler (can be any name - handles substitutes)
  currentInnings.currentBowler = { name: bowlerName };
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to change bowler' });
  }
});

// Select next batsman (admin only)
app.post('/api/match/next-batsman', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { batsmanName } = req.body;
  
  // If no batsman specified, use next in order
  let nextBatsman;
  if (batsmanName) {
    // Validate batsman is in batting order and hasn't batted
    if (!currentInnings.battingOrder.includes(batsmanName)) {
      return res.status(400).json({ error: 'Batsman not in batting order' });
    }
    if (currentInnings.allBatsmen[batsmanName] && currentInnings.allBatsmen[batsmanName].status !== 'not batted') {
      return res.status(400).json({ error: 'Batsman has already batted' });
    }
    nextBatsman = batsmanName;
  } else {
    // Use next in batting order
    if (currentInnings.nextBatsmanIndex >= currentInnings.battingOrder.length) {
      return res.status(400).json({ error: 'No more batsmen available' });
    }
    nextBatsman = currentInnings.battingOrder[currentInnings.nextBatsmanIndex];
    currentInnings.nextBatsmanIndex++;
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(nextBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  // This endpoint is informational - actual batsman change happens when wicket is recorded
  res.json({ match, nextBatsman });
});

// Edit batting order during innings (admin only)
app.post('/api/match/edit-batting-order', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { newBattingOrder } = req.body;
  
  if (!newBattingOrder || newBattingOrder.length !== 11) {
    return res.status(400).json({ error: 'Batting order must contain exactly 11 players' });
  }
  
  // Validate that players who have batted or are batting remain in same position
  const battedPlayers = Object.keys(currentInnings.allBatsmen);
  for (let i = 0; i < battedPlayers.length; i++) {
    const player = battedPlayers[i];
    const oldIndex = currentInnings.battingOrder.indexOf(player);
    const newIndex = newBattingOrder.indexOf(player);
    
    if (oldIndex !== newIndex) {
      return res.status(400).json({ 
        error: `${player} has already batted and cannot be moved in batting order` 
      });
    }
  }
  
  currentInnings.battingOrder = newBattingOrder;
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to update batting order' });
  }
});

// Declare innings (admin only)
app.post('/api/match/declare', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  if (currentInnings.wickets >= 10) {
    return res.status(400).json({ error: 'Cannot declare - all out' });
  }
  
  currentInnings.declared = true;
  currentInnings.status = 'completed';
  
  // Mark all batting batsmen as not out
  Object.keys(currentInnings.allBatsmen).forEach(name => {
    if (currentInnings.allBatsmen[name].status === 'batting') {
      currentInnings.allBatsmen[name].status = 'not out';
    }
  });
  
  // Calculate match situation after innings ends
  if (match.format === 'test') {
    calculateMatchSituation(match);
  }
  
  if (saveMatch(match)) {
    res.json({ match, message: 'Innings declared. Start next innings.' });
  } else {
    res.status(500).json({ error: 'Failed to declare innings' });
  }
});

// End innings (admin only)
app.post('/api/match/end-innings', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  currentInnings.status = 'completed';
  
  // Calculate match situation after innings ends
  if (match.format === 'test') {
    calculateMatchSituation(match);
  }
  
  // If 4 innings complete, mark match as completed
  if (match.innings.length >= 4) {
    match.status = 'completed';
  }
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to end innings' });
  }
});

// Delete match (admin only)
app.post('/api/match/delete', requireAuth, (req, res) => {
  const emptyMatch = {
    id: null,
    title: null,
    venue: null,
    date: null,
    status: 'no-match',
    currentInnings: 0,
    innings: [],
    squads: {}
  };
  
  if (saveMatch(emptyMatch)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

// Select incoming batsman (admin only)
app.post('/api/match/select-incoming-batsman', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { batsmanName } = req.body;
  
  // Validate batsman is in batting order
  if (!currentInnings.battingOrder.includes(batsmanName)) {
    return res.status(400).json({ error: 'Batsman not in batting order' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(batsmanName)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  // BUG FIX #2: Check if batsman hasn't batted yet OR is retired hurt (can resume)
  if (currentInnings.allBatsmen[batsmanName]) {
    const status = currentInnings.allBatsmen[batsmanName].status;
    // Allow if: not batted, retired hurt
    // Reject if: out, batting, retired out, retired not out
    if (status !== 'not batted' && status !== 'retired hurt') {
      return res.status(400).json({ error: 'Batsman has already batted or is unavailable' });
    }
  }
  
  // BUG FIX #2: Initialize batsman stats OR resume retired hurt batsman
  if (!currentInnings.allBatsmen[batsmanName]) {
    // New batsman - create fresh stats
    currentInnings.allBatsmen[batsmanName] = { 
      name: batsmanName,
      runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' 
    };
  } else if (currentInnings.allBatsmen[batsmanName].status === 'retired hurt') {
    // Resuming retired hurt batsman - keep existing runs/balls, just change status
    currentInnings.allBatsmen[batsmanName].status = 'batting';
  } else {
    // Not batted - change status to batting
    currentInnings.allBatsmen[batsmanName].status = 'batting';
  }
  
  // Replace the appropriate batsman (keep the one who's still batting)
  // If striker is out, replace striker; if non-striker is out, replace non-striker
  const strikerStatus = currentInnings.allBatsmen[currentInnings.striker]?.status;
  const nonStrikerStatus = currentInnings.allBatsmen[currentInnings.nonStriker]?.status;
  
  if (isPlayerUnavailable(strikerStatus)) {
    currentInnings.striker = batsmanName;
  } else if (isPlayerUnavailable(nonStrikerStatus)) {
    currentInnings.nonStriker = batsmanName;
  } else {
    // Fallback: replace striker
    currentInnings.striker = batsmanName;
  }
  
  // Update next batsman index if this was the next batsman in order
  const batsmanIndex = currentInnings.battingOrder.indexOf(batsmanName);
  if (batsmanIndex === currentInnings.nextBatsmanIndex) {
    currentInnings.nextBatsmanIndex++;
  }
  
  // BUG FIX #1: Store incoming batsman in last ball record (if it was a wicket)
  if (currentInnings.allBalls && currentInnings.allBalls.length > 0) {
    const lastBall = currentInnings.allBalls[currentInnings.allBalls.length - 1];
    if (lastBall.wicket) {
      lastBall.incomingBatsman = batsmanName;
    }
  }
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to select batsman' });
  }
});

// Swap strike (admin only)
app.post('/api/match/swap-strike', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  // Swap striker and non-striker
  [currentInnings.striker, currentInnings.nonStriker] = 
    [currentInnings.nonStriker, currentInnings.striker];
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to swap strike' });
  }
});

// Retire batsman (admin only)
app.post('/api/match/retire-batsman', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { batsmanName, retireType } = req.body;
  
  // Validate batsman exists
  if (!currentInnings.allBatsmen[batsmanName]) {
    return res.status(400).json({ error: 'Batsman not found' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(batsmanName)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  // Validate retire type
  const validRetireTypes = ['retired hurt', 'retired out', 'retired not out'];
  if (!validRetireTypes.includes(retireType)) {
    return res.status(400).json({ error: 'Invalid retirement type' });
  }
  
  // Update batsman status
  currentInnings.allBatsmen[batsmanName].status = retireType;
  currentInnings.allBatsmen[batsmanName].howOut = retireType;
  
  // If retired out, count as a wicket
  if (retireType === 'retired out') {
    currentInnings.wickets++;
    currentInnings.fallOfWickets.push({
      runs: currentInnings.runs,
      wickets: currentInnings.wickets,
      batsman: batsmanName
    });
  }
  
  if (saveMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to retire batsman' });
  }
});

// Serve admin page
app.get('/admin', checkRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve main page (Page 340)
app.get('/', checkRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cricket Text - Ashes Scoring App`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Public scorecard: http://localhost:${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin`);
});
