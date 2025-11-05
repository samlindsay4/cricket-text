require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { connectDB, isConnected } = require('./config/database');
const syncService = require('./services/syncService');
const Match = require('./models/Match');

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

// Connect to MongoDB
connectDB().then(() => {
  // Start sync service only if database is connected
  if (isConnected()) {
    console.log('Database connected, starting sync service...');
    syncService.start();
  }
}).catch((error) => {
  console.log('Database connection failed, sync service will not start');
  console.log('Application will continue with file-based storage');
});

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

// Get all matches (supports both DB and file storage)
app.get('/api/matches', async (req, res) => {
  try {
    // Try to get from database first
    if (isConnected()) {
      const dbMatches = await Match.find({ source: 'manual' }).sort({ createdAt: -1 });
      if (dbMatches.length > 0) {
        return res.json(dbMatches);
      }
    }
    // Fallback to file storage
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.json(matches);
  }
});

// Get live matches from API
app.get('/api/matches/live', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Live matches require database connection' 
      });
    }

    const liveMatches = await Match.findLiveMatches();
    const internationalMatches = liveMatches.filter(match => match.isInternational());
    
    res.json(internationalMatches);
  } catch (error) {
    console.error('Error fetching live matches:', error);
    res.status(500).json({ error: 'Failed to fetch live matches' });
  }
});

