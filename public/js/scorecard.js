// Scorecard JavaScript for Public View (Page 340)

let refreshInterval = null;
const BALLS_PER_OVER = 6; // Standard cricket over

/**
 * Updates the Ceefax header with current date and time
 * Displays date in GB format (e.g., "6 Nov 2025") and time in 24-hour format (e.g., "12:43")
 */
function updateHeaderDateTime() {
  const now = new Date();
  const dateOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const dateStr = now.toLocaleDateString('en-GB', dateOptions);
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  const dateElement = document.getElementById('ceefax-date');
  const timeElement = document.getElementById('ceefax-time');
  
  if (dateElement) dateElement.textContent = dateStr;
  if (timeElement) timeElement.textContent = timeStr;
}

// Format over string (e.g., "65.3")
function formatOvers(overs, balls) {
  return balls > 0 ? `${overs}.${balls}` : `${overs}`;
}

// Load and display match data
async function loadMatch() {
  try {
    const response = await fetch('/api/match');
    const match = await response.json();
    
    displayMatch(match);
    updateRefreshIndicator();
  } catch (error) {
    console.error('Error loading match:', error);
  }
}

// Display match data in Ceefax style
function displayMatch(match) {
  const content = document.getElementById('content');
  
  if (!match || !match.id || match.status === 'no-match') {
    content.innerHTML = `
      <div class="no-match">
        <p>NO MATCH CURRENTLY ACTIVE</p>
        <p style="margin-top: 20px; font-size: 14px;">Please check back later</p>
      </div>
    `;
    return;
  }
  
  const currentInnings = match.innings[match.innings.length - 1];
  
  let html = `
    <div class="match-title">${match.title || 'THE ASHES'}</div>
    
    <div class="match-info">
      <div>Venue: ${match.venue || 'TBC'}</div>
      <div>Date: ${formatDate(match.date)}</div>
    </div>
  `;
  
  // Display all innings scores (Test Match)
  if (match.format === 'test' && match.innings && match.innings.length > 0) {
    html += `<div class="innings-summary">`;
    match.innings.forEach((inn, idx) => {
      const isDeclared = inn.declared ? ' dec' : '';
      const isLive = inn.status === 'live' ? ' *' : '';
      html += `
        <div style="margin-bottom: 3px;">
          ${inn.battingTeam}: ${inn.runs}/${inn.wickets}${isDeclared}${isLive}
        </div>
      `;
    });
    html += `</div>`;
    
    // Show match situation
    if (match.matchSituation) {
      const sit = match.matchSituation;
      
      if (sit.lead && sit.leadBy > 0 && match.innings.length < 4) {
        html += `<div class="match-situation">
          ${sit.lead} lead by ${sit.leadBy} runs
        </div>`;
      }
      
      // Show chase situation in 4th innings
      if (match.innings.length === 4 && sit.target && currentInnings && currentInnings.status === 'live') {
        const runsNeeded = sit.target - currentInnings.runs;
        const wicketsLeft = 10 - currentInnings.wickets;
        
        // Calculate run rates
        const totalBalls = currentInnings.overs * BALLS_PER_OVER + currentInnings.balls;
        const currentRR = totalBalls > 0 ? (currentInnings.runs / totalBalls * BALLS_PER_OVER).toFixed(2) : '0.00';
        
        html += `<div class="chase-info">
          <div style="font-weight: bold; margin-bottom: 5px;">TARGET: ${sit.target}</div>
          <div>Need ${runsNeeded} runs</div>
          <div>${wicketsLeft} wickets remaining</div>
          <div>Current RR: ${currentRR}</div>
        </div>`;
      }
    }
    
    // Show result if match completed
    if (match.result && match.result.status === 'completed') {
      let resultText = '';
      if (match.result.winType === 'wickets') {
        resultText = `${match.result.winner} won by ${match.result.margin} wickets`;
      } else if (match.result.winType === 'runs') {
        resultText = `${match.result.winner} won by ${match.result.margin} runs`;
      } else if (match.result.winType === 'innings') {
        resultText = `${match.result.winner} won by an innings and ${match.result.margin} runs`;
      }
      
      html += `<div class="match-result">
        ${resultText}
      </div>`;
    }
  }
  
  if (currentInnings) {
    // Score Display
    html += `
      <div class="score-display">
        <div class="team-score">
          ${currentInnings.battingTeam.toUpperCase()} ${currentInnings.runs}/${currentInnings.wickets} 
          (${formatOvers(currentInnings.overs, currentInnings.balls)} overs)
        </div>
      </div>
    `;
    
    // Current Batsmen - show from allBatsmen
    if (currentInnings.striker && currentInnings.nonStriker && currentInnings.allBatsmen) {
      const strikerStats = currentInnings.allBatsmen[currentInnings.striker];
      const nonStrikerStats = currentInnings.allBatsmen[currentInnings.nonStriker];
      
      html += `<div class="batsmen">`;
      html += `
        <div class="batsman">
          <span class="batsman-name">★ ${currentInnings.striker}</span>
          <span class="batsman-stats">${strikerStats.runs}* (${strikerStats.balls})</span>
        </div>
      `;
      html += `
        <div class="batsman">
          <span class="batsman-name">${currentInnings.nonStriker}</span>
          <span class="batsman-stats">${nonStrikerStats.runs}* (${nonStrikerStats.balls})</span>
        </div>
      `;
      html += `</div>`;
    }
    
    // Current Bowler - show from allBowlers
    if (currentInnings.currentBowler && currentInnings.allBowlers && currentInnings.allBowlers[currentInnings.currentBowler.name]) {
      const bowlerStats = currentInnings.allBowlers[currentInnings.currentBowler.name];
      html += `
        <div class="bowler">
          <div><span class="bowler-name">${currentInnings.currentBowler.name}</span></div>
          <div style="margin-top: 4px;">
            ${bowlerStats.overs}.${bowlerStats.balls % 6}-${bowlerStats.maidens}-${bowlerStats.runs}-${bowlerStats.wickets}
          </div>
        </div>
      `;
    }
    
    // Current Over / Last Completed Over Display
    // If current over is empty and there's a last completed over, show that instead
    const showLastOver = (!currentInnings.currentOver || currentInnings.currentOver.length === 0) && 
                         currentInnings.lastCompletedOver;
    
    if (showLastOver) {
      const lastOver = currentInnings.lastCompletedOver;
      html += `
        <div class="current-over-section">
          <div class="over-title">Last Over (${lastOver.overNum}th - ${lastOver.bowler})</div>
          <div class="over-balls">
      `;
      
      lastOver.balls.forEach(ball => {
        let ballClass = 'ball ';
        
        if (ball.wicket) {
          ballClass += 'ball-wicket';
        } else if (ball.runs === 4 || ball.runs === 6) {
          ballClass += 'ball-boundary';
        } else if (ball.runs === 1) {
          ballClass += 'ball-single';
        } else if (ball.runs > 1) {
          ballClass += 'ball-runs';
        } else if (ball.extraType === 'Wd' || ball.extraType === 'Nb') {
          ballClass += 'ball-extra';
        } else {
          ballClass += 'ball-dot';
        }
        
        let displayText = '';
        if (ball.wicket) {
          displayText = 'W';
        } else if (ball.runs === 0 && !ball.extras) {
          displayText = '.';
        } else {
          displayText = ball.runs.toString();
          if (ball.overthrows && ball.overthrows > 0) {
            displayText += `+${ball.overthrows}ot`;
          }
          if (ball.extras > 0) {
            displayText += `+${ball.extras}`;
          }
        }
        
        if (ball.extraType) {
          displayText += ` ${ball.extraType}`;
        }
        
        html += `
          <div class="${ballClass}">
            ${ball.over}.${ball.ball}<br>
            ${displayText}
          </div>
        `;
      });
      
      html += `
          </div>
          <div style="margin-top: 8px; text-align: center;">${lastOver.runs} runs</div>
        </div>
      `;
    } else {
      // Show current over
      html += `
        <div class="current-over-section">
          <div class="over-title">Current Over (${currentInnings.overs}${currentInnings.balls > 0 ? `.${currentInnings.balls}` : ''})</div>
          <div class="over-balls">
      `;
      
      // Display balls in current over with their actual ball numbers
      // Show all balls bowled in this over (including wides/no-balls which don't increment ball count)
      if (currentInnings.currentOver && currentInnings.currentOver.length > 0) {
        currentInnings.currentOver.forEach(ball => {
          let ballClass = 'ball ';
          
          // Determine ball class based on outcome
          if (ball.wicket) {
            ballClass += 'ball-wicket';
          } else if (ball.runs === 4 || ball.runs === 6) {
            ballClass += 'ball-boundary';
          } else if (ball.runs === 1) {
            ballClass += 'ball-single';
          } else if (ball.runs > 1) {
            ballClass += 'ball-runs';
          } else if (ball.extraType === 'Wd' || ball.extraType === 'Nb') {
            ballClass += 'ball-extra';
          } else {
            ballClass += 'ball-dot';
          }
          
          let displayText = '';
          if (ball.wicket) {
            displayText = 'W';
          } else if (ball.runs === 0 && !ball.extras) {
            displayText = '.';
          } else {
            displayText = ball.runs.toString();
            if (ball.overthrows && ball.overthrows > 0) {
              displayText += `+${ball.overthrows}ot`;
            }
            if (ball.extras > 0) {
              displayText += `+${ball.extras}`;
            }
          }
          
          if (ball.extraType) {
            displayText += ` ${ball.extraType}`;
          }
          
          html += `
            <div class="${ballClass}">
              ${ball.over}.${ball.ball}<br>
              ${displayText}
            </div>
          `;
        });
      }
      
      // Show upcoming balls in the over (only if less than 6 legal deliveries)
      const legalBallsInOver = currentInnings.balls;
      for (let i = legalBallsInOver + 1; i <= 6; i++) {
        html += `
          <div class="ball ball-upcoming">
            ${currentInnings.overs}.${i}<br>
            .
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    }
    
    // Fall of Wickets
    if (currentInnings.fallOfWickets && currentInnings.fallOfWickets.length > 0) {
      html += `
        <div class="fall-of-wickets">
          <div class="fow-title">FALL OF WICKETS</div>
      `;
      currentInnings.fallOfWickets.forEach(fow => {
        html += `
          <div class="fow-item">
            ${fow.wickets}-${fow.runs} (${fow.batsman})
          </div>
        `;
      });
      html += `</div>`;
    }
    
    // Recent Overs
    if (currentInnings.recentOvers && currentInnings.recentOvers.length > 0) {
      html += `
        <div class="recent-overs">
          <div class="recent-overs-title">RECENT OVERS</div>
      `;
      const recentOvers = currentInnings.recentOvers.slice(-5).reverse();
      recentOvers.forEach(over => {
        html += `
          <div class="over-summary">
            Over ${over.over}: ${over.runs} runs
          </div>
        `;
      });
      html += `</div>`;
    }
  } else {
    html += `
      <div class="no-match">
        <p>MATCH NOT YET STARTED</p>
      </div>
    `;
  }
  
  content.innerHTML = html;
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'TBC';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Update refresh indicator
function updateRefreshIndicator() {
  const indicator = document.getElementById('refresh-indicator');
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-GB');
  indicator.textContent = `Last updated: ${timeString}`;
  
  // Flash briefly
  indicator.classList.add('refreshing');
  setTimeout(() => {
    indicator.classList.remove('refreshing');
  }, 500);
}

// Start auto-refresh (every 5 seconds)
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(() => {
    loadMatch();
  }, 5000);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  updateHeaderDateTime();
  loadMatch();
  startAutoRefresh();
  
  // Update time every second
  setInterval(updateHeaderDateTime, 1000);
});
