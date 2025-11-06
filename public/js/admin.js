// Admin Interface JavaScript

let sessionId = null;
let currentMatch = null;

// Login
async function login() {
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      sessionId = data.sessionId;
      document.getElementById('login-section').classList.add('hidden');
      document.getElementById('admin-section').classList.remove('hidden');
      loadMatchStatus();
    } else {
      errorDiv.textContent = 'Invalid password';
      errorDiv.classList.remove('hidden');
    }
  } catch (error) {
    errorDiv.textContent = 'Login failed: ' + error.message;
    errorDiv.classList.remove('hidden');
  }
}

// Load match status
async function loadMatchStatus() {
  try {
    const response = await fetch('/api/match');
    currentMatch = await response.json();
    
    displayMatchStatus();
    updateScoringInterface();
  } catch (error) {
    console.error('Error loading match:', error);
  }
}

// Display match status
function displayMatchStatus() {
  const statusDiv = document.getElementById('match-status');
  const createSection = document.getElementById('create-match-section');
  const inningsSection = document.getElementById('start-innings-section');
  const scoringSection = document.getElementById('scoring-section');
  
  if (!currentMatch || !currentMatch.id || currentMatch.status === 'no-match') {
    statusDiv.innerHTML = `
      <div class="match-info">
        <p>No match currently active</p>
      </div>
    `;
    createSection.classList.remove('hidden');
    inningsSection.classList.add('hidden');
    scoringSection.classList.add('hidden');
  } else {
    const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
    
    statusDiv.innerHTML = `
      <div class="match-info">
        <h3>${currentMatch.title}</h3>
        <p>${currentMatch.venue} - ${formatDate(currentMatch.date)}</p>
        <p>Status: <span class="status ${currentMatch.status}">${currentMatch.status.toUpperCase()}</span></p>
        ${currentInnings ? `
          <p style="margin-top: 10px;">
            <strong>${currentInnings.battingTeam} ${currentInnings.runs}/${currentInnings.wickets}</strong>
            (${currentInnings.overs}.${currentInnings.balls} overs)
          </p>
        ` : ''}
      </div>
    `;
    
    createSection.classList.add('hidden');
    
    if (currentMatch.status === 'upcoming' || !currentInnings || currentInnings.wickets >= 10) {
      inningsSection.classList.remove('hidden');
      scoringSection.classList.add('hidden');
    } else {
      inningsSection.classList.add('hidden');
      scoringSection.classList.remove('hidden');
    }
  }
}

// Update scoring interface with squad dropdowns
function updateScoringInterface() {
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  const battingSquad = currentMatch.squads[currentInnings.battingTeam] || [];
  const bowlingSquad = currentMatch.squads[currentInnings.bowlingTeam] || [];
  
  // Populate batsman dropdowns
  const batsman1 = document.getElementById('batsman1');
  const batsman2 = document.getElementById('batsman2');
  const dismissedBatsman = document.getElementById('dismissed-batsman');
  
  batsman1.innerHTML = battingSquad.map(name => 
    `<option value="${name}">${name}</option>`
  ).join('');
  batsman2.innerHTML = batsman1.innerHTML;
  dismissedBatsman.innerHTML = batsman1.innerHTML;
  
  // Populate bowler dropdown
  const bowler = document.getElementById('bowler');
  bowler.innerHTML = bowlingSquad.map(name => 
    `<option value="${name}">${name}</option>`
  ).join('');
  
  // Update scorecard preview
  updateScorecardPreview();
}

// Update scorecard preview
function updateScorecardPreview() {
  const preview = document.getElementById('scorecard-preview');
  
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    preview.innerHTML = '<div class="loading">No innings active</div>';
    return;
  }
  
  const innings = currentMatch.innings[currentMatch.innings.length - 1];
  
  let html = `
    <div class="score-line">
      ${innings.battingTeam.toUpperCase()} ${innings.runs}/${innings.wickets} 
      (${innings.overs}.${innings.balls} overs)
    </div>
  `;
  
  if (innings.currentBatsmen && innings.currentBatsmen.length > 0) {
    html += '<div class="batsmen-list">';
    innings.currentBatsmen.forEach(bat => {
      html += `<div>${bat.name}: ${bat.runs} (${bat.balls})</div>`;
    });
    html += '</div>';
  }
  
  if (innings.currentBowler) {
    html += `
      <div class="bowler-info">
        ${innings.currentBowler.name}: ${innings.currentBowler.overs}-${innings.currentBowler.maidens}-${innings.currentBowler.runs}-${innings.currentBowler.wickets}
      </div>
    `;
  }
  
  preview.innerHTML = html;
}

