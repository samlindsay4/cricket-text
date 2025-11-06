// Scorecard JavaScript for Public View (Page 340)

let refreshInterval = null;

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
    
    // Current Over Display
    html += `
      <div class="current-over-section">
        <div class="over-title">Current Over (${currentInnings.overs}${currentInnings.balls > 0 ? `.${currentInnings.balls}` : ''})</div>
        <div class="over-balls">
    `;
    
    // Display balls in current over with color coding
    for (let i = 1; i <= 6; i++) {
      const ball = currentInnings.currentOver && currentInnings.currentOver[i - 1];
      if (ball) {
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
        } else {
          ballClass += 'ball-dot';
        }
        
        const displayRuns = ball.wicket ? 'W' : (ball.runs === 0 ? '.' : ball.runs);
        const extraText = ball.extras > 0 ? `+${ball.extras}` : '';
        
        html += `
          <div class="${ballClass}">
            ${currentInnings.overs}.${i}<br>
            ${displayRuns}${extraText}
          </div>
        `;
      } else {
        html += `
          <div class="ball ball-upcoming">
            ${currentInnings.overs}.${i}<br>
            .
          </div>
        `;
      }
    }
    
    html += `
        </div>
      </div>
    `;
    
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
