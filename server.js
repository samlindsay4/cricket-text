require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_RECENT_OVERS = 10; // Maximum number of recent overs to keep

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data storage
const dataDir = path.join(__dirname, 'data');
const matchFile = path.join(dataDir, 'match.json');

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
  // Update runs
  innings.runs += (ball.runs + ball.extras);
  
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
  
  innings.allBatsmen[ball.batsman].runs += ball.runs;
  if (isLegal) innings.allBatsmen[ball.batsman].balls++;
  if (ball.runs === 4) innings.allBatsmen[ball.batsman].fours++;
  if (ball.runs === 6) innings.allBatsmen[ball.batsman].sixes++;
  
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
  
  innings.allBowlers[ball.bowler].runs += (ball.runs + ball.extras);
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
    
    // Bring in next batsman
    if (innings.nextBatsmanIndex < innings.battingOrder.length) {
      const nextBat = innings.battingOrder[innings.nextBatsmanIndex];
      innings.nextBatsmanIndex++;
      
      // Replace dismissed batsman
      if (ball.dismissedBatsman === innings.striker) {
        innings.striker = nextBat;
      } else {
        innings.nonStriker = nextBat;
      }
    }
  }
  
  // Rotate strike if odd runs
  if (ball.runs % 2 === 1) {
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
      
      // Store completed over
      if (!innings.recentOvers) {
        innings.recentOvers = [];
      }
      innings.recentOvers.push({
        over: innings.overs,
        bowler: ball.bowler,
        runs: innings.currentOver.reduce((sum, b) => sum + b.runs + b.extras, 0)
      });
      
      // Keep only last MAX_RECENT_OVERS overs
      if (innings.recentOvers.length > MAX_RECENT_OVERS) {
        innings.recentOvers.shift();
      }
      
      // Swap ends
      [innings.striker, innings.nonStriker] = [innings.nonStriker, innings.striker];
      
      // Clear current over
      innings.currentOver = [];
      
      // Update current bowler for next over
      innings.currentBowler = { name: ball.bowler };
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
    currentInnings: 0,
    innings: [],
    squads: {
      England: englandSquad,
      Australia: australiaSquad
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
  
  const { battingTeam, bowlingTeam, battingOrder, openingBowler } = req.body;
  
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
    striker: null, // Will be set when first ball is bowled
    nonStriker: null, // Will be set when first ball is bowled
    allBatsmen: Object.create(null), // Map of player name -> { runs, balls, fours, sixes, status, howOut }
    allBowlers: Object.create(null), // Map of bowler name -> { balls, overs, maidens, runs, wickets }
    currentBowler: openingBowler ? { name: openingBowler } : null,
    currentOver: [],
    fallOfWickets: [],
    allBalls: [],
    recentOvers: [] // Store last 5-10 overs
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
    runs, extras, extraType, wicket, wicketType, dismissedBatsman, bowler
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
  const ball = {
    over: currentInnings.overs,
    ball: currentInnings.balls + 1, // Ball number in current over (1-6)
    batsman: striker,
    bowler: currentBowlerName,
    runs: parseInt(runs) || 0,
    extras: parseInt(extras) || 0,
    extraType: extraType || null,
    wicket: wicket || false,
    wicketType: wicketType || null,
    dismissedBatsman: dismissedBatsman || null,
    timestamp: new Date().toISOString()
  };
  
  // 3. Update innings totals
  currentInnings.runs += (ball.runs + ball.extras);
  
  // 4. Update striker stats
  currentInnings.allBatsmen[striker].runs += ball.runs;
  if (isLegalDelivery) {
    currentInnings.allBatsmen[striker].balls++;
  }
  if (ball.runs === 4) currentInnings.allBatsmen[striker].fours++;
  if (ball.runs === 6) currentInnings.allBatsmen[striker].sixes++;
  
  // 5. Update bowler stats
  if (!currentInnings.allBowlers[currentBowlerName]) {
    currentInnings.allBowlers[currentBowlerName] = { 
      balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
    };
  }
  currentInnings.allBowlers[currentBowlerName].runs += (ball.runs + ball.extras);
  if (isLegalDelivery) {
    currentInnings.allBowlers[currentBowlerName].balls++;
  }
  
  // 6. Handle wickets
  if (ball.wicket) {
    currentInnings.wickets++;
    const dismissedName = dismissedBatsman || striker;
    
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
    
    // Bring in next batsman (if available and not all out)
    if (currentInnings.nextBatsmanIndex < 11 && currentInnings.wickets < 10) {
      const nextBatsman = currentInnings.battingOrder[currentInnings.nextBatsmanIndex];
      currentInnings.nextBatsmanIndex++;
      
      // Initialize next batsman stats
      currentInnings.allBatsmen[nextBatsman] = { 
        runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' 
      };
      
      // Replace dismissed batsman (maintain striker/non-striker correctly)
      if (dismissedName === striker) {
        currentInnings.striker = nextBatsman;
      } else {
        currentInnings.nonStriker = nextBatsman;
      }
    }
  }
  
  // 7. Rotate strike if odd runs
  if (ball.runs % 2 === 1) {
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
      
      // Store completed over
      if (!currentInnings.recentOvers) {
        currentInnings.recentOvers = [];
      }
      currentInnings.recentOvers.push({
        over: currentInnings.overs, // Use the newly incremented over number
        bowler: currentBowlerName,
        runs: currentInnings.currentOver.reduce((sum, b) => sum + b.runs + b.extras, 0)
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
  const { ballIndex, runs, extras, extraType, wicket, wicketType, dismissedBatsman } = req.body;
  
  if (ballIndex < 0 || ballIndex >= currentInnings.allBalls.length) {
    return res.status(400).json({ error: 'Invalid ball index' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dismissedBatsman && dangerousNames.includes(dismissedBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  // Update ball at index
  const ball = currentInnings.allBalls[ballIndex];
  ball.runs = parseInt(runs) || 0;
  ball.extras = parseInt(extras) || 0;
  ball.extraType = extraType || null;
  ball.wicket = wicket || false;
  ball.wicketType = wicketType || null;
  ball.dismissedBatsman = dismissedBatsman || null;
  
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
  
  if (saveMatch(match)) {
    res.json({ match });
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
