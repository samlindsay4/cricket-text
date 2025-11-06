require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
      squads: {
        England: [
          "Ben Duckett", "Zak Crawley", "Ollie Pope", "Joe Root", "Harry Brook",
          "Ben Stokes", "Jamie Smith", "Chris Woakes", "Gus Atkinson", 
          "Mark Wood", "Jack Leach"
        ],
        Australia: [
          "Usman Khawaja", "David Warner", "Marnus Labuschagne", "Steve Smith",
          "Travis Head", "Cameron Green", "Alex Carey", "Pat Cummins",
          "Mitchell Starc", "Nathan Lyon", "Josh Hazlewood"
        ]
      }
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

// Simple session storage (in-memory for simplicity)
let sessions = {};

// Admin authentication
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'ashes2025';
  
  if (password === adminPassword) {
    const sessionId = Math.random().toString(36).substring(7);
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
app.get('/api/match', (req, res) => {
  const match = loadMatch();
  res.json(match);
});

// Create new Ashes test match (admin only)
app.post('/api/match/create', requireAuth, (req, res) => {
  const { testNumber, venue, date } = req.body;
  
  const match = {
    id: `ashes-test-${testNumber}`,
    title: `The Ashes - ${testNumber}${testNumber === 1 ? 'st' : testNumber === 2 ? 'nd' : testNumber === 3 ? 'rd' : 'th'} Test`,
    venue: venue,
    date: date,
    status: 'upcoming',
    currentInnings: 0,
    innings: [],
    squads: {
      England: [
        "Ben Duckett", "Zak Crawley", "Ollie Pope", "Joe Root", "Harry Brook",
        "Ben Stokes", "Jamie Smith", "Chris Woakes", "Gus Atkinson", 
        "Mark Wood", "Jack Leach"
      ],
      Australia: [
        "Usman Khawaja", "David Warner", "Marnus Labuschagne", "Steve Smith",
        "Travis Head", "Cameron Green", "Alex Carey", "Pat Cummins",
        "Mitchell Starc", "Nathan Lyon", "Josh Hazlewood"
      ]
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
  
  const { battingTeam, bowlingTeam } = req.body;
  
  const innings = {
    number: match.innings.length + 1,
    battingTeam: battingTeam,
    bowlingTeam: bowlingTeam,
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    declared: false,
    currentBatsmen: [],
    currentBowler: null,
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
    batsman1, batsman2, bowler, runs, extras, extraType, 
    wicket, wicketType, dismissedBatsman 
  } = req.body;
  
  // Calculate ball number within the over
  const ballInOver = currentInnings.balls + 1;
  const overNumber = currentInnings.overs;
  
  // Create ball record
  const ball = {
    over: overNumber,
    ball: ballInOver,
    batsman: batsman1,
    bowler: bowler,
    runs: parseInt(runs) || 0,
    extras: parseInt(extras) || 0,
    extraType: extraType || null,
    wicket: wicket || false,
    wicketType: wicketType || null,
    dismissedBatsman: dismissedBatsman || null,
    timestamp: new Date().toISOString()
  };
  
  // Update current batsmen
  currentInnings.currentBatsmen = [
    { name: batsman1, runs: 0, balls: 0, fours: 0, sixes: 0 },
    { name: batsman2, runs: 0, balls: 0, fours: 0, sixes: 0 }
  ];
  
  // Update current bowler
  currentInnings.currentBowler = {
    name: bowler,
    overs: 0,
    maidens: 0,
    runs: 0,
    wickets: 0
  };
  
  // Update innings totals
  const totalRuns = ball.runs + ball.extras;
  currentInnings.runs += totalRuns;
  
  // Handle wickets
  if (ball.wicket) {
    currentInnings.wickets++;
    currentInnings.fallOfWickets.push({
      runs: currentInnings.runs,
      wickets: currentInnings.wickets,
      batsman: ball.dismissedBatsman || ball.batsman
    });
  }
  
  // Update ball count (wides and no-balls don't count as legal deliveries)
  if (extraType !== 'Wd' && extraType !== 'Nb') {
    currentInnings.balls++;
    
    // Check if over is complete
    if (currentInnings.balls === 6) {
      currentInnings.overs++;
      currentInnings.balls = 0;
      
      // Store completed over in recent overs
      if (!currentInnings.recentOvers) {
        currentInnings.recentOvers = [];
      }
      currentInnings.recentOvers.push({
        over: currentInnings.overs - 1,
        runs: currentInnings.currentOver.reduce((sum, b) => sum + b.runs + b.extras, 0)
      });
      
      // Keep only last 10 overs
      if (currentInnings.recentOvers.length > 10) {
        currentInnings.recentOvers.shift();
      }
      
      // Clear current over
      currentInnings.currentOver = [];
    }
    
    // Add ball to current over
    currentInnings.currentOver.push(ball);
  } else {
    // For wides and no-balls, still track but don't increment ball count
    currentInnings.currentOver.push(ball);
  }
  
  // Store in all balls
  currentInnings.allBalls.push(ball);
  
  if (saveMatch(match)) {
    res.json({ match, ball });
  } else {
    res.status(500).json({ error: 'Failed to record ball' });
  }
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve main page (Page 340)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cricket Text - Ashes Scoring App`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Public scorecard: http://localhost:${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin`);
});