// Create match
async function createMatch() {
  const testNumber = parseInt(document.getElementById('test-number').value);
  const venue = document.getElementById('venue').value;
  const date = document.getElementById('match-date').value;
  
  if (!venue || !date) {
    showMessage('Please fill in all fields', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ testNumber, venue, date })
    });
    
    if (response.ok) {
      showMessage('Match created successfully!', 'success');
      loadMatchStatus();
    } else {
      showMessage('Failed to create match', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Start innings
async function startInnings() {
  const battingTeam = document.getElementById('batting-team').value;
  const bowlingTeam = document.getElementById('bowling-team').value;
  
  if (battingTeam === bowlingTeam) {
    showMessage('Batting and bowling teams must be different', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/start-innings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ battingTeam, bowlingTeam })
    });
    
    if (response.ok) {
      showMessage('Innings started!', 'success');
      loadMatchStatus();
    } else {
      showMessage('Failed to start innings', 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Set runs from quick button
function setRuns(runs, event) {
  document.getElementById('runs').value = runs;
  
  // Visual feedback
  document.querySelectorAll('.quick-btn:not(.extra)').forEach(btn => {
    btn.style.opacity = '1';
  });
  event.target.style.opacity = '0.6';
}

// Set extra type from quick button
function setExtra(type, event) {
  document.getElementById('extra-type').value = type;
  
  // Visual feedback
  document.querySelectorAll('.quick-btn.extra').forEach(btn => {
    btn.style.opacity = '1';
  });
  event.target.style.opacity = '0.6';
  
  // Auto-set extras value for wides and no-balls
  if (type === 'Wd' || type === 'Nb') {
    document.getElementById('extras').value = '1';
  }
}

// Toggle wicket details
function toggleWicketDetails() {
  const wicketChecked = document.getElementById('wicket').checked;
  const wicketDetails = document.getElementById('wicket-details');
  
  if (wicketChecked) {
    wicketDetails.classList.remove('hidden');
  } else {
    wicketDetails.classList.add('hidden');
  }
}

// Record ball
async function recordBall() {
  const batsman1 = document.getElementById('batsman1').value;
  const batsman2 = document.getElementById('batsman2').value;
  const bowler = document.getElementById('bowler').value;
  const runs = parseInt(document.getElementById('runs').value) || 0;
  const extraType = document.getElementById('extra-type').value;
  const extras = parseInt(document.getElementById('extras').value) || 0;
  const wicket = document.getElementById('wicket').checked;
  const wicketType = wicket ? document.getElementById('wicket-type').value : null;
  const dismissedBatsman = wicket ? document.getElementById('dismissed-batsman').value : null;
  
  if (!batsman1 || !batsman2 || !bowler) {
    showMessage('Please select batsmen and bowler', 'error');
    return;
  }
  
  if (batsman1 === batsman2) {
    showMessage('Batsmen must be different players', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/ball', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({
        batsman1,
        batsman2,
        bowler,
        runs,
        extras,
        extraType,
        wicket,
        wicketType,
        dismissedBatsman
      })
    });
    
    if (response.ok) {
      showMessage('Ball recorded!', 'success');
      
      // Reset form
      document.getElementById('runs').value = '0';
      document.getElementById('extra-type').value = '';
      document.getElementById('extras').value = '0';
      document.getElementById('wicket').checked = false;
      toggleWicketDetails();
      
      // Reset button opacity
      document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.style.opacity = '1';
      });
      
      // Reload match data
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to record ball: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Show message
function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = `alert alert-${type}`;
  messageDiv.classList.remove('hidden');
  
  setTimeout(() => {
    messageDiv.classList.add('hidden');
  }, 3000);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'TBC';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Handle Enter key on password field
document.addEventListener('DOMContentLoaded', () => {
  const passwordField = document.getElementById('password');
  if (passwordField) {
    passwordField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        login();
      }
    });
  }
});
