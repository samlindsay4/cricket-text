const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data storage (in-memory for now)
let matches = [];
let fixtures = [];

// Load initial data if exists
const dataDir = path.join(__dirname, 'data');
const matchesFile = path.join(dataDir, 'matches.json');
const fixturesFile = path.join(dataDir, 'fixtures.json');

function loadData() {
  try {
    if (fs.existsSync(matchesFile)) {
      matches = JSON.parse(fs.readFileSync(matchesFile, 'utf8'));
    }
    if (fs.existsSync(fixturesFile)) {
      fixtures = JSON.parse(fs.readFileSync(fixturesFile, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function saveData() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(matchesFile, JSON.stringify(matches, null, 2));
    fs.writeFileSync(fixturesFile, JSON.stringify(fixtures, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

loadData();

// Routes

// Get all fixtures
app.get('/api/fixtures', (req, res) => {
  res.json(fixtures);
});

// Create a new fixture
app.post('/api/fixtures', (req, res) => {
  const fixture = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  fixtures.push(fixture);
  saveData();
  res.status(201).json(fixture);
});

// Get all matches
app.get('/api/matches', (req, res) => {
  res.json(matches);
});

// Get a specific match
app.get('/api/matches/:id', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  res.json(match);
});

// Create a new match
app.post('/api/matches', (req, res) => {
  const match = {
    id: Date.now().toString(),
    teamA: req.body.teamA,
    teamB: req.body.teamB,
    venue: req.body.venue,
    date: req.body.date,
    tossWinner: null,
    tossDecision: null,
    innings: [],
    commentary: [],
    status: 'upcoming',
    createdAt: new Date().toISOString()
  };
  matches.push(match);
  saveData();
  res.status(201).json(match);
});

// Start a match
app.post('/api/matches/:id/start', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  match.status = 'live';
  match.tossWinner = req.body.tossWinner;
  match.tossDecision = req.body.tossDecision;
  
  // Initialize first innings
  const battingTeam = req.body.tossDecision === 'bat' ? req.body.tossWinner : 
                      (req.body.tossWinner === match.teamA ? match.teamB : match.teamA);
  const bowlingTeam = battingTeam === match.teamA ? match.teamB : match.teamA;
  
  match.innings.push({
    number: 1,
    battingTeam: battingTeam,
    bowlingTeam: bowlingTeam,
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    batsmen: [],
    bowlers: [],
    ballsArray: []
  });
  
  saveData();
  res.json(match);
});

// Add a ball to the match
app.post('/api/matches/:id/ball', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  if (!currentInnings) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const ball = {
    timestamp: new Date().toISOString(),
    batsman: req.body.batsman,
    bowler: req.body.bowler,
    runs: req.body.runs || 0,
    extras: req.body.extras || 0,
    extraType: req.body.extraType || null, // 'wide', 'noBall', 'bye', 'legBye'
    wicket: req.body.wicket || false,
    wicketType: req.body.wicketType || null,
    dismissedBatsman: req.body.dismissedBatsman || null,
    commentary: req.body.commentary || ''
  };
  
  // Update innings stats
  currentInnings.runs += ball.runs + ball.extras;
  
  if (ball.extraType === 'wide' || ball.extraType === 'noBall') {
    // Don't increment ball count for wides and no-balls
    if (ball.extraType === 'wide') currentInnings.extras.wides += ball.extras;
    if (ball.extraType === 'noBall') currentInnings.extras.noBalls += ball.extras;
  } else {
    currentInnings.balls++;
    if (currentInnings.balls % 6 === 0) {
      currentInnings.overs++;
      currentInnings.balls = 0;
    }
    if (ball.extraType === 'bye') currentInnings.extras.byes += ball.extras;
    if (ball.extraType === 'legBye') currentInnings.extras.legByes += ball.extras;
  }
  
  if (ball.wicket) {
    currentInnings.wickets++;
  }
  
  // Store the ball
  currentInnings.ballsArray.push(ball);
  
  // Add to commentary
  const overStr = `${currentInnings.overs}.${currentInnings.balls}`;
  let commentaryText = ball.commentary || `${ball.bowler} to ${ball.batsman}, ${ball.runs} run${ball.runs !== 1 ? 's' : ''}`;
  
  if (ball.wicket) {
    commentaryText = `WICKET! ${ball.dismissedBatsman || ball.batsman} ${ball.wicketType || 'out'}. ${commentaryText}`;
  }
  
  match.commentary.unshift({
    timestamp: ball.timestamp,
    over: overStr,
    text: commentaryText,
    runs: ball.runs,
    extras: ball.extras,
    wicket: ball.wicket
  });
  
  saveData();
  res.json({ match, ball });
});

// Add commentary
app.post('/api/matches/:id/commentary', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  const commentary = {
    timestamp: new Date().toISOString(),
    text: req.body.text,
    over: req.body.over || null
  };
  
  match.commentary.unshift(commentary);
  saveData();
  res.json(commentary);
});

// Get match scorecard
app.get('/api/matches/:id/scorecard', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  const scorecard = {
    matchId: match.id,
    teamA: match.teamA,
    teamB: match.teamB,
    venue: match.venue,
    date: match.date,
    status: match.status,
    innings: match.innings.map(inn => ({
      number: inn.number,
      battingTeam: inn.battingTeam,
      bowlingTeam: inn.bowlingTeam,
      score: `${inn.runs}/${inn.wickets}`,
      overs: `${inn.overs}.${inn.balls}`,
      extras: inn.extras
    }))
  };
  
  res.json(scorecard);
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cricket Text server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});
