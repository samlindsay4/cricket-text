// Admin Interface JavaScript

let sessionId = null;
let currentMatch = null;

// Initialize squad inputs on page load
document.addEventListener('DOMContentLoaded', () => {
  const passwordField = document.getElementById('password');
  if (passwordField) {
    passwordField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        login();
      }
    });
  }
  
  // Initialize squad input fields
  initializeSquadInputs();
});

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
      const loginSection = document.getElementById('login-section');
      const adminSection = document.getElementById('admin-section');
      loginSection.classList.add('hidden');
      loginSection.style.display = 'none';
      adminSection.classList.remove('hidden');
      adminSection.style.display = 'block';
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
    
    // Show start innings section if:
    // - Match is upcoming, OR
    // - No current innings exists, OR
    // - Current innings is all out (10 wickets), OR
    // - Current innings is declared or completed
    const inningsCompleted = currentInnings && (currentInnings.status === 'completed' || currentInnings.declared);
    if (currentMatch.status === 'upcoming' || !currentInnings || currentInnings.wickets >= 10 || inningsCompleted) {
      inningsSection.classList.remove('hidden');
      scoringSection.classList.add('hidden');
      // Initialize batting order and opening bowler dropdowns when showing start innings section
      initializeBattingOrderDropdowns();
      initializeOpeningBowlerDropdown();
    } else {
      inningsSection.classList.add('hidden');
      scoringSection.classList.remove('hidden');
    }
  }
}

// Initialize opening bowler dropdown
function initializeOpeningBowlerDropdown() {
  if (!currentMatch) return;
  
  const bowlingTeam = document.getElementById('bowling-team').value;
  const squad = currentMatch.squads[bowlingTeam] || [];
  
  const openingBowlerSelect = document.getElementById('opening-bowler');
  if (!openingBowlerSelect) return;
  
  openingBowlerSelect.innerHTML = '<option value="">Select bowler...</option>';
  squad.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    openingBowlerSelect.appendChild(option);
  });
}

// Update scoring interface with dropdown for bowler
function updateScoringInterface() {
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  
  // Populate bowler dropdown
  const bowlerSelect = document.getElementById('bowler');
  const bowlingTeam = currentInnings.bowlingTeam;
  const bowlingSquad = currentMatch.squads[bowlingTeam] || [];
  
  // Get all bowlers who have bowled (including substitutes)
  const allBowlers = Object.keys(currentInnings.allBowlers || {});
  
  // Combine squad bowlers and any additional bowlers who have already bowled
  const bowlerOptions = [...new Set([...bowlingSquad, ...allBowlers])];
  
  // Get previous bowler (if any) to exclude from selection
  const previousBowler = getPreviousBowler(currentInnings);
  
  bowlerSelect.innerHTML = '<option value="">Select bowler...</option>';
  bowlerOptions.forEach(name => {
    // Don't include previous bowler if we're at the start of a new over
    if (currentInnings.balls === 0 && name === previousBowler) {
      return; // Skip this bowler
    }
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (currentInnings.currentBowler && currentInnings.currentBowler.name === name) {
      option.selected = true;
    }
    bowlerSelect.appendChild(option);
  });
  
  // Populate dismissed batsman dropdown (striker and non-striker)
  const dismissedBatsman = document.getElementById('dismissed-batsman');
  if (currentInnings.striker && currentInnings.nonStriker) {
    dismissedBatsman.innerHTML = `
      <option value="${currentInnings.striker}">${currentInnings.striker}</option>
      <option value="${currentInnings.nonStriker}">${currentInnings.nonStriker}</option>
    `;
  }
  
  // Update scorecard preview
  updateScorecardPreview();
  
  // Update ball history
  updateBallHistory();
  
  // Update undo button state
  updateUndoButton();
}

// Helper function to get the previous bowler (who bowled the last over)
function getPreviousBowler(innings) {
  if (!innings.allBalls || innings.allBalls.length === 0) {
    return null;
  }
  
  // If we're at the start of a new over (balls === 0), find the bowler from the previous over
  if (innings.balls === 0 && innings.allBalls.length > 0) {
    // Get the last ball bowled (which was the last ball of the previous over)
    const lastBall = innings.allBalls[innings.allBalls.length - 1];
    return lastBall.bowler;
  }
  
  return null;
}