// Get fixtures from API
app.get('/api/matches/fixtures', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Fixtures require database connection' 
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const upcomingMatches = await Match.findUpcomingMatches(limit);
    const internationalMatches = upcomingMatches.filter(match => match.isInternational());
    
    res.json(internationalMatches);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

// Get results from API
app.get('/api/matches/results', async (req, res) => {
  try {
    if (!isConnected()) {
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Results require database connection' 
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const completedMatches = await Match.findRecentResults(limit);
    const internationalMatches = completedMatches.filter(match => match.isInternational());
    
    res.json(internationalMatches);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get a specific match (supports both DB and file storage)
app.get('/api/matches/:id', async (req, res) => {
  try {
    // Try database first
    if (isConnected()) {
      const dbMatch = await Match.findOne({ id: req.params.id });
      if (dbMatch) {
        return res.json(dbMatch);
      }
    }
    
    // Fallback to file storage
    const match = matches.find(m => m.id === req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  } catch (error) {
    console.error('Error fetching match:', error);
    const match = matches.find(m => m.id === req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  }
});

// Create a new match (saves to both DB and file storage)
app.post('/api/matches', async (req, res) => {
  const matchData = {
    id: Date.now().toString(),
    teamA: req.body.teamA,
    teamB: req.body.teamB,
    venue: req.body.venue,
    date: req.body.date,
    format: req.body.format || 'Other',
    tossWinner: null,
    tossDecision: null,
    innings: [],
    commentary: [],
    status: 'upcoming',
    source: 'manual',
    createdAt: new Date().toISOString()
  };
  
  // Save to file storage
  matches.push(matchData);
  saveData();
  
  // Save to database if connected
  try {
    if (isConnected()) {
      const dbMatch = new Match(matchData);
      await dbMatch.save();
      return res.status(201).json(dbMatch);
    }
  } catch (error) {
    console.error('Error saving to database:', error);
  }
  
  res.status(201).json(matchData);
});

// Start a match (supports both DB and file storage)
app.post('/api/matches/:id/start', async (req, res) => {
  try {
    // Try database first
    if (isConnected()) {
      const dbMatch = await Match.findOne({ id: req.params.id });
      if (dbMatch) {
        dbMatch.status = 'live';
        dbMatch.tossWinner = req.body.tossWinner;
        dbMatch.tossDecision = req.body.tossDecision;
        
        // Initialize first innings
        const battingTeam = req.body.tossDecision === 'bat' ? req.body.tossWinner : 
                            (req.body.tossWinner === dbMatch.teamA ? dbMatch.teamB : dbMatch.teamA);
        const bowlingTeam = battingTeam === dbMatch.teamA ? dbMatch.teamB : dbMatch.teamA;
        
        dbMatch.innings.push({
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
        
        await dbMatch.save();
        
        // Also update file storage
        const fileMatch = matches.find(m => m.id === req.params.id);
        if (fileMatch) {
          Object.assign(fileMatch, {
            status: dbMatch.status,
            tossWinner: dbMatch.tossWinner,
            tossDecision: dbMatch.tossDecision,
            innings: dbMatch.innings.map(i => i.toObject())
          });
          saveData();
        }
        
        return res.json(dbMatch);
      }
    }
    
    // Fallback to file storage
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
  } catch (error) {
    console.error('Error starting match:', error);
    res.status(500).json({ error: 'Failed to start match' });
  }
});

// Add a ball to the match (supports both DB and file storage)
app.post('/api/matches/:id/ball', async (req, res) => {
  try {
    let match;
    let useDb = false;
    
    // Try database first
    if (isConnected()) {
      const dbMatch = await Match.findOne({ id: req.params.id });
      if (dbMatch) {
        match = dbMatch;
        useDb = true;
      }
    }
    
    // Fallback to file storage
    if (!match) {
      match = matches.find(m => m.id === req.params.id);
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
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
    
    // Save to database or file
    if (useDb) {
      match.lastUpdated = new Date();
      await match.save();
      
      // Also update file storage for backwards compatibility
      const fileMatch = matches.find(m => m.id === req.params.id);
      if (fileMatch) {
        Object.assign(fileMatch, {
          innings: match.innings.map(i => i.toObject ? i.toObject() : i),
          commentary: match.commentary
        });
        saveData();
      }
    } else {
      saveData();
    }
    
    res.json({ match, ball });
  } catch (error) {
    console.error('Error recording ball:', error);
    res.status(500).json({ error: 'Failed to record ball' });
  }
});

// Add commentary (supports both DB and file storage)
app.post('/api/matches/:id/commentary', async (req, res) => {
  try {
    let match;
    let useDb = false;
    
    // Try database first
    if (isConnected()) {
      const dbMatch = await Match.findOne({ id: req.params.id });
      if (dbMatch) {
        match = dbMatch;
        useDb = true;
      }
    }
    
    // Fallback to file storage
    if (!match) {
      match = matches.find(m => m.id === req.params.id);
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
    }
    
    const commentary = {
      timestamp: new Date().toISOString(),
      text: req.body.text,
      over: req.body.over || null
    };
    
    match.commentary.unshift(commentary);
    
    // Save to database or file
    if (useDb) {
      match.lastUpdated = new Date();
      await match.save();
      
      // Also update file storage
      const fileMatch = matches.find(m => m.id === req.params.id);
      if (fileMatch) {
        fileMatch.commentary = match.commentary;
        saveData();
      }
    } else {
      saveData();
    }
    
    res.json(commentary);
  } catch (error) {
    console.error('Error adding commentary:', error);
    res.status(500).json({ error: 'Failed to add commentary' });
  }
});

// Get match scorecard (supports both DB and file storage)
app.get('/api/matches/:id/scorecard', async (req, res) => {
  try {
    let match;
    
    // Try database first
    if (isConnected()) {
      const dbMatch = await Match.findOne({ id: req.params.id });
      if (dbMatch) {
        match = dbMatch;
      }
    }
    
    // Fallback to file storage
    if (!match) {
      match = matches.find(m => m.id === req.params.id);
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
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
  } catch (error) {
    console.error('Error fetching scorecard:', error);
    res.status(500).json({ error: 'Failed to fetch scorecard' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cricket Text server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  // Stop sync service
  syncService.stop();
  
  // Close database connection
  const { disconnectDB } = require('./config/database');
  await disconnectDB();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  
  // Stop sync service
  syncService.stop();
  
  // Close database connection
  const { disconnectDB } = require('./config/database');
  await disconnectDB();
  
  process.exit(0);
});
