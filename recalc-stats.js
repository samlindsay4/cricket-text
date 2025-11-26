const fs = require('fs');
const path = require('path');

const seriesPath = '/workspaces/cricket-text/data/series/ashes-2025/series.json';
const series = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));

const batsmen = {};
const bowlers = {};

// Process all matches
for (const matchInfo of series.matches) {
  const matchPath = path.join('/workspaces/cricket-text/data/series/ashes-2025', matchInfo.id + '.json');
  try {
    const match = JSON.parse(fs.readFileSync(matchPath, 'utf8'));
    
    if (match.innings) {
      for (const innings of match.innings) {
        if (innings.allBatsmen) {
          Object.entries(innings.allBatsmen).forEach(([name, stats]) => {
            const key = `${name}|${innings.battingTeam}`;
            if (!batsmen[key]) {
              batsmen[key] = {
                name, team: innings.battingTeam, runs: 0, dismissals: 0, innings: 0, notOuts: 0,
                highScore: 0, highScoreNotOut: false, hundreds: 0, fifties: 0, balls: 0, fours: 0, sixes: 0
              };
            }
            batsmen[key].runs += stats.runs || 0;
            batsmen[key].balls += stats.balls || 0;
            batsmen[key].fours += stats.fours || 0;
            batsmen[key].sixes += stats.sixes || 0;
            batsmen[key].innings++;
            if (stats.status === 'out') batsmen[key].dismissals++;
            if (stats.status === 'not out' || stats.status === 'batting') batsmen[key].notOuts++;
            const runsInInnings = stats.runs || 0;
            if (runsInInnings > batsmen[key].highScore) {
              batsmen[key].highScore = runsInInnings;
              batsmen[key].highScoreNotOut = (stats.status === 'not out' || stats.status === 'batting');
            }
            if (runsInInnings >= 100) batsmen[key].hundreds++;
            else if (runsInInnings >= 50) batsmen[key].fifties++;
          });
        }
        
        if (innings.allBowlers) {
          Object.entries(innings.allBowlers).forEach(([name, stats]) => {
            const key = `${name}|${innings.bowlingTeam}`;
            if (!bowlers[key]) {
              bowlers[key] = {
                name, team: innings.bowlingTeam, wickets: 0, runs: 0, balls: 0,
                overs: 0, maidens: 0, bestFigures: { wickets: 0, runs: 999 }, fiveWickets: 0
              };
            }
            const w = stats.wickets || 0;
            const r = stats.runs || 0;
            bowlers[key].wickets += w;
            bowlers[key].runs += r;
            bowlers[key].balls += stats.balls || 0;
            bowlers[key].overs += stats.overs || 0;
            bowlers[key].maidens += stats.maidens || 0;
            if (w > bowlers[key].bestFigures.wickets || (w === bowlers[key].bestFigures.wickets && r < bowlers[key].bestFigures.runs)) {
              bowlers[key].bestFigures = { wickets: w, runs: r };
            }
            if (w >= 5) bowlers[key].fiveWickets++;
          });
        }
      }
    }
  } catch (e) {}
}

// Calculate averages
Object.values(batsmen).forEach(b => {
  b.average = b.dismissals > 0 ? (b.runs / b.dismissals).toFixed(2) : '-';
});

Object.values(bowlers).forEach(b => {
  b.average = b.wickets > 0 ? (b.runs / b.wickets).toFixed(2) : '-';
});

series.stats = {
  batsmen: Object.values(batsmen).sort((a, b) => b.runs - a.runs),
  bowlers: Object.values(bowlers).sort((a, b) => b.wickets - a.wickets)
};

fs.writeFileSync(seriesPath, JSON.stringify(series, null, 2));
console.log('Stats recalculated successfully!');
console.log('Batsmen:', series.stats.batsmen.length);
console.log('Bowlers:', series.stats.bowlers.length);
