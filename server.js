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
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const seriesDir = path.join(dataDir, 'series');
const matchFile = path.join(dataDir, 'match.json');
const seriesFile = path.join(dataDir, 'series.json');
const newsFile = path.join(dataDir, 'news.json');
const pageRegistryFile = path.join(dataDir, 'page-registry.json');
const aboutFile = path.join(dataDir, 'about.json');

// Helper function to check if player is unavailable
function isPlayerUnavailable(status) {
  return status === 'out' || status === 'retired hurt' || status === 'retired out' || status === 'retired not out';
}

// Ensure data directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(seriesDir)) {
  fs.mkdirSync(seriesDir, { recursive: true });
}

// Initialize empty files if they don't exist
function initializeDataFiles() {
  if (!fs.existsSync(newsFile)) {
    fs.writeFileSync(newsFile, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(pageRegistryFile)) {
    fs.writeFileSync(pageRegistryFile, JSON.stringify({ "340": { "title": "Cricket Homepage", "type": "homepage" } }, null, 2));
  }
  if (!fs.existsSync(aboutFile)) {
    fs.writeFileSync(aboutFile, JSON.stringify({
      title: "About TELETEST",
      content: "Welcome to TELETEST - your source for live cricket scores and news."
    }, null, 2));
  }
}

initializeDataFiles();

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

// Series management functions
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

function createDefaultSeries() {
  return {
    name: "The Ashes 2025",
    matches: [
      {
        id: "ashes-test-1",
        title: "1st Test",
        venue: "The Gabba, Brisbane",
        date: "2025-11-21",
        status: "upcoming"
      },
      {
        id: "ashes-test-2",
        title: "2nd Test",
        venue: "Adelaide Oval",
        date: "2025-12-06",
        status: "upcoming"
      },
      {
        id: "ashes-test-3",
        title: "3rd Test",
        venue: "The WACA, Perth",
        date: "2025-12-14",
        status: "upcoming"
      },
      {
        id: "ashes-test-4",
        title: "4th Test",
        venue: "MCG, Melbourne",
        date: "2025-12-26",
        status: "upcoming"
      },
      {
        id: "ashes-test-5",
        title: "5th Test",
        venue: "SCG, Sydney",
        date: "2026-01-03",
        status: "upcoming"
      }
    ],
    currentMatch: null,
    seriesScore: {
      England: 0,
      Australia: 0
    }
  };
}

function loadSeries() {
  try {
    if (!fs.existsSync(seriesFile)) {
      const defaultSeries = createDefaultSeries();
      saveSeries(defaultSeries);
      return defaultSeries;
    }
    const data = fs.readFileSync(seriesFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading series:', error);
    return createDefaultSeries();
  }
}

function saveSeries(series) {
  try {
    fs.writeFileSync(seriesFile, JSON.stringify(series, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving series:', error);
    return false;
  }
}

function loadMatchById(matchId) {
  try {
    // Validate matchId to prevent path traversal
    if (!matchId || typeof matchId !== 'string') {
      return null;
    }
    
    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9\-_]+$/.test(matchId)) {
      console.error('Invalid matchId format:', matchId);
      return null;
    }
    
    const matchPath = path.join(dataDir, `${matchId}.json`);
    
    // Additional security: ensure the resolved path is within dataDir
    const resolvedPath = path.resolve(matchPath);
    const resolvedDataDir = path.resolve(dataDir);
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      console.error('Path traversal attempt detected:', matchId);
      return null;
    }
    
    if (!fs.existsSync(matchPath)) {
      return null;
    }
    const data = fs.readFileSync(matchPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading match:', error);
    return null;
  }
}

function saveMatchById(matchId, match) {
  try {
    // Validate matchId to prevent path traversal
    if (!matchId || typeof matchId !== 'string') {
      return false;
    }
    
    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9\-_]+$/.test(matchId)) {
      console.error('Invalid matchId format:', matchId);
      return false;
    }
    
    const matchPath = path.join(dataDir, `${matchId}.json`);
    
    // Additional security: ensure the resolved path is within dataDir
    const resolvedPath = path.resolve(matchPath);
    const resolvedDataDir = path.resolve(dataDir);
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      console.error('Path traversal attempt detected:', matchId);
      return false;
    }
    
    fs.writeFileSync(matchPath, JSON.stringify(match, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving match:', error);
    return false;
  }
}

function updateSeriesMatchStatus(matchId, match) {
  try {
    // Update legacy series.json
    const series = loadSeries();
    const matchIndex = series.matches.findIndex(m => m.id === matchId);
    
    if (matchIndex !== -1) {
      const seriesMatch = series.matches[matchIndex];
      seriesMatch.status = match.status;
      seriesMatch.venue = match.venue;
      seriesMatch.date = match.date;
      
      // Update result if match completed
      if (match.status === 'completed' && match.result) {
        let resultText;
        
        // Handle different result types
        if (match.result.winType === 'draw') {
          resultText = 'Match drawn';
        } else if (match.result.winType === 'tie') {
          resultText = 'Match tied';
        } else if (match.result.winner) {
          // Safely construct result string with null checks
          const margin = match.result.margin || 0;
          const winType = match.result.winType || 'unknown';
          resultText = `${match.result.winner} won by ${margin} ${winType}`;
        }
        
        // Only update series score if this is a new result (not already counted)
        if (resultText && seriesMatch.result !== resultText) {
          seriesMatch.result = resultText;
          
          // Update series score only if not already counted and there's a winner
          if (match.result.winner === 'England') {
            series.seriesScore.England++;
          } else if (match.result.winner === 'Australia') {
            series.seriesScore.Australia++;
          }
        }
      }
      
      saveSeries(series);
    }
    
    // Also update new series directory if match has seriesId
    if (match.seriesId) {
      const newSeries = loadSeriesById(match.seriesId);
      if (newSeries && newSeries.matches) {
        const newMatchIndex = newSeries.matches.findIndex(m => m.id === matchId);
        
        if (newMatchIndex !== -1) {
          const newSeriesMatch = newSeries.matches[newMatchIndex];
          newSeriesMatch.status = match.status;
          newSeriesMatch.venue = match.venue;
          newSeriesMatch.date = match.date;
          
          // Update result if match completed
          if (match.status === 'completed' && match.result) {
            const margin = match.result.margin || 0;
            const winType = match.result.winType || 'unknown';
            
            // Format result text based on win type
            let resultText;
            if (winType === 'draw') {
              resultText = 'Match drawn';
            } else if (winType === 'tie') {
              resultText = 'Match tied';
            } else if (match.result.winner) {
              resultText = `${match.result.winner} won by ${margin} ${winType}`;
            }
            
            // Only update series score if this is a new result (not already counted)
            if (resultText && newSeriesMatch.result !== resultText) {
              newSeriesMatch.result = resultText;
              
              // Update series score only if not already counted and not a tie or draw
              if (winType !== 'tie' && winType !== 'draw' && match.result.winner) {
                if (!newSeries.seriesScore) {
                  newSeries.seriesScore = {};
                  newSeries.seriesScore[newSeries.team1] = 0;
                  newSeries.seriesScore[newSeries.team2] = 0;
                }
                
                if (match.result.winner === newSeries.team1) {
                  newSeries.seriesScore[newSeries.team1]++;
                } else if (match.result.winner === newSeries.team2) {
                  newSeries.seriesScore[newSeries.team2]++;
                }
              }
            }
          }
          
          saveSeriesById(match.seriesId, newSeries);
        }
      }
    }
  } catch (error) {
    console.error('Error updating series match status:', error);
  }
}

// ===== NEW SERIES MANAGEMENT SYSTEM =====

// Load all series from series directory
function loadAllSeries() {
  try {
    if (!fs.existsSync(seriesDir)) {
      return [];
    }
    const seriesDirs = fs.readdirSync(seriesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    const allSeries = [];
    for (const dirName of seriesDirs) {
      const seriesJsonPath = path.join(seriesDir, dirName, 'series.json');
      if (fs.existsSync(seriesJsonPath)) {
        const data = fs.readFileSync(seriesJsonPath, 'utf8');
        const series = JSON.parse(data);
        series.dirName = dirName;
        allSeries.push(series);
      }
    }
    return allSeries;
  } catch (error) {
    console.error('Error loading all series:', error);
    return [];
  }
}

// Load a specific series by ID
function loadSeriesById(seriesId) {
  try {
    // Validate seriesId to prevent path traversal
    if (!seriesId || typeof seriesId !== 'string' || !/^[a-zA-Z0-9\-_]+$/.test(seriesId)) {
      return null;
    }
    
    const seriesPath = path.join(seriesDir, seriesId, 'series.json');
    const resolvedPath = path.resolve(seriesPath);
    const resolvedSeriesDir = path.resolve(seriesDir);
    
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      console.error('Path traversal attempt detected:', seriesId);
      return null;
    }
    
    if (!fs.existsSync(seriesPath)) {
      return null;
    }
    
    const data = fs.readFileSync(seriesPath, 'utf8');
    const series = JSON.parse(data);
    series.id = seriesId;
    return series;
  } catch (error) {
    console.error('Error loading series:', error);
    return null;
  }
}

// Save a series
function saveSeriesById(seriesId, series) {
  try {
    // Validate seriesId
    if (!seriesId || typeof seriesId !== 'string' || !/^[a-zA-Z0-9\-_]+$/.test(seriesId)) {
      return false;
    }
    
    const seriesDirPath = path.join(seriesDir, seriesId);
    const seriesPath = path.join(seriesDirPath, 'series.json');
    const resolvedPath = path.resolve(seriesPath);
    const resolvedSeriesDir = path.resolve(seriesDir);
    
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      console.error('Path traversal attempt detected:', seriesId);
      return false;
    }
    
    // Create series directory if doesn't exist
    if (!fs.existsSync(seriesDirPath)) {
      fs.mkdirSync(seriesDirPath, { recursive: true });
    }
    
    fs.writeFileSync(seriesPath, JSON.stringify(series, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving series:', error);
    return false;
  }
}

// Load match from series directory
function loadSeriesMatch(seriesId, matchId) {
  try {
    // Validate IDs
    if (!seriesId || !matchId || typeof seriesId !== 'string' || typeof matchId !== 'string') {
      return null;
    }
    if (!/^[a-zA-Z0-9\-_]+$/.test(seriesId) || !/^[a-zA-Z0-9\-_]+$/.test(matchId)) {
      return null;
    }
    
    const matchPath = path.join(seriesDir, seriesId, `${matchId}.json`);
    const resolvedPath = path.resolve(matchPath);
    const resolvedSeriesDir = path.resolve(seriesDir);
    
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      console.error('Path traversal attempt detected');
      return null;
    }
    
    if (!fs.existsSync(matchPath)) {
      return null;
    }
    
    const data = fs.readFileSync(matchPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading series match:', error);
    return null;
  }
}

// Save match to series directory
function saveSeriesMatch(seriesId, matchId, match) {
  try {
    // Validate IDs
    if (!seriesId || !matchId || typeof seriesId !== 'string' || typeof matchId !== 'string') {
      return false;
    }
    if (!/^[a-zA-Z0-9\-_]+$/.test(seriesId) || !/^[a-zA-Z0-9\-_]+$/.test(matchId)) {
      return false;
    }
    
    const matchPath = path.join(seriesDir, seriesId, `${matchId}.json`);
    const resolvedPath = path.resolve(matchPath);
    const resolvedSeriesDir = path.resolve(seriesDir);
    
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      console.error('Path traversal attempt detected');
      return false;
    }
    
    fs.writeFileSync(matchPath, JSON.stringify(match, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving series match:', error);
    return false;
  }
}

// Helper function to check if bowling figures are better
function isBetterBowlingFigures(wickets, runs, bestFigures) {
  return wickets > bestFigures.wickets || 
         (wickets === bestFigures.wickets && runs < bestFigures.runs);
}

// Calculate series statistics (leading run scorers and wicket takers)
function calculateSeriesStats(seriesId) {
  try {
    const series = loadSeriesById(seriesId);
    if (!series || !series.matches) {
      return;
    }
    
    const batsmen = {};
    const bowlers = {};
    
    // Aggregate stats from all matches
    for (const matchInfo of series.matches) {
      const match = loadSeriesMatch(seriesId, matchInfo.id);
      if (!match || !match.innings) {
        continue;
      }
      
      // Process each innings
      for (const innings of match.innings) {
        if (!innings.allBatsmen || !innings.allBowlers) {
          continue;
        }
        
        // Aggregate batsmen stats
        Object.entries(innings.allBatsmen).forEach(([name, stats]) => {
          // Use name+team as key to handle players with same name on different teams
          const key = `${name}|${innings.battingTeam}`;
          
          if (!batsmen[key]) {
            batsmen[key] = {
              name,
              team: innings.battingTeam,
              runs: 0,
              innings: 0,
              notOuts: 0,
              highScore: 0,
              highScoreNotOut: false,
              hundreds: 0,
              fifties: 0,
              balls: 0,
              fours: 0,
              sixes: 0
            };
          }
          
          batsmen[key].runs += stats.runs || 0;
          batsmen[key].balls += stats.balls || 0;
          batsmen[key].fours += stats.fours || 0;
          batsmen[key].sixes += stats.sixes || 0;
          batsmen[key].innings++;
          
          if (stats.status === 'not out' || stats.status === 'batting') {
            batsmen[key].notOuts++;
          }
          
          const runsInInnings = stats.runs || 0;
          if (runsInInnings > batsmen[key].highScore) {
            batsmen[key].highScore = runsInInnings;
            batsmen[key].highScoreNotOut = (stats.status === 'not out' || stats.status === 'batting');
          }
          
          if (runsInInnings >= 100) {
            batsmen[key].hundreds++;
          } else if (runsInInnings >= 50) {
            batsmen[key].fifties++;
          }
        });
        
        // Aggregate bowler stats
        Object.entries(innings.allBowlers).forEach(([name, stats]) => {
          // Use name+team as key to handle players with same name on different teams
          const key = `${name}|${innings.bowlingTeam}`;
          
          if (!bowlers[key]) {
            bowlers[key] = {
              name,
              team: innings.bowlingTeam,
              wickets: 0,
              runs: 0,
              balls: 0,
              overs: 0,
              maidens: 0,
              bestFigures: { wickets: 0, runs: 999 },
              fiveWickets: 0,
              tenWickets: 0
            };
          }
          
          const wicketsInInnings = stats.wickets || 0;
          const runsInInnings = stats.runs || 0;
          
          bowlers[key].wickets += wicketsInInnings;
          bowlers[key].runs += runsInInnings;
          bowlers[key].balls += stats.balls || 0;
          bowlers[key].overs += stats.overs || 0;
          bowlers[key].maidens += stats.maidens || 0;
          
          // Track best figures using helper function
          if (isBetterBowlingFigures(wicketsInInnings, runsInInnings, bowlers[key].bestFigures)) {
            bowlers[key].bestFigures = { wickets: wicketsInInnings, runs: runsInInnings };
          }
          
          if (wicketsInInnings >= 5) {
            bowlers[key].fiveWickets++;
          }
        });
      }
    }
    
    // Calculate averages
    Object.values(batsmen).forEach(b => {
      const dismissals = b.innings - b.notOuts;
      b.average = dismissals > 0 ? (b.runs / dismissals).toFixed(2) : '-';
    });
    
    Object.values(bowlers).forEach(b => {
      b.average = b.wickets > 0 ? (b.runs / b.wickets).toFixed(2) : '-';
    });
    
    // Sort and store
    series.stats = {
      batsmen: Object.values(batsmen).sort((a, b) => b.runs - a.runs),
      bowlers: Object.values(bowlers).sort((a, b) => b.wickets - a.wickets)
    };
    
    saveSeriesById(seriesId, series);
  } catch (error) {
    console.error('Error calculating series stats:', error);
  }
}

// News management functions
function loadNews() {
  try {
    const data = fs.readFileSync(newsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading news:', error);
    return [];
  }
}

function saveNews(news) {
  try {
    fs.writeFileSync(newsFile, JSON.stringify(news, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving news:', error);
    return false;
  }
}

// Homepage configuration functions
const homepageFile = path.join(__dirname, 'data', 'homepage.json');

function loadHomepage() {
  try {
    const data = fs.readFileSync(homepageFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading homepage:', error);
    return { sections: [] };
  }
}

function saveHomepage(config) {
  try {
    fs.writeFileSync(homepageFile, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving homepage:', error);
    return false;
  }
}

// Page registry functions
function loadPageRegistry() {
  try {
    const data = fs.readFileSync(pageRegistryFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading page registry:', error);
    return { "340": { "title": "Cricket Homepage", "type": "homepage" } };
  }
}

function savePageRegistry(registry) {
  try {
    fs.writeFileSync(pageRegistryFile, JSON.stringify(registry, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving page registry:', error);
    return false;
  }
}

// ===== END NEW SERIES MANAGEMENT SYSTEM =====


// Helper to save both to legacy match.json and new match file
function saveCurrentMatch(match) {
  if (!match || !match.id) {
    return saveMatch(match);
  }
  
  // Save to both locations
  const legacySaved = saveMatch(match);
  const newSaved = saveMatchById(match.id, match);
  updateSeriesMatchStatus(match.id, match);
  
  return legacySaved && newSaved;
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
  
  // BUG FIX #4: Initialize bowling ends tracking if not present
  if (!innings.bowlingEnds) {
    innings.bowlingEnds = {};
  }
  if (!innings.currentEnd) {
    innings.currentEnd = 'End A';
  }
  
  // Track which end this bowler is bowling from
  innings.bowlingEnds[ball.bowler] = innings.currentEnd;
  
  // Increment ball count and check over complete
  if (isLegal) {
    innings.balls++;
    
    if (innings.balls === 6) {
      innings.overs++;
      innings.balls = 0;
      
      // Update bowler overs
      const bowlerBalls = innings.allBowlers[ball.bowler].balls;
      innings.allBowlers[ball.bowler].overs = Math.floor(bowlerBalls / 6);
      
      // Calculate runs conceded in this over to determine if it's a maiden
      let runsInOver = 0;
      for (const b of innings.currentOver) {
        if (b.extraType === 'Wd' || b.extraType === 'Nb') {
          runsInOver += (b.runs + b.overthrows + b.extras);
        } else if (b.extraType === 'Bye' || b.extraType === 'B' || b.extraType === 'LB') {
          runsInOver += (b.runs + b.overthrows);
        } else {
          runsInOver += (b.runs + b.overthrows);
        }
      }
      
      console.log(`Over complete - Bowler: ${ball.bowler}, Runs in over: ${runsInOver}`);
      
      // If 0 runs conceded, it's a maiden
      if (runsInOver === 0) {
        if (!innings.allBowlers[ball.bowler].maidens) {
          innings.allBowlers[ball.bowler].maidens = 0;
        }
        innings.allBowlers[ball.bowler].maidens++;
        console.log(`MAIDEN! ${ball.bowler} now has ${innings.allBowlers[ball.bowler].maidens} maiden(s)`);
      }
      
      // Track last bowler at each end
      if (!innings.lastBowlerAtEnd) {
        innings.lastBowlerAtEnd = {};
      }
      innings.lastBowlerAtEnd[innings.currentEnd] = ball.bowler;
      
      // Store last completed over with full ball details
      const overRuns = innings.currentOver.reduce((sum, b) => sum + b.runs + (b.overthrows || 0) + b.extras, 0);
      innings.lastCompletedOver = {
        overNum: innings.overs,
        bowler: ball.bowler,
        end: innings.currentEnd,
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
      
      // BUG FIX #4: Switch ends after over completes
      innings.currentEnd = (innings.currentEnd === 'End A') ? 'End B' : 'End A';
      
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
  
  // BUG FIX #10: Update lead/trail during 2nd innings from BATTING TEAM perspective
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
    
    // Update lead/trail situation FROM BATTING TEAM PERSPECTIVE
    // The batting team (team 2) is either leading or trailing
    if (team2Score > team1Score) {
      match.matchSituation.lead = innings2.battingTeam;
      match.matchSituation.leadBy = team2Score - team1Score;
    } else if (team1Score > team2Score) {
      match.matchSituation.lead = innings1.battingTeam;
      match.matchSituation.leadBy = deficit;
    } else {
      match.matchSituation.lead = null;
      match.matchSituation.leadBy = 0;
    }
  }
  
  // BUG FIX #10: Calculate target during 3rd innings from BATTING TEAM perspective
  if (innings.length >= 3) {
    const innings1 = innings[0];
    const innings2 = innings[1];
    const innings3 = innings[2];
    
    // Team that batted first's total (innings 1 + innings 3 if applicable)
    const team1Total = innings1.runs + (innings3.battingTeam === innings1.battingTeam ? innings3.runs : 0);
    
    // Team that batted second's total (innings 2 + innings 3 if applicable)
    const team2Total = innings2.runs + (innings3.battingTeam === innings2.battingTeam ? innings3.runs : 0);
    
    // Calculate lead from batting team perspective
    if (innings3.battingTeam === innings1.battingTeam) {
      // Team 1 batting again (after enforcing follow-on)
      if (team1Total > team2Total) {
        match.matchSituation.lead = innings1.battingTeam;
        match.matchSituation.leadBy = team1Total - team2Total;
      } else {
        match.matchSituation.lead = innings2.battingTeam;
        match.matchSituation.leadBy = team2Total - team1Total;
      }
    } else {
      // Team 2 batting again (normal or after follow-on)
      if (team2Total > team1Total) {
        match.matchSituation.lead = innings2.battingTeam;
        match.matchSituation.leadBy = team2Total - team1Total;
      } else {
        match.matchSituation.lead = innings1.battingTeam;
        match.matchSituation.leadBy = team1Total - team2Total;
      }
    }
  }
  
  // BUG FIX #10: Update chase situation during 4th innings from BATTING TEAM perspective
  if (innings.length === 4) {
    const innings4 = innings[3];
    const innings1 = innings[0];
    const innings2 = innings[1];
    const innings3 = innings[2];
    
    // Calculate total scores
    const team1Total = innings1.runs + (innings3.battingTeam === innings1.battingTeam ? innings3.runs : 0);
    const team2Total = innings2.runs + (innings4.battingTeam === innings2.battingTeam ? innings4.runs : 0);
    
    // BUG FIX: Target should be deficit + 1, not opponent's total + 1
    // In Test cricket, team batting 4th needs to overcome the deficit from their first innings
    // Example: TeamA: 26 (15+11), TeamB: 8 → deficit is 18, target is 19 (not 27)
    let opponentTotal, yourFirstInnings;
    if (innings4.battingTeam === innings1.battingTeam) {
      // Team1 batting in 4th innings (rare, only after follow-on)
      opponentTotal = team2Total;
      yourFirstInnings = innings1.runs;
    } else {
      // Team2 batting in 4th innings (normal case)
      opponentTotal = team1Total;
      yourFirstInnings = innings2.runs;
    }
    
    const target = opponentTotal - yourFirstInnings + 1;
    match.matchSituation.target = target;
    match.matchSituation.toWin = target - innings4.runs;
    
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
  
  // BUG FIX #5: Innings victory after 3rd innings (follow-on or normal scenario)
  if (innings.length === 3 && innings[2].status === 'completed' && innings[2].wickets >= 10) {
    // Check if one team batted once and the other batted twice
    const team1 = innings[0].battingTeam;
    const team2 = innings[1].battingTeam;
    
    // Determine which team batted twice in innings 1&2 vs 2&3
    const innings2Team = innings[1].battingTeam;
    const innings3Team = innings[2].battingTeam;
    
    if (innings2Team === innings3Team) {
      // Same team batted in innings 2 and 3 (follow-on or consecutive)
      const battedTwiceTeam = innings2Team;
      const battedOnceTeam = team1 === battedTwiceTeam ? team2 : team1;
      
      // Get totals
      const battedOnceTotalIdx = team1 === battedOnceTeam ? 0 : 1;
      const battedOnceTotal = innings[battedOnceTotalIdx].runs;
      const battedTwiceTotal = innings[1].runs + innings[2].runs;
      
      // Check for innings victory
      if (battedOnceTotal > battedTwiceTotal) {
        match.result.status = 'completed';
        match.result.winner = battedOnceTeam;
        match.result.winType = 'innings';
        match.result.margin = battedOnceTotal - battedTwiceTotal;
        match.status = 'completed';
      }
    }
  }
  
  // BUG FIX #5: Match can end after 4 innings
  if (innings.length === 4 && (innings[3].status === 'completed' || innings[3].wickets >= 10)) {
    const innings4 = innings[3];
    const target = match.matchSituation.target || 0;
    
    // Check for tie first
    if (innings4.runs === target - 1 && innings4.wickets >= 10) {
      // Scores are level and team is all out - it's a tie!
      match.result.status = 'completed';
      match.result.winner = null;
      match.result.winType = 'tie';
      match.result.margin = 0;
      match.status = 'completed';
    } else if (innings4.runs >= target) {
      // Batting team won
      match.result.status = 'completed';
      match.result.winner = innings4.battingTeam;
      match.result.winType = 'wickets';
      match.result.margin = 10 - innings4.wickets;
      match.status = 'completed';
    } else {
      // Bowling team won - check if it's an innings victory
      const innings1 = innings[0];
      const innings2 = innings[1];
      const innings3 = innings[2];
      
      // Calculate total scores for both teams
      const team1Total = innings1.runs + (innings3.battingTeam === innings1.battingTeam ? innings3.runs : 0);
      const team2Total = innings2.runs + (innings4.battingTeam === innings2.battingTeam ? innings4.runs : 0);
      
      match.result.status = 'completed';
      match.result.winner = innings4.bowlingTeam;
      
      // Check if it's an innings victory
      // For innings victory: winning team must have batted ONCE, losing team batted TWICE
      const team1BattedTwice = innings3.battingTeam === innings1.battingTeam;
      const team2BattedTwice = innings4.battingTeam === innings2.battingTeam;
      
      if (team2BattedTwice && !team1BattedTwice && team2Total < innings1.runs) {
        // Team 2 batted twice (2nd & 4th), Team 1 batted once (1st only)
        // Team 2 couldn't match Team 1's single innings
        match.result.winType = 'innings';
        match.result.margin = innings1.runs - team2Total;
      } else if (team1BattedTwice && !team2BattedTwice && team1Total < innings2.runs) {
        // Team 1 batted twice (1st & 3rd), Team 2 batted once (2nd only)
        // Team 1 couldn't match Team 2's single innings
        match.result.winType = 'innings';
        match.result.margin = innings2.runs - team1Total;
      } else {
        // Normal runs victory - both teams batted twice OR deficit not an innings
        match.result.winType = 'runs';
        match.result.margin = target - innings4.runs - 1;
      }
      
      match.status = 'completed';
    }
  }
  
  // BUG FIX #5: REMOVED - Do NOT declare innings victory after just 2 innings
  // After 2nd innings ends, the match must continue to 3rd innings (follow-on or normal)
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

// Get series information
app.get('/api/series', checkRateLimit, (req, res) => {
  const series = loadSeries();
  res.json(series);
});

// Get specific match by ID
app.get('/api/match/:matchId', checkRateLimit, (req, res) => {
  const { matchId } = req.params;
  const match = loadMatchById(matchId);
  if (match) {
    res.json(match);
  } else {
    res.status(404).json({ error: 'Match not found' });
  }
});

// Switch active match
app.post('/api/match/switch', requireAuth, (req, res) => {
  const { matchId } = req.body;
  const match = loadMatchById(matchId);
  
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  // Update series current match
  const series = loadSeries();
  series.currentMatch = matchId;
  saveSeries(series);
  
  // Also save to legacy match.json for backward compatibility
  saveMatch(match);
  
  res.json({ success: true, match });
});

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
    title: `The Ashes - ${testNumber}${getOrdinalSuffix(testNumber)} Test`,
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
  
  // Save to individual match file
  const matchId = match.id;
  if (saveMatchById(matchId, match)) {
    // Also save to legacy match.json for backward compatibility
    saveMatch(match);
    
    // Update series
    const series = loadSeries();
    const matchIndex = series.matches.findIndex(m => m.id === matchId);
    if (matchIndex !== -1) {
      series.matches[matchIndex].status = 'upcoming';
      series.matches[matchIndex].venue = venue;
      series.matches[matchIndex].date = date;
    }
    series.currentMatch = matchId;
    saveSeries(series);
    
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
    recentOvers: [], // Store last 5-10 overs
    lastCompletedOver: null // BUG FIX #1: Initialize to null, will be set after first over completes
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
  
  if (saveCurrentMatch(match)) {
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
        name: bowler, balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
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
      name: currentBowlerName, balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
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
      
      // Calculate runs conceded in this over to determine if it's a maiden
      // A maiden is an over where the bowler conceded 0 runs (no runs off bat, no wides, no no-balls)
      // Byes and leg-byes don't count against the bowler
      let runsInOver = 0;
      for (const b of currentInnings.currentOver) {
        if (b.extraType === 'Wd' || b.extraType === 'Nb') {
          // Wide or no-ball: count runs, overthrows, and extras against bowler
          runsInOver += (b.runs + b.overthrows + b.extras);
        } else if (b.extraType === 'Bye' || b.extraType === 'B' || b.extraType === 'LB') {
          // Byes/leg-byes: only overthrows go against bowler
          runsInOver += (b.runs + b.overthrows);
        } else {
          // Normal delivery: runs off bat plus overthrows
          runsInOver += (b.runs + b.overthrows);
        }
      }
      
      // If 0 runs conceded, it's a maiden
      if (runsInOver === 0) {
        if (!currentInnings.allBowlers[currentBowlerName].maidens) {
          currentInnings.allBowlers[currentBowlerName].maidens = 0;
        }
        currentInnings.allBowlers[currentBowlerName].maidens++;
      }
      
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
    calculateMatchResult(match);
  }
  
  // If 4 innings complete, mark match as completed
  if (match.innings.length >= 4) {
    match.status = 'completed';
  }
  
  if (saveCurrentMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to end innings' });
  }
});

// Update match day
app.post('/api/match/update-day', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  const { day } = req.body;
  if (!day || day < 1 || day > 5) {
    return res.status(400).json({ error: 'Invalid day number' });
  }
  
  match.day = day;
  
  if (saveCurrentMatch(match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to update day' });
  }
});

// Update match message
app.post('/api/match/update-message', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  const { message } = req.body;
  match.message = message || '';
  
  if (saveCurrentMatch(match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Change batsmen
app.post('/api/match/change-batsmen', requireAuth, (req, res) => {
  const match = loadMatch();
  if (!match || !match.id) {
    return res.status(404).json({ error: 'No match found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { striker, nonStriker } = req.body;
  
  if (!striker || !nonStriker) {
    return res.status(400).json({ error: 'Both striker and non-striker required' });
  }
  
  if (striker === nonStriker) {
    return res.status(400).json({ error: 'Striker and non-striker must be different' });
  }
  
  // Update batsmen
  currentInnings.striker = striker;
  currentInnings.nonStriker = nonStriker;
  
  // Initialize batsmen in allBatsmen if they don't exist
  if (!currentInnings.allBatsmen[striker]) {
    currentInnings.allBatsmen[striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' };
  }
  if (!currentInnings.allBatsmen[nonStriker]) {
    currentInnings.allBatsmen[nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' };
  }
  
  if (saveCurrentMatch(match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to change batsmen' });
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
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
  
  if (saveCurrentMatch(match)) {
    res.json({ match });
  } else {
    res.status(500).json({ error: 'Failed to retire batsman' });
  }
});

// ===== NEW API ENDPOINTS =====

// Create new series
app.post('/api/series/create', requireAuth, (req, res) => {
  const { name, team1, team2, numMatches, priority } = req.body;
  
  // Validate inputs
  if (!name || !team1 || !team2 || !numMatches || !priority) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (numMatches < 1 || numMatches > 5) {
    return res.status(400).json({ error: 'Number of matches must be between 1 and 5' });
  }
  
  // Calculate start page based on priority
  // Priority 1: pages 341-350 (10 pages)
  // Priority 2: pages 351-360 (10 pages)
  // Priority 3: pages 361-370 (10 pages)
  // etc.
  const startPage = 340 + (priority * 10);
  const endPage = startPage + 9; // 10 pages per series
  
  // Create series ID from name
  const seriesId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Check if series already exists
  if (loadSeriesById(seriesId)) {
    return res.status(400).json({ error: 'Series with this name already exists' });
  }
  
  // Check page number conflicts
  const registry = loadPageRegistry();
  const pagesToRegister = [];
  
  // Each series gets 10 pages
  for (let i = 0; i <= 9; i++) {
    const pageNum = (startPage + i).toString();
    if (registry[pageNum]) {
      return res.status(400).json({ 
        error: `Page ${pageNum} is already assigned to: ${registry[pageNum].title}. Priority ${priority} is taken.` 
      });
    }
    pagesToRegister.push(pageNum);
  }
  
  // Create series object
  const series = {
    name,
    team1,
    team2,
    priority: parseInt(priority),
    startPage,
    endPage,
    seriesScore: {},
    matches: [],
    stats: {
      batsmen: [],
      bowlers: []
    },
    createdAt: new Date().toISOString()
  };
  
  series.seriesScore[team1] = 0;
  series.seriesScore[team2] = 0;
  
  // Create match placeholders
  for (let i = 1; i <= numMatches; i++) {
    series.matches.push({
      id: `${seriesId}-match-${i}`,
      number: i,
      title: `${i}${getOrdinalSuffix(i)} Test`,
      venue: null,
      date: null,
      status: 'upcoming',
      result: null
    });
  }
  
  // Save series
  if (!saveSeriesById(seriesId, series)) {
    return res.status(500).json({ error: 'Failed to create series' });
  }
  
  // Register pages
  // Page structure: +0=Live Score, +1=Scorecard, +2=Fixtures, +3-7=Match Scorecards, +8=Batting Stats, +9=Bowling Stats
  const pageNames = [
    'Live Score',             // +0 (e.g., 341)
    'Scorecard',              // +1 (e.g., 342)
    'Fixtures',               // +2 (e.g., 343)
    'Match 1 Scorecard',      // +3 (e.g., 344)
    'Match 2 Scorecard',      // +4 (e.g., 345)
    'Match 3 Scorecard',      // +5 (e.g., 346)
    'Match 4 Scorecard',      // +6 (e.g., 347)
    'Match 5 Scorecard',      // +7 (e.g., 348)
    'Leading Run Scorers',    // +8 (e.g., 349)
    'Leading Wicket Takers'   // +9 (e.g., 350)
  ];
  
  pagesToRegister.forEach((pageNum, idx) => {
    registry[pageNum] = {
      title: `${name} - ${pageNames[idx]}`,
      type: 'series',
      seriesId
    };
  });
  
  savePageRegistry(registry);
  
  res.json({ success: true, seriesId, series });
});

// Get all series
app.get('/api/series/list', checkRateLimit, (req, res) => {
  const allSeries = loadAllSeries();
  res.json(allSeries);
});

// Get specific series
app.get('/api/series/:seriesId', checkRateLimit, (req, res) => {
  const { seriesId } = req.params;
  const series = loadSeriesById(seriesId);
  
  if (!series) {
    return res.status(404).json({ error: 'Series not found' });
  }
  
  res.json(series);
});

// Update series priority
app.put('/api/series/:seriesId/priority', requireAuth, checkRateLimit, (req, res) => {
  const { seriesId } = req.params;
  const { priority } = req.body;
  
  try {
    // Validate inputs
    if (!seriesId || typeof seriesId !== 'string' || !/^[a-zA-Z0-9\-_]+$/.test(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }
    
    const priorityNum = parseInt(priority);
    if (!priorityNum || priorityNum < 1 || priorityNum > 10) {
      return res.status(400).json({ error: 'Priority must be between 1 and 10' });
    }
    
    // Load series
    const series = loadSeriesById(seriesId);
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }
    
    const oldStartPage = series.startPage;
    const newStartPage = 340 + (priorityNum * 10);
    const newEndPage = newStartPage + 9;
    
    // Check if new page range is available (excluding current series)
    const registry = loadPageRegistry();
    for (let i = 0; i <= 9; i++) {
      const pageNum = (newStartPage + i).toString();
      if (registry[pageNum] && registry[pageNum].seriesId !== seriesId) {
        return res.status(400).json({ 
          error: `Priority ${priorityNum} is already taken by another series. Pages ${newStartPage}-${newEndPage} are in use.` 
        });
      }
    }
    
    // Update series data
    series.priority = priorityNum;
    series.startPage = newStartPage;
    series.endPage = newEndPage;
    
    const seriesFilePath = path.join(seriesDir, seriesId, 'series.json');
    fs.writeFileSync(seriesFilePath, JSON.stringify(series, null, 2), 'utf8');
    
    // Update page registry - remove old pages
    for (let i = 0; i <= 9; i++) {
      const oldPageNum = (oldStartPage + i).toString();
      if (registry[oldPageNum] && registry[oldPageNum].seriesId === seriesId) {
        delete registry[oldPageNum];
      }
    }
    
    // Add new pages
    const pageNames = [
      'Live Score',
      'Scorecard',
      'Fixtures',
      'Match 1 Scorecard',
      'Match 2 Scorecard',
      'Match 3 Scorecard',
      'Match 4 Scorecard',
      'Match 5 Scorecard',
      'Leading Run Scorers',
      'Leading Wicket Takers'
    ];
    
    for (let i = 0; i <= 9; i++) {
      const pageNum = (newStartPage + i).toString();
      registry[pageNum] = {
        title: `${series.name} - ${pageNames[i]}`,
        type: 'series',
        seriesId: seriesId
      };
    }
    
    savePageRegistry(registry);
    
    res.json({ 
      success: true, 
      message: 'Series priority updated',
      startPage: newStartPage,
      endPage: newEndPage
    });
  } catch (error) {
    console.error('Error updating series priority:', error);
    res.status(500).json({ error: 'Failed to update series priority' });
  }
});

// Delete series
app.delete('/api/series/:seriesId', requireAuth, checkRateLimit, (req, res) => {
  const { seriesId } = req.params;
  
  try {
    // Validate seriesId
    if (!seriesId || typeof seriesId !== 'string' || !/^[a-zA-Z0-9\-_]+$/.test(seriesId)) {
      return res.status(400).json({ error: 'Invalid series ID' });
    }
    
    const seriesDirPath = path.join(seriesDir, seriesId);
    const resolvedPath = path.resolve(seriesDirPath);
    const resolvedSeriesDir = path.resolve(seriesDir);
    
    if (!resolvedPath.startsWith(resolvedSeriesDir)) {
      return res.status(403).json({ error: 'Invalid series path' });
    }
    
    // Load series to get page numbers to deregister
    const series = loadSeriesById(seriesId);
    if (series && series.startPage) {
      const registry = loadPageRegistry();
      for (let i = 0; i <= 9; i++) { // 10 pages per series (0-9)
        const pageNum = (series.startPage + i).toString();
        if (registry[pageNum] && registry[pageNum].seriesId === seriesId) {
          delete registry[pageNum];
        }
      }
      savePageRegistry(registry);
    }
    
    // Delete series directory
    if (fs.existsSync(seriesDirPath)) {
      fs.rmSync(seriesDirPath, { recursive: true, force: true });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting series:', error);
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

// Create match in series
app.post('/api/series/:seriesId/match/create', requireAuth, (req, res) => {
  const { seriesId } = req.params;
  const { matchNumber, venue, date, startTime, squad1, squad2 } = req.body;
  
  console.log('Match create request received:', {
    matchNumber,
    venue,
    date,
    startTime,
    squad1: squad1 ? `array of ${squad1.length}` : 'undefined',
    squad2: squad2 ? `array of ${squad2.length}` : 'undefined'
  });
  
  const series = loadSeriesById(seriesId);
  if (!series) {
    return res.status(404).json({ error: 'Series not found' });
  }
  
  // Find match in series
  const matchInfo = series.matches.find(m => m.number === matchNumber);
  if (!matchInfo) {
    return res.status(404).json({ error: 'Match not found in series' });
  }
  
  // Validate squads only if provided
  const hasSquads = squad1 && Array.isArray(squad1) && squad1.length > 0 && 
                    squad2 && Array.isArray(squad2) && squad2.length > 0;
  if (hasSquads) {
    if (squad1.length !== 11) {
      return res.status(400).json({ error: `${series.team1} squad must contain exactly 11 players` });
    }
    if (squad2.length !== 11) {
      return res.status(400).json({ error: `${series.team2} squad must contain exactly 11 players` });
    }
  }
  
  // Create match object
  const match = {
    id: matchInfo.id,
    seriesId,
    title: matchInfo.title,
    venue,
    date,
    status: 'upcoming',
    format: 'test',
    maxInnings: 4,
    currentInnings: 0,
    innings: [],
    squads: {},
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
  
  // Add start time if provided
  if (startTime) {
    match.startTime = startTime;
  }
  
  // Add squads only if provided
  if (hasSquads) {
    match.squads[series.team1] = squad1;
    match.squads[series.team2] = squad2;
  }
  
  // Save match
  if (!saveSeriesMatch(seriesId, matchInfo.id, match)) {
    return res.status(500).json({ error: 'Failed to create match' });
  }
  
  // Update series match info
  matchInfo.venue = venue;
  matchInfo.date = date;
  if (startTime) {
    matchInfo.startTime = startTime;
  }
  matchInfo.status = 'upcoming';
  saveSeriesById(seriesId, series);
  
  // Also save to legacy location for current match
  saveMatch(match);
  
  res.json({ success: true, match });
});

// Get match from series
app.get('/api/series/:seriesId/match/:matchId', checkRateLimit, (req, res) => {
  const { seriesId, matchId } = req.params;
  const match = loadSeriesMatch(seriesId, matchId);
  
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  res.json(match);
});

// Update match squads
app.put('/api/series/:seriesId/match/:matchId/squads', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  const { squad1, squad2 } = req.body;
  
  // Load match
  const match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  // Load series to get team names
  const series = loadSeriesById(seriesId);
  if (!series) {
    return res.status(404).json({ error: 'Series not found' });
  }
  
  // Validate squads
  if (!squad1 || !Array.isArray(squad1) || squad1.length !== 11) {
    return res.status(400).json({ error: `${series.team1} squad must contain exactly 11 players` });
  }
  if (!squad2 || !Array.isArray(squad2) || squad2.length !== 11) {
    return res.status(400).json({ error: `${series.team2} squad must contain exactly 11 players` });
  }
  
  // Update squads
  if (!match.squads) {
    match.squads = {};
  }
  match.squads[series.team1] = squad1;
  match.squads[series.team2] = squad2;
  
  // Save match
  if (!saveSeriesMatch(seriesId, matchId, match)) {
    return res.status(500).json({ error: 'Failed to update squads' });
  }
  
  res.json({ success: true, match });
});

// Record ball in series match (with stats update)
app.post('/api/series/:seriesId/match/:matchId/ball', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  // Load match from series
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  // Also load to legacy location for compatibility
  saveMatch(match);
  
  // Use existing ball recording logic by temporarily setting as current match
  const ballData = req.body;
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { 
    runs, overthrows, extras, extraType, secondExtras, secondExtraType, wicket, wicketType, dismissedBatsman, bowler, fielder
  } = ballData;
  
  // Prevent prototype pollution in input names
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (bowler && dangerousNames.includes(bowler)) {
    return res.status(400).json({ error: 'Invalid bowler name' });
  }
  if (dismissedBatsman && dangerousNames.includes(dismissedBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  if (fielder && dangerousNames.includes(fielder)) {
    return res.status(400).json({ error: 'Invalid fielder name' });
  }
  
  // Record ball using existing logic (simplified version)
  const striker = currentInnings.striker;
  const isLegalDelivery = (extraType !== 'Wd' && extraType !== 'Nb');
  const ballNumber = isLegalDelivery ? currentInnings.balls + 1 : Math.max(1, currentInnings.balls);
  
  const ball = {
    over: currentInnings.overs,
    ball: ballNumber,
    batsman: striker,
    bowler: bowler || currentInnings.currentBowler.name,
    runs: parseInt(runs) || 0,
    overthrows: parseInt(overthrows) || 0,
    extras: parseInt(extras) || 0,
    extraType: extraType || null,
    secondExtras: parseInt(secondExtras) || 0,
    secondExtraType: secondExtraType || null,
    wicket: wicket || false,
    wicketType: wicketType || null,
    dismissedBatsman: dismissedBatsman || null,
    fielder: fielder || null,
    timestamp: new Date().toISOString()
  };
  
  // Update innings totals (including second extras)
  currentInnings.runs += (ball.runs + ball.overthrows + ball.extras + ball.secondExtras);
  
  // Update batsman stats
  // - Runs off bat (ball.runs) count for batsman except for penalties/byes/leg byes
  // - Overthrows after hitting the ball count for batsman
  // - Byes/leg byes are in ball.extras and don't count for batsman
  if (!currentInnings.allBatsmen[striker]) {
    currentInnings.allBatsmen[striker] = { 
      name: striker, runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' 
    };
  }
  
  // Only count runs off bat for batsman (not penalties or byes/leg byes)
  if (ball.extraType !== 'Penalty' && ball.extraType !== 'Bye' && ball.extraType !== 'LB') {
    currentInnings.allBatsmen[striker].runs += (ball.runs + ball.overthrows);
  }
  
  // Ball counts toward batsman's balls faced unless it's a wide or penalty
  if (ball.extraType !== 'Wd' && ball.extraType !== 'Penalty') {
    currentInnings.allBatsmen[striker].balls++;
  }
  
  // Boundaries only count if runs were scored off the bat
  const isBoundaryOffBat = ball.extraType !== 'Penalty' && ball.extraType !== 'Bye' && ball.extraType !== 'LB';
  if (ball.runs === 4 && ball.overthrows === 0 && isBoundaryOffBat) {
    currentInnings.allBatsmen[striker].fours++;
  }
  if (ball.runs === 6 && ball.overthrows === 0 && isBoundaryOffBat) {
    currentInnings.allBatsmen[striker].sixes++;
  }
  
  // Update bowler stats
  const bowlerName = ball.bowler;
  if (!currentInnings.allBowlers[bowlerName]) {
    currentInnings.allBowlers[bowlerName] = { 
      name: bowlerName, balls: 0, overs: 0, maidens: 0, runs: 0, wickets: 0 
    };
  }
  
  // Bowler concedes:
  // - Wides and No Balls: all runs (including overthrows and second extras)
  // - Byes/Leg Byes: nothing (these are in ball.extras)
  // - Normal deliveries: runs off bat + overthrows
  // - Penalties: nothing
  if (ball.extraType === 'Penalty') {
    // Penalty runs don't count against the bowler
  } else if (ball.extraType === 'Wd' || ball.extraType === 'Nb') {
    // Wides and No Balls: all runs including second extras
    currentInnings.allBowlers[bowlerName].runs += (ball.runs + ball.overthrows + ball.extras + ball.secondExtras);
  } else if (ball.extraType === 'Bye' || ball.extraType === 'LB') {
    // Byes and Leg Byes: don't count against bowler
    // Nothing added to bowler's runs
  } else {
    // Normal deliveries: runs off bat + overthrows
    currentInnings.allBowlers[bowlerName].runs += (ball.runs + ball.overthrows);
  }
  if (isLegalDelivery) {
    currentInnings.allBowlers[bowlerName].balls++;
  }
  
  // Handle wickets
  if (ball.wicket) {
    // BUG FIX #8: Validate wickets don't exceed 10
    if (currentInnings.wickets >= 10) {
      return res.status(400).json({ error: 'Cannot record wicket: innings already has 10 wickets' });
    }
    currentInnings.wickets++;
    const dismissedName = dismissedBatsman || striker;
    if (currentInnings.allBatsmen[dismissedName]) {
      currentInnings.allBatsmen[dismissedName].status = 'out';
      currentInnings.allBatsmen[dismissedName].howOut = wicketType;
      if (fielder) {
        currentInnings.allBatsmen[dismissedName].fielder = fielder;
      }
    }
    // Only increment bowler wickets for non-run-out dismissals
    if (wicketType !== 'run out') {
      currentInnings.allBowlers[bowlerName].wickets++;
    }
    currentInnings.fallOfWickets.push({
      runs: currentInnings.runs,
      wickets: currentInnings.wickets,
      batsman: dismissedName
    });
  }
  
  // Rotate strike
  const totalRunsForStrike = ball.runs + ball.overthrows;
  if (totalRunsForStrike % 2 === 1) {
    [currentInnings.striker, currentInnings.nonStriker] = 
      [currentInnings.nonStriker, currentInnings.striker];
  }
  
  currentInnings.currentOver.push(ball);
  
  // BUG FIX #2: Update current bowler to the bowler who just bowled
  currentInnings.currentBowler = { name: bowlerName };
  
  // BUG FIX #4: Initialize bowlingEnds if not present (for backward compatibility)
  if (!currentInnings.bowlingEnds) {
    currentInnings.bowlingEnds = {};
  }
  if (!currentInnings.currentEnd) {
    currentInnings.currentEnd = 'End A';
  }
  
  // Track which end this bowler is bowling from
  currentInnings.bowlingEnds[bowlerName] = currentInnings.currentEnd;
  
  if (isLegalDelivery) {
    currentInnings.balls++;
    if (currentInnings.balls === 6) {
      currentInnings.overs++;
      currentInnings.balls = 0;
      currentInnings.allBowlers[bowlerName].overs = Math.floor(currentInnings.allBowlers[bowlerName].balls / 6);
      
      // Calculate runs conceded in this over to determine if it's a maiden
      let runsInOver = 0;
      for (const b of currentInnings.currentOver) {
        if (b.extraType === 'Wd' || b.extraType === 'Nb') {
          runsInOver += (b.runs + b.overthrows + b.extras);
        } else if (b.extraType === 'Bye' || b.extraType === 'B' || b.extraType === 'LB') {
          runsInOver += (b.runs + b.overthrows);
        } else {
          runsInOver += (b.runs + b.overthrows);
        }
      }
      
      console.log(`Over complete - Bowler: ${bowlerName}, Runs in over: ${runsInOver}, Current over balls:`, currentInnings.currentOver);
      
      // If 0 runs conceded, it's a maiden
      if (runsInOver === 0) {
        if (!currentInnings.allBowlers[bowlerName].maidens) {
          currentInnings.allBowlers[bowlerName].maidens = 0;
        }
        currentInnings.allBowlers[bowlerName].maidens++;
        console.log(`MAIDEN! ${bowlerName} now has ${currentInnings.allBowlers[bowlerName].maidens} maiden(s)`);
      }
      
      // Track last bowler at each end
      if (!currentInnings.lastBowlerAtEnd) {
        currentInnings.lastBowlerAtEnd = {};
      }
      currentInnings.lastBowlerAtEnd[currentInnings.currentEnd] = bowlerName;
      
      // BUG FIX #5: Store completed over information including bowler and end
      const overRuns = currentInnings.currentOver.reduce((sum, b) => sum + (b.runs || 0) + (b.overthrows || 0) + (b.extras || 0), 0);
      currentInnings.lastCompletedOver = {
        overNum: currentInnings.overs,
        bowler: bowlerName,
        end: currentInnings.currentEnd,
        balls: [...currentInnings.currentOver],
        runs: overRuns
      };
      
      // BUG FIX #4: Switch ends after over completes
      currentInnings.currentEnd = (currentInnings.currentEnd === 'End A') ? 'End B' : 'End A';
      
      [currentInnings.striker, currentInnings.nonStriker] = 
        [currentInnings.nonStriker, currentInnings.striker];
      currentInnings.currentOver = [];
    }
  }
  
  currentInnings.allBalls.push(ball);
  
  // Update match situation
  if (match.format === 'test') {
    calculateMatchSituation(match);
    
    // Check if innings just ended (all out OR target reached in 4th innings)
    const inningsEnded = currentInnings.wickets >= 10;
    const targetReached = match.innings.length === 4 && 
                          match.matchSituation.target && 
                          currentInnings.runs >= match.matchSituation.target;
    
    if (inningsEnded || targetReached) {
      currentInnings.status = 'completed';
      calculateMatchResult(match);
      
      // If match is now completed, update series immediately
      if (match.status === 'completed' && match.result && match.result.winner) {
        updateSeriesMatchStatus(matchId, match);
      }
    }
  }
  
  // Save match to series directory
  saveSeriesMatch(seriesId, matchId, match);
  
  // Also save to legacy location
  saveMatch(match);
  
  // Update series stats after every ball
  calculateSeriesStats(seriesId);
  
  res.json(match);
});

// Start innings for series match
app.post('/api/series/:seriesId/match/:matchId/start-innings', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  const { battingTeam, bowlingTeam, battingOrder, openingBowler, enforceFollowOn } = req.body;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  // BUG FIX #11: Prevent starting new innings if match is completed
  if (match.status === 'completed') {
    return res.status(400).json({ error: 'Cannot start new innings: match is completed' });
  }
  
  // Initialize innings
  const inningsNumber = match.innings.length + 1;
  
  const newInnings = {
    number: inningsNumber,
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    status: 'live',
    battingOrder,
    nextBatsmanIndex: 2,
    striker: battingOrder[0],
    nonStriker: battingOrder[1],
    currentBowler: { name: openingBowler, balls: 0 },
    currentEnd: 'End A', // BUG FIX #4: Track which end is currently being bowled from
    allBatsmen: {
      [battingOrder[0]]: { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' },
      [battingOrder[1]]: { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' }
    },
    allBowlers: {
      [openingBowler]: { overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 }
    },
    bowlingEnds: {
      // BUG FIX #4: Track which end each bowler last bowled from
      [openingBowler]: 'End A'
    },
    currentOver: [],
    fallOfWickets: [],
    allBalls: [],
    followOnEnforced: enforceFollowOn || false
  };
  
  match.innings.push(newInnings);
  match.status = 'live';
  
  // Save match
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  // Update series
  const series = loadSeriesById(seriesId);
  if (series) {
    const matchIndex = series.matches.findIndex(m => m.id === matchId);
    if (matchIndex !== -1) {
      series.matches[matchIndex].status = 'live';
      saveSeriesById(seriesId, series);
    }
  }
  
  res.json(match);
});

// Undo last ball for series match
app.post('/api/series/:seriesId/match/:matchId/undo', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No innings to undo' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  if (!currentInnings.allBalls || currentInnings.allBalls.length === 0) {
    return res.status(400).json({ error: 'No balls to undo' });
  }
  
  // BUG FIX #7 & #8: Remove last ball and use proper recalculateInnings function
  currentInnings.allBalls.pop();
  
  // Use the proper recalculateInnings function to rebuild all stats correctly
  // This fixes duplicate entries in currentOver and prevents 11 wickets bug
  recalculateInnings(currentInnings);
  
  // Recalculate match situation after undo (updates target, lead/trail, etc.)
  if (match.format === 'test') {
    calculateMatchSituation(match);
    calculateMatchResult(match);
    
    // Update series status if match status changed
    if (match.status === 'completed' && match.result && match.result.winner) {
      updateSeriesMatchStatus(matchId, match);
    }
  }
  
  // Save
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  calculateSeriesStats(seriesId);
  
  res.json(match);
});

// Swap strike for series match
app.post('/api/series/:seriesId/match/:matchId/swap-strike', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  // Swap striker and non-striker
  const temp = currentInnings.striker;
  currentInnings.striker = currentInnings.nonStriker;
  currentInnings.nonStriker = temp;
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  res.json(match);
});

// Retire batsman for series match
app.post('/api/series/:seriesId/match/:matchId/retire-batsman', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  const { batsmanName, retireType } = req.body;
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(batsmanName)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  if (!currentInnings.allBatsmen[batsmanName]) {
    return res.status(400).json({ error: 'Batsman not found' });
  }
  
  const validRetireTypes = ['retired hurt', 'retired out', 'retired not out'];
  if (!validRetireTypes.includes(retireType)) {
    return res.status(400).json({ error: 'Invalid retirement type' });
  }
  
  currentInnings.allBatsmen[batsmanName].status = retireType;
  currentInnings.allBatsmen[batsmanName].howOut = retireType;
  
  if (retireType === 'retired out') {
    currentInnings.wickets++;
    currentInnings.fallOfWickets.push({
      runs: currentInnings.runs,
      wickets: currentInnings.wickets,
      batsman: batsmanName
    });
  }
  
  if (saveSeriesMatch(seriesId, matchId, match)) {
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to retire batsman' });
  }
});

// Select incoming batsman for series match
app.post('/api/series/:seriesId/match/:matchId/select-incoming-batsman', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  const { batsmanName } = req.body;
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dangerousNames.includes(batsmanName)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  // Validate batsman is in batting order
  if (!currentInnings.battingOrder.includes(batsmanName)) {
    return res.status(400).json({ error: 'Batsman not in batting order' });
  }
  
  // Check if batsman hasn't batted yet OR is retired hurt (can resume)
  if (currentInnings.allBatsmen[batsmanName]) {
    const status = currentInnings.allBatsmen[batsmanName].status;
    // Allow if: not batted, retired hurt
    // Reject if: out, batting, retired out, retired not out
    if (status !== 'not batted' && status !== 'retired hurt') {
      return res.status(400).json({ error: 'Batsman has already batted or is unavailable' });
    }
  }
  
  // Initialize batsman stats OR resume retired hurt batsman
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
  
  // Store incoming batsman in last ball record (if it was a wicket)
  if (currentInnings.allBalls && currentInnings.allBalls.length > 0) {
    const lastBall = currentInnings.allBalls[currentInnings.allBalls.length - 1];
    if (lastBall.wicket) {
      lastBall.incomingBatsman = batsmanName;
    }
  }
  
  // Save match to series directory
  if (saveSeriesMatch(seriesId, matchId, match)) {
    // Also save to legacy location for consistency
    saveMatch(match);
    
    // Update series stats to ensure cached data is refreshed
    calculateSeriesStats(seriesId);
    
    res.json(match);
  } else {
    res.status(500).json({ error: 'Failed to select batsman' });
  }
});

// Declare innings for series match
app.post('/api/series/:seriesId/match/:matchId/declare', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  currentInnings.declared = true;
  currentInnings.status = 'completed';
  
  // Mark batsmen as not out
  if (currentInnings.striker && currentInnings.allBatsmen[currentInnings.striker]) {
    currentInnings.allBatsmen[currentInnings.striker].status = 'not out';
  }
  if (currentInnings.nonStriker && currentInnings.allBatsmen[currentInnings.nonStriker]) {
    currentInnings.allBatsmen[currentInnings.nonStriker].status = 'not out';
  }
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  calculateSeriesStats(seriesId);
  
  res.json(match);
});

// Declare match as draw for series match
app.post('/api/series/:seriesId/match/:matchId/declare-draw', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.status === 'completed') {
    return res.status(400).json({ error: 'Match already completed' });
  }
  
  // Mark current innings as completed if there is one
  if (match.innings && match.innings.length > 0) {
    const currentInnings = match.innings[match.innings.length - 1];
    if (currentInnings.status === 'live') {
      currentInnings.status = 'completed';
      
      // Mark current batsmen as not out
      if (currentInnings.striker && currentInnings.allBatsmen[currentInnings.striker]) {
        currentInnings.allBatsmen[currentInnings.striker].status = 'not out';
      }
      if (currentInnings.nonStriker && currentInnings.allBatsmen[currentInnings.nonStriker]) {
        currentInnings.allBatsmen[currentInnings.nonStriker].status = 'not out';
      }
    }
  }
  
  // Set match result to draw
  match.result = {
    status: 'completed',
    winner: null,
    winType: 'draw',
    margin: null
  };
  match.status = 'completed';
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  // Update series with the draw result
  updateSeriesMatchStatus(matchId, match);
  
  calculateSeriesStats(seriesId);
  
  res.json({ match, message: 'Match declared as draw' });
});

// End innings for series match
app.post('/api/series/:seriesId/match/:matchId/end-innings', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  currentInnings.status = 'completed';
  
  // Mark current batsmen as not out
  if (currentInnings.striker && currentInnings.allBatsmen[currentInnings.striker]) {
    currentInnings.allBatsmen[currentInnings.striker].status = 'not out';
  }
  if (currentInnings.nonStriker && currentInnings.allBatsmen[currentInnings.nonStriker]) {
    currentInnings.allBatsmen[currentInnings.nonStriker].status = 'not out';
  }
  
  // BUG FIX #1 & #11: Check for match completion after any innings ends
  // Calculate match situation and check for result
  if (match.format === 'test') {
    calculateMatchSituation(match);
    calculateMatchResult(match);
    
    // If match is now completed, update series immediately
    if (match.status === 'completed' && match.result && match.result.winner) {
      updateSeriesMatchStatus(matchId, match);
    }
  }
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  calculateSeriesStats(seriesId);
  
  res.json(match);
});

// Update match day for series match
app.post('/api/series/:seriesId/match/:matchId/update-day', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  const { day } = req.body;
  if (!day || day < 1 || day > 5) {
    return res.status(400).json({ error: 'Invalid day number' });
  }
  
  match.day = day;
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  res.json(match);
});

// Update match message for series match
app.post('/api/series/:seriesId/match/:matchId/update-message', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  const { message } = req.body;
  match.message = message || '';
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  res.json(match);
});

// Change batsmen for series match
app.post('/api/series/:seriesId/match/:matchId/change-batsmen', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { striker, nonStriker } = req.body;
  
  if (!striker || !nonStriker) {
    return res.status(400).json({ error: 'Both striker and non-striker required' });
  }
  
  if (striker === nonStriker) {
    return res.status(400).json({ error: 'Striker and non-striker must be different' });
  }
  
  // Update batsmen
  currentInnings.striker = striker;
  currentInnings.nonStriker = nonStriker;
  
  // Initialize batsmen in allBatsmen if they don't exist
  if (!currentInnings.allBatsmen[striker]) {
    currentInnings.allBatsmen[striker] = { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' };
  }
  if (!currentInnings.allBatsmen[nonStriker]) {
    currentInnings.allBatsmen[nonStriker] = { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'batting' };
  }
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  
  res.json(match);
});

// Edit ball for series match
app.post('/api/series/:seriesId/match/:matchId/edit-ball', requireAuth, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  let match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  if (match.innings.length === 0) {
    return res.status(400).json({ error: 'No active innings' });
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  const { ballIndex, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman, bowler, batsman, fielder } = req.body;
  
  if (ballIndex < 0 || ballIndex >= currentInnings.allBalls.length) {
    return res.status(400).json({ error: 'Invalid ball index' });
  }
  
  // Prevent prototype pollution
  const dangerousNames = ['__proto__', 'constructor', 'prototype'];
  if (dismissedBatsman && dangerousNames.includes(dismissedBatsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  if (bowler && dangerousNames.includes(bowler)) {
    return res.status(400).json({ error: 'Invalid bowler name' });
  }
  if (batsman && dangerousNames.includes(batsman)) {
    return res.status(400).json({ error: 'Invalid batsman name' });
  }
  if (fielder && dangerousNames.includes(fielder)) {
    return res.status(400).json({ error: 'Invalid fielder name' });
  }
  if (extraType && dangerousNames.includes(extraType)) {
    return res.status(400).json({ error: 'Invalid extra type' });
  }
  if (wicketType && dangerousNames.includes(wicketType)) {
    return res.status(400).json({ error: 'Invalid wicket type' });
  }
  
  // Validate ball exists
  const ball = currentInnings.allBalls[ballIndex];
  if (!ball || typeof ball !== 'object') {
    return res.status(400).json({ error: 'Invalid ball' });
  }
  
  // Update ball at index (create safe copy to avoid prototype pollution)
  const safeProps = {
    runs: parseInt(runs) || 0,
    overthrows: parseInt(overthrows) || 0,
    extras: parseInt(extras) || 0,
    extraType: extraType || null,
    wicket: wicket || false,
    wicketType: wicketType || null,
    dismissedBatsman: dismissedBatsman || null,
    fielder: fielder || null
  };
  
  // Update ball properties safely using direct assignment (validated above)
  ball.runs = safeProps.runs;
  ball.overthrows = safeProps.overthrows;
  ball.extras = safeProps.extras;
  ball.extraType = safeProps.extraType;
  ball.wicket = safeProps.wicket;
  ball.wicketType = safeProps.wicketType;
  ball.dismissedBatsman = safeProps.dismissedBatsman;
  ball.fielder = safeProps.fielder;
  
  // Update bowler and batsman if provided (already validated as not dangerous)
  if (bowler && bowler.trim()) {
    ball.bowler = bowler.trim();
  }
  if (batsman && batsman.trim()) {
    ball.batsman = batsman.trim();
  }
  
  // Recalculate innings from all balls
  recalculateInnings(currentInnings);
  
  // Recalculate match situation after edit (updates target, lead/trail, etc.)
  if (match.format === 'test') {
    calculateMatchSituation(match);
    calculateMatchResult(match);
    
    // Update series status if match status changed
    if (match.status === 'completed' && match.result && match.result.winner) {
      updateSeriesMatchStatus(matchId, match);
    }
  }
  
  saveSeriesMatch(seriesId, matchId, match);
  saveMatch(match);
  calculateSeriesStats(seriesId);
  
  res.json(match);
});

// Get series match
app.get('/api/series/:seriesId/match/:matchId', checkRateLimit, (req, res) => {
  const { seriesId, matchId } = req.params;
  
  const match = loadSeriesMatch(seriesId, matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }
  
  res.json(match);
});

// About API endpoints
app.get('/api/about', checkRateLimit, (req, res) => {
  try {
    const about = JSON.parse(fs.readFileSync(aboutFile, 'utf8'));
    res.json(about);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load about page' });
  }
});

app.put('/api/about', requireAuth, (req, res) => {
  try {
    const { title, content } = req.body;
    
    console.log('About page update request:', { title: title?.substring(0, 30), contentLength: content?.length });
    
    if (!title || !content) {
      console.log('Missing title or content');
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const aboutData = { title, content };
    fs.writeFileSync(aboutFile, JSON.stringify(aboutData, null, 2));
    
    console.log('About page saved successfully');
    res.json({ success: true, data: aboutData });
  } catch (error) {
    console.error('Error updating about page:', error);
    res.status(500).json({ error: 'Failed to update about page: ' + error.message });
  }
});

// News API endpoints
app.get('/api/news', checkRateLimit, (req, res) => {
  const news = loadNews();
  res.json(news);
});

app.post('/api/news/create', requireAuth, (req, res) => {
  const { page, title, date, content, published } = req.body;
  
  // Validate page number (361-370)
  if (!page || page < 361 || page > 370) {
    return res.status(400).json({ error: 'Page number must be between 361 and 370' });
  }
  
  const news = loadNews();
  
  // Check if page is already used
  if (news.find(n => n.page === page)) {
    return res.status(400).json({ error: 'Page number already in use' });
  }
  
  // Check max 10 news stories
  if (news.length >= 10) {
    return res.status(400).json({ error: 'Maximum 10 news stories allowed' });
  }
  
  const newsItem = {
    id: `news-${Date.now()}`,
    page,
    title,
    date: date || new Date().toISOString().split('T')[0],
    content,
    published: published !== false
  };
  
  news.push(newsItem);
  
  if (!saveNews(news)) {
    return res.status(500).json({ error: 'Failed to create news' });
  }
  
  // Register page
  const registry = loadPageRegistry();
  registry[page.toString()] = {
    title: `News - ${title}`,
    type: 'news',
    newsId: newsItem.id
  };
  savePageRegistry(registry);
  
  res.json({ success: true, newsItem });
});

app.put('/api/news/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { page, title, date, content, published } = req.body;
  
  const news = loadNews();
  const item = news.find(n => n.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'News item not found' });
  }
  
  // Validate page number if changing (361-370)
  if (page && (page < 361 || page > 370)) {
    return res.status(400).json({ error: 'Page number must be between 361 and 370' });
  }
  
  // Check if new page is already used by another news item
  if (page && page !== item.page && news.find(n => n.page === page && n.id !== id)) {
    return res.status(400).json({ error: 'Page number already in use' });
  }
  
  // Update page registry if page changed
  if (page && page !== item.page) {
    const registry = loadPageRegistry();
    // Remove old page registration
    delete registry[item.page];
    // Add new page registration
    registry[page] = { type: 'news', id: item.id };
    savePageRegistry(registry);
  }
  
  if (page) item.page = page;
  if (title) item.title = title;
  if (date) item.date = date;
  if (content) item.content = content;
  if (published !== undefined) item.published = published;
  
  if (!saveNews(news)) {
    return res.status(500).json({ error: 'Failed to update news' });
  }
  
  res.json({ success: true, item });
});

app.delete('/api/news/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  const news = loadNews();
  const index = news.findIndex(n => n.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'News item not found' });
  }
  
  const item = news[index];
  news.splice(index, 1);
  
  if (!saveNews(news)) {
    return res.status(500).json({ error: 'Failed to delete news' });
  }
  
  // Deregister page
  const registry = loadPageRegistry();
  if (registry[item.page.toString()]) {
    delete registry[item.page.toString()];
    savePageRegistry(registry);
  }
  
  res.json({ success: true });
});

// Homepage configuration endpoints
app.get('/api/homepage', checkRateLimit, (req, res) => {
  const config = loadHomepage();
  res.json(config);
});

app.put('/api/homepage', requireAuth, (req, res) => {
  const { sections } = req.body;
  
  if (!sections || !Array.isArray(sections)) {
    return res.status(400).json({ error: 'Invalid homepage configuration' });
  }
  
  const config = { sections };
  
  if (!saveHomepage(config)) {
    return res.status(500).json({ error: 'Failed to save homepage configuration' });
  }
  
  res.json({ success: true, config });
});

// Page registry endpoint
app.get('/api/page-registry', checkRateLimit, (req, res) => {
  const registry = loadPageRegistry();
  res.json(registry);
});

// Get list of accessible page numbers (filters out upcoming match scorecards)
app.get('/api/accessible-pages', checkRateLimit, (req, res) => {
  const registry = loadPageRegistry();
  const accessiblePages = [];
  
  for (const [pageNum, pageInfo] of Object.entries(registry)) {
    // Include all non-series pages
    if (pageInfo.type !== 'series') {
      accessiblePages.push(parseInt(pageNum));
      continue;
    }
    
    // For series pages, check if it's a match scorecard
    const isMatchScorecard = pageInfo.title && pageInfo.title.includes('Match') && pageInfo.title.includes('Scorecard');
    
    if (!isMatchScorecard) {
      // Include non-match pages (live score, fixtures, stats, etc.)
      accessiblePages.push(parseInt(pageNum));
      continue;
    }
    
    // For match scorecards, check if the match has started
    try {
      const series = loadSeriesById(pageInfo.seriesId);
      if (!series) {
        continue;
      }
      
      // Extract match number from title (e.g., "Match 1 Scorecard" -> 1)
      const matchNumMatch = pageInfo.title.match(/Match (\d+)/);
      if (matchNumMatch) {
        const matchNum = parseInt(matchNumMatch[1]);
        const match = series.matches.find(m => m.number === matchNum);
        
        // Include if match has started (not upcoming, or upcoming with venue set)
        if (match && (match.status !== 'upcoming' || match.venue)) {
          accessiblePages.push(parseInt(pageNum));
        }
      }
    } catch (error) {
      // Skip pages that cause errors
      continue;
    }
  }
  
  accessiblePages.sort((a, b) => a - b);
  res.json(accessiblePages);
});

// Page data endpoint - serves content for specific page numbers
app.get('/api/page-data', checkRateLimit, (req, res) => {
  const { page } = req.query;
  
  // BUG FIX #1: Add cache-control headers to prevent browser caching of live data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  
  if (!page) {
    return res.status(400).json({ error: 'Page number required' });
  }
  
  const pageNum = parseInt(page);
  
  // Page 340 - Homepage
  if (pageNum === 340) {
    const allSeries = loadAllSeries();
    const news = loadNews().filter(n => n.published);
    
    // Find live matches across all series
    const liveMatches = [];
    for (const series of allSeries) {
      for (const matchInfo of series.matches) {
        if (matchInfo.status === 'live') {
          const match = loadSeriesMatch(series.id || series.dirName, matchInfo.id);
          if (match) {
            liveMatches.push({
              ...match,
              seriesName: series.name,
              seriesPage: series.startPage + 1 // Live score page
            });
          }
        }
      }
    }
    
    return res.json({
      type: 'homepage',
      page: 340,
      liveMatches,
      news,
      series: allSeries
    });
  }
  
  // Check page registry for all other pages (news, series, etc.)
  const registry = loadPageRegistry();
  const pageInfo = registry[pageNum.toString()];
  
  if (!pageInfo) {
    return res.status(404).json({ error: 'Page not found' });
  }
  
  // Handle news pages
  if (pageInfo.type === 'news') {
    const news = loadNews();
    const newsItem = news.find(n => n.page === pageNum);
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News not found' });
    }
    
    return res.json({
      type: 'news',
      page: pageNum,
      newsItem
    });
  }
  
  // Handle series pages
  if (pageInfo.type !== 'series') {
    return res.status(404).json({ error: 'Page not found' });
  }
  
  const series = loadSeriesById(pageInfo.seriesId);
  if (!series) {
    return res.status(404).json({ error: 'Series not found' });
  }
  
  // Calculate page offset from series start
  // New page structure: +0=Live Score, +1=Scorecard, +2=Fixtures, +3-7=Match Scorecards, +8=Batting Stats, +9=Bowling Stats
  const pageOffset = pageNum - series.startPage;
  
  // Page +0: Live Score (replaces Series Overview)
  if (pageOffset === 0) {
    // Show live matches first, or most recent completed match, or first upcoming match
    let currentMatch = series.matches.find(m => m.status === 'live');
    if (!currentMatch) {
      // Find the most recently completed match
      const completedMatches = series.matches.filter(m => m.status === 'completed');
      if (completedMatches.length > 0) {
        currentMatch = completedMatches[completedMatches.length - 1];
      }
    }
    if (!currentMatch) {
      // Find the first upcoming match
      currentMatch = series.matches.find(m => m.status === 'upcoming');
    }
    
    if (!currentMatch) {
      return res.json({
        type: 'series-live',
        page: pageNum,
        series,
        match: null
      });
    }
    
    const match = loadSeriesMatch(series.id || pageInfo.seriesId, currentMatch.id);
    return res.json({
      type: 'series-live',
      page: pageNum,
      series,
      match
    });
  }
  
  // Page +1: Full Scorecard (current match)
  if (pageOffset === 1) {
    // Show live, completed, or upcoming matches
    let currentMatch = series.matches.find(m => m.status === 'live');
    if (!currentMatch) {
      const completedMatches = series.matches.filter(m => m.status === 'completed');
      if (completedMatches.length > 0) {
        currentMatch = completedMatches[completedMatches.length - 1];
      }
    }
    if (!currentMatch) {
      currentMatch = series.matches.find(m => m.status === 'upcoming');
    }
    
    if (!currentMatch) {
      return res.json({
        type: 'scorecard',
        page: pageNum,
        series,
        match: null
      });
    }
    
    const match = loadSeriesMatch(series.id || pageInfo.seriesId, currentMatch.id);
    return res.json({
      type: 'scorecard',
      page: pageNum,
      series,
      match
    });
  }
  
  // Page +2: Fixtures
  if (pageOffset === 2) {
    return res.json({
      type: 'fixtures',
      page: pageNum,
      series
    });
  }
  
  // Pages +3 to +7: Individual Match Scorecards (Match 1-5)
  if (pageOffset >= 3 && pageOffset <= 7) {
    const matchNumber = pageOffset - 2; // +3 = Match 1, +4 = Match 2, etc.
    const matchIndex = matchNumber - 1; // 0-indexed
    
    if (matchIndex >= series.matches.length) {
      return res.status(404).json({ error: 'Match does not exist' });
    }
    
    const matchInfo = series.matches[matchIndex];
    
    // Return 404 if match hasn't started yet (upcoming matches with no venue set)
    if (matchInfo.status === 'upcoming' && !matchInfo.venue) {
      return res.status(404).json({ error: 'Match not available yet' });
    }
    
    const match = loadSeriesMatch(series.id || pageInfo.seriesId, matchInfo.id);
    
    return res.json({
      type: 'scorecard',
      page: pageNum,
      series,
      match
    });
  }
  
  // Page +8: Leading Run Scorers
  if (pageOffset === 8) {
    return res.json({
      type: 'batting-stats',
      page: pageNum,
      series,
      batsmen: series.stats?.batsmen || []
    });
  }
  
  // Page +9: Leading Wicket Takers
  if (pageOffset === 9) {
    return res.json({
      type: 'bowling-stats',
      page: pageNum,
      series,
      bowlers: series.stats?.bowlers || []
    });
  }
  
  return res.status(404).json({ error: 'Page not found' });
});

// ===== END NEW API ENDPOINTS =====


// Serve admin dashboard (unified interface)
app.get('/admin', checkRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Serve legacy scorecard (redirect to page viewer)
app.get('/scorecard', checkRateLimit, (req, res) => {
  res.redirect('/?page=351');
});

// Serve about page
app.get('/about', checkRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve main page (Page viewer with ?page parameter)
app.get('/', checkRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cricket Text - Ashes Scoring App`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Public scorecard: http://localhost:${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin`);
});