// Initialize batting order dropdowns
function initializeBattingOrderDropdowns() {
  if (!currentMatch) return;
  
  const battingTeam = document.getElementById('batting-team').value;
  const squad = currentMatch.squads[battingTeam] || [];
  
  const container = document.getElementById('batting-order-container');
  container.innerHTML = '';
  
  for (let i = 1; i <= 11; i++) {
    const div = document.createElement('div');
    div.className = 'form-group';
    // Pre-select the i-th player (index i-1) as default
    const defaultPlayer = squad[i - 1] || squad[0];
    div.innerHTML = `
      <label for="batting-order-${i}">${i}. Batsman</label>
      <select id="batting-order-${i}" required>
        ${squad.map(name => `<option value="${name}" ${name === defaultPlayer ? 'selected' : ''}>${name}</option>`).join('')}
      </select>
    `;
    container.appendChild(div);
  }
}

// Update batting order dropdowns when team changes
function updateBattingOrderDropdowns() {
  initializeBattingOrderDropdowns();
}

// Update bowling team dropdowns (now updates opening bowler dropdown)
function updateBowlingTeamDropdowns() {
  initializeOpeningBowlerDropdown();
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
  
  // Show current striker and non-striker from allBatsmen
  if (innings.striker && innings.nonStriker && innings.allBatsmen) {
    const strikerStats = innings.allBatsmen[innings.striker];
    const nonStrikerStats = innings.allBatsmen[innings.nonStriker];
    
    if (strikerStats && nonStrikerStats) {
      html += '<div class="batsmen-list">';
      html += `<div><strong>★ ${innings.striker}:</strong> ${strikerStats.runs}* (${strikerStats.balls}) [${strikerStats.fours}x4, ${strikerStats.sixes}x6]</div>`;
      html += `<div>${innings.nonStriker}: ${nonStrikerStats.runs}* (${nonStrikerStats.balls}) [${nonStrikerStats.fours}x4, ${nonStrikerStats.sixes}x6]</div>`;
      html += '</div>';
    }
  }
  
  // Show current bowler from allBowlers
  if (innings.currentBowler && innings.allBowlers && innings.allBowlers[innings.currentBowler.name]) {
    const bowlerStats = innings.allBowlers[innings.currentBowler.name];
    html += `
      <div class="bowler-info">
        ${innings.currentBowler.name}: ${bowlerStats.overs}.${bowlerStats.balls % 6}-${bowlerStats.maidens}-${bowlerStats.runs}-${bowlerStats.wickets}
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
  
  // Collect England squad
  const englandSquad = [];
  for (let i = 1; i <= 11; i++) {
    const input = document.getElementById(`england-${i}`);
    if (!input || !input.value.trim()) {
      showMessage(`Please fill in England player ${i}`, 'error');
      return;
    }
    englandSquad.push(input.value.trim());
  }
  
  // Collect Australia squad
  const australiaSquad = [];
  for (let i = 1; i <= 11; i++) {
    const input = document.getElementById(`australia-${i}`);
    if (!input || !input.value.trim()) {
      showMessage(`Please fill in Australia player ${i}`, 'error');
      return;
    }
    australiaSquad.push(input.value.trim());
  }
  
  try {
    const response = await fetch('/api/match/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ testNumber, venue, date, englandSquad, australiaSquad })
    });
    
    if (response.ok) {
      showMessage('Match created successfully!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to create match: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Start innings
async function startInnings() {
  const battingTeam = document.getElementById('batting-team').value;
  const bowlingTeam = document.getElementById('bowling-team').value;
  const openingBowler = document.getElementById('opening-bowler').value;
  
  if (battingTeam === bowlingTeam) {
    showMessage('Batting and bowling teams must be different', 'error');
    return;
  }
  
  if (!openingBowler) {
    showMessage('Please select an opening bowler', 'error');
    return;
  }
  
  // Collect batting order
  const battingOrder = [];
  for (let i = 1; i <= 11; i++) {
    const select = document.getElementById(`batting-order-${i}`);
    if (!select || !select.value) {
      showMessage(`Please select batsman ${i}`, 'error');
      return;
    }
    battingOrder.push(select.value);
  }
  
  // Check for duplicate batsmen
  const uniqueBatsmen = new Set(battingOrder);
  if (uniqueBatsmen.size !== 11) {
    showMessage('Each batsman must be selected only once', 'error');
    return;
  }
  
  // Validate all batsmen are from batting team squad
  const battingSquad = currentMatch.squads[battingTeam] || [];
  const invalidBatsmen = battingOrder.filter(b => !battingSquad.includes(b));
  if (invalidBatsmen.length > 0) {
    showMessage(`Invalid batsmen selected: ${invalidBatsmen.join(', ')}`, 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/start-innings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ 
        battingTeam, 
        bowlingTeam, 
        battingOrder,
        openingBowler 
      })
    });
    
    if (response.ok) {
      showMessage('Innings started!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to start innings: ' + (error.error || 'Unknown error'), 'error');
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
  
  // Update total runs display
  updateTotalRuns();
}

// Update total runs display
function updateTotalRuns() {
  const runs = parseInt(document.getElementById('runs').value) || 0;
  const overthrows = parseInt(document.getElementById('overthrows').value) || 0;
  const totalRuns = runs + overthrows;
  
  const display = document.getElementById('total-runs-display');
  if (overthrows > 0) {
    display.textContent = `${runs} + ${overthrows}ot = ${totalRuns}`;
  } else {
    display.textContent = totalRuns;
  }
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
  const bowler = document.getElementById('bowler').value;
  const runs = parseInt(document.getElementById('runs').value) || 0;
  const overthrows = parseInt(document.getElementById('overthrows').value) || 0;
  const extraType = document.getElementById('extra-type').value;
  const extras = parseInt(document.getElementById('extras').value) || 0;
  const wicket = document.getElementById('wicket').checked;
  const wicketType = wicket ? document.getElementById('wicket-type').value : null;
  const dismissedBatsman = wicket ? document.getElementById('dismissed-batsman').value : null;
  
  if (!bowler) {
    showMessage('Please select a bowler', 'error');
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
        bowler,
        runs,
        overthrows,
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
      document.getElementById('overthrows').value = '0';
      document.getElementById('extra-type').value = '';
      document.getElementById('extras').value = '0';
      document.getElementById('wicket').checked = false;
      toggleWicketDetails();
      updateTotalRuns();
      
      // Reset button opacity
      document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.style.opacity = '1';
      });
      
      // Reload match data
      await loadMatchStatus();
      
      // If wicket was taken and not all out, show choose batsman modal
      if (wicket && currentMatch && currentMatch.innings && currentMatch.innings.length > 0) {
        const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
        if (currentInnings.wickets < 10) {
          // Small delay to allow data to refresh
          setTimeout(() => {
            showChooseBatsmanModal();
          }, 300);
        }
      }
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

// Initialize squad inputs
function initializeSquadInputs() {
  const englandContainer = document.getElementById('england-squad-container');
  const australiaContainer = document.getElementById('australia-squad-container');
  
  if (englandContainer) {
    englandContainer.innerHTML = '';
    for (let i = 1; i <= 11; i++) {
      const div = document.createElement('div');
      div.className = 'form-group';
      div.innerHTML = `
        <label for="england-${i}">${i}. Player</label>
        <input type="text" id="england-${i}" placeholder="Player name" required>
      `;
      englandContainer.appendChild(div);
    }
  }
  
  if (australiaContainer) {
    australiaContainer.innerHTML = '';
    for (let i = 1; i <= 11; i++) {
      const div = document.createElement('div');
      div.className = 'form-group';
      div.innerHTML = `
        <label for="australia-${i}">${i}. Player</label>
        <input type="text" id="australia-${i}" placeholder="Player name" required>
      `;
      australiaContainer.appendChild(div);
    }
  }
}

// Undo last ball
async function undoLastBall() {
  if (!confirm('Undo the last ball? This will recalculate all stats.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/undo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      }
    });
    
    if (response.ok) {
      showMessage('Ball undone successfully!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to undo: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Show change bowler modal
function showChangeBowlerModal() {
  const modal = document.getElementById('change-bowler-modal');
  modal.classList.remove('hidden');
  
  // Pre-fill with current bowler
  if (currentMatch && currentMatch.innings && currentMatch.innings.length > 0) {
    const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
    if (currentInnings.currentBowler) {
      document.getElementById('new-bowler-name').value = currentInnings.currentBowler.name;
    }
  }
}

function hideChangeBowlerModal() {
  const modal = document.getElementById('change-bowler-modal');
  modal.classList.add('hidden');
}

// Change bowler
async function changeBowler() {
  const bowlerName = document.getElementById('new-bowler-name').value.trim();
  
  if (!bowlerName) {
    showMessage('Please enter bowler name', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/change-bowler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ bowlerName })
    });
    
    if (response.ok) {
      showMessage('Bowler changed!', 'success');
      hideChangeBowlerModal();
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to change bowler: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Declare innings
async function declareInnings() {
  if (!confirm('Declare this innings? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/declare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      showMessage(data.message || 'Innings declared!', 'success');
      // Reload will automatically show start innings section
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to declare: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// End innings
async function endInnings() {
  if (!confirm('End this innings? This action cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/end-innings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      }
    });
    
    if (response.ok) {
      showMessage('Innings ended!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to end innings: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Confirm delete match
async function confirmDeleteMatch() {
  if (!confirm('⚠️ DELETE MATCH?\n\nThis will delete ALL match data and cannot be undone.\n\nAre you absolutely sure?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      }
    });
    
    if (response.ok) {
      showMessage('Match deleted!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to delete match: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Show edit ball modal
function showEditBallModal(ballIndex) {
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  const ball = currentInnings.allBalls[ballIndex];
  
  if (!ball) return;
  
  const modal = document.getElementById('edit-ball-modal');
  document.getElementById('edit-ball-index').value = ballIndex;
  document.getElementById('edit-ball-title').textContent = `Over ${ball.over}.${ball.ball}`;
  document.getElementById('edit-runs').value = ball.runs || 0;
  document.getElementById('edit-extras').value = ball.extras || 0;
  document.getElementById('edit-extra-type').value = ball.extraType || '';
  document.getElementById('edit-wicket').checked = ball.wicket || false;
  document.getElementById('edit-wicket-type').value = ball.wicketType || 'bowled';
  document.getElementById('edit-dismissed-batsman').value = ball.dismissedBatsman || '';
  
  toggleEditWicketDetails();
  modal.classList.remove('hidden');
}

function hideEditBallModal() {
  const modal = document.getElementById('edit-ball-modal');
  modal.classList.add('hidden');
}

function toggleEditWicketDetails() {
  const wicketChecked = document.getElementById('edit-wicket').checked;
  const wicketDetails = document.getElementById('edit-wicket-details');
  
  if (wicketChecked) {
    wicketDetails.classList.remove('hidden');
  } else {
    wicketDetails.classList.add('hidden');
  }
}

// Save edited ball
async function saveEditBall() {
  const ballIndex = parseInt(document.getElementById('edit-ball-index').value);
  const runs = parseInt(document.getElementById('edit-runs').value) || 0;
  const extras = parseInt(document.getElementById('edit-extras').value) || 0;
  const extraType = document.getElementById('edit-extra-type').value;
  const wicket = document.getElementById('edit-wicket').checked;
  const wicketType = wicket ? document.getElementById('edit-wicket-type').value : null;
  const dismissedBatsman = wicket ? document.getElementById('edit-dismissed-batsman').value : null;
  
  try {
    const response = await fetch('/api/match/edit-ball', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({
        ballIndex,
        runs,
        extras,
        extraType,
        wicket,
        wicketType,
        dismissedBatsman
      })
    });
    
    if (response.ok) {
      showMessage('Ball edited successfully!', 'success');
      hideEditBallModal();
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to edit ball: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Update ball history display
function updateBallHistory() {
  const historyDiv = document.getElementById('ball-history');
  
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    historyDiv.innerHTML = '<div class="loading">No balls recorded</div>';
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  const balls = currentInnings.allBalls || [];
  
  if (balls.length === 0) {
    historyDiv.innerHTML = '<div class="loading">No balls recorded</div>';
    return;
  }
  
  // Show last 30 balls
  const recentBalls = balls.slice(-30).reverse();
  
  let html = '';
  recentBalls.forEach((ball, idx) => {
    const actualIndex = balls.length - 1 - idx;
    let runsText = ball.runs.toString();
    
    // Add overthrows if present
    if (ball.overthrows && ball.overthrows > 0) {
      runsText += ` + ${ball.overthrows}ot`;
    }
    
    // Add extras if present
    if (ball.extras) {
      runsText += `+${ball.extras}`;
    }
    
    const extraText = ball.extraType ? ` (${ball.extraType})` : '';
    const wicketText = ball.wicket ? ' 🔴 WICKET' : '';
    
    html += `
      <div class="ball-item">
        <div class="ball-info">
          ${ball.over}.${ball.ball}: ${ball.batsman} ${runsText}${extraText} - ${ball.bowler}${wicketText}
        </div>
        <div class="ball-actions">
          <button class="btn btn-secondary" onclick="showEditBallModal(${actualIndex})">Edit</button>
        </div>
      </div>
    `;
  });
  
  historyDiv.innerHTML = html;
}

// Update undo button state
function updateUndoButton() {
  const undoBtn = document.getElementById('undo-btn');
  if (!undoBtn) return;
  
  if (currentMatch && currentMatch.innings && currentMatch.innings.length > 0) {
    const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
    if (currentInnings.allBalls && currentInnings.allBalls.length > 0) {
      undoBtn.disabled = false;
      return;
    }
  }
  
  undoBtn.disabled = true;
}

// Show choose batsman modal after wicket
function showChooseBatsmanModal() {
  const modal = document.getElementById('choose-batsman-modal');
  const select = document.getElementById('incoming-batsman');
  
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  
  // Get remaining batsmen (not yet batted)
  const remainingBatsmen = currentInnings.battingOrder.filter(name => {
    return !currentInnings.allBatsmen[name] || currentInnings.allBatsmen[name].status === 'not batted';
  });
  
  // Populate dropdown
  select.innerHTML = '<option value="">-- Select batsman --</option>';
  
  // Add next batsman as default (if available)
  const nextInOrder = currentInnings.nextBatsmanIndex < currentInnings.battingOrder.length 
    ? currentInnings.battingOrder[currentInnings.nextBatsmanIndex] 
    : null;
  
  remainingBatsmen.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === nextInOrder) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  
  modal.classList.remove('hidden');
}

// Confirm incoming batsman selection
async function confirmIncomingBatsman() {
  const batsmanName = document.getElementById('incoming-batsman').value;
  
  if (!batsmanName) {
    showMessage('Please select a batsman', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/match/select-incoming-batsman', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ batsmanName })
    });
    
    if (response.ok) {
      const modal = document.getElementById('choose-batsman-modal');
      modal.classList.add('hidden');
      showMessage('Batsman selected!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to select batsman: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Swap strike manually
async function swapStrike() {
  if (!confirm('Swap striker and non-striker?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/swap-strike', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      }
    });
    
    if (response.ok) {
      showMessage('Strike swapped!', 'success');
      loadMatchStatus();
    } else {
      const error = await response.json();
      showMessage('Failed to swap strike: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

// Show retire batsman modal
function showRetireBatsmanModal() {
  const modal = document.getElementById('retire-batsman-modal');
  const select = document.getElementById('retire-batsman-select');
  
  if (!currentMatch || !currentMatch.innings || currentMatch.innings.length === 0) {
    showMessage('No active innings', 'error');
    return;
  }
  
  const currentInnings = currentMatch.innings[currentMatch.innings.length - 1];
  
  // Get current batsmen
  select.innerHTML = '<option value="">-- Select batsman --</option>';
  
  if (currentInnings.striker) {
    const option = document.createElement('option');
    option.value = currentInnings.striker;
    option.textContent = currentInnings.striker + ' (striker)';
    select.appendChild(option);
  }
  
  if (currentInnings.nonStriker) {
    const option = document.createElement('option');
    option.value = currentInnings.nonStriker;
    option.textContent = currentInnings.nonStriker + ' (non-striker)';
    select.appendChild(option);
  }
  
  modal.classList.remove('hidden');
}

function hideRetireBatsmanModal() {
  const modal = document.getElementById('retire-batsman-modal');
  modal.classList.add('hidden');
}

// Confirm retire batsman
async function confirmRetireBatsman() {
  const batsmanName = document.getElementById('retire-batsman-select').value;
  const retireType = document.getElementById('retire-type').value;
  
  if (!batsmanName || !retireType) {
    showMessage('Please select batsman and retirement type', 'error');
    return;
  }
  
  if (!confirm(`Retire ${batsmanName} (${retireType})?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/match/retire-batsman', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId
      },
      body: JSON.stringify({ batsmanName, retireType })
    });
    
    if (response.ok) {
      hideRetireBatsmanModal();
      showMessage('Batsman retired!', 'success');
      
      // Show choose batsman modal to select replacement
      setTimeout(() => {
        showChooseBatsmanModal();
      }, 500);
    } else {
      const error = await response.json();
      showMessage('Failed to retire batsman: ' + (error.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}
