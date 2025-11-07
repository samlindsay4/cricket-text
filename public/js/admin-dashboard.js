// Admin Dashboard JavaScript
let sessionId = null;
let currentSeriesId = null;

/**
 * Login function
 */
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
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('admin-section').classList.remove('hidden');
            document.getElementById('admin-section').style.display = 'block';
            loadDashboard();
        } else {
            errorDiv.textContent = data.message || 'Invalid password';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login failed';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Logout function
 */
function logout() {
    sessionId = null;
    document.getElementById('admin-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('password').value = '';
}

/**
 * Show specific tab
 */
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    
    // Load data for the tab
    if (tabName === 'series') {
        loadSeries();
    } else if (tabName === 'news') {
        loadNews();
    }
}

/**
 * Load dashboard
 */
function loadDashboard() {
    showTab('series');
}

/**
 * Load all series
 */
async function loadSeries() {
    try {
        const response = await fetch('/api/series/list');
        const series = await response.json();
        
        const listDiv = document.getElementById('series-list');
        
        if (series.length === 0) {
            listDiv.innerHTML = '<div style="text-align: center; color: #ffff00; padding: 20px;">No series created yet. Click "Create New Series" to get started.</div>';
            return;
        }
        
        let html = '';
        series.forEach(s => {
            const seriesScore = Object.entries(s.seriesScore)
                .map(([team, wins]) => `${team}: ${wins}`)
                .join(' | ');
            
            html += `
                <div class="series-item">
                    <h3>${s.name}</h3>
                    <div style="color: #00ffff; margin: 5px 0;">
                        ${s.team1} vs ${s.team2}
                    </div>
                    <div style="color: #00ff00; font-size: 14px; margin: 5px 0;">
                        Series Score: ${seriesScore}
                    </div>
                    <div style="color: #888; font-size: 12px;">
                        Pages ${s.startPage} - ${s.endPage}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-small" onclick="viewSeries('${s.id || s.dirName}')">View Matches</button>
                        <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${s.startPage}', '_blank')">View Public Page</button>
                        <button class="btn btn-danger btn-small" onclick="deleteSeries('${s.id || s.dirName}', '${s.name}')">Delete</button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading series:', error);
        document.getElementById('series-list').innerHTML = '<div style="color: #ff0000;">Failed to load series</div>';
    }
}

/**
 * View series details and matches
 */
async function viewSeries(seriesId) {
    try {
        const response = await fetch(`/api/series/${seriesId}`);
        const series = await response.json();
        
        const listDiv = document.getElementById('series-list');
        
        let html = `
            <div style="margin-bottom: 20px;">
                <button class="btn btn-secondary" onclick="loadSeries()">← Back to All Series</button>
            </div>
            
            <div class="series-item">
                <h2>${series.name}</h2>
                <div style="color: #00ffff; margin: 10px 0; font-size: 16px;">
                    ${series.team1} vs ${series.team2}
                </div>
                <div style="color: #00ff00; font-size: 16px; margin: 10px 0;">
                    Series Score: ${Object.entries(series.seriesScore).map(([t, w]) => `${t}: ${w}`).join(' | ')}
                </div>
                <div style="color: #888; margin: 10px 0;">
                    Pages ${series.startPage} - ${series.endPage}
                </div>
            </div>
            
            <h3 style="margin-top: 30px;">Matches</h3>
        `;
        
        series.matches.forEach(match => {
            const statusColor = match.status === 'completed' ? '#00ff00' :
                              match.status === 'live' ? '#ff0000' : '#ffff00';
            
            html += `
                <div class="series-item">
                    <h4 style="color: ${statusColor};">${match.title} ${match.status === 'live' ? '(LIVE)' : ''}</h4>
                    <div style="color: #00ffff; margin: 5px 0;">
                        ${match.venue || 'Venue not set'}
                    </div>
                    <div style="color: #888; font-size: 12px;">
                        ${match.date || 'Date not set'} | Status: ${match.status}
                    </div>
                    ${match.result ? `<div style="color: #00ff00; margin-top: 5px;">${match.result}</div>` : ''}
                    <div class="btn-group">
                        ${match.status === 'upcoming' && !match.venue ? `
                            <button class="btn btn-primary btn-small" onclick="showCreateMatchModal('${seriesId}', ${match.number}, '${series.team1}', '${series.team2}')">Setup Match</button>
                        ` : `
                            <button class="btn btn-primary btn-small" onclick="manageMatch('${seriesId}', '${match.id}')">Manage Match</button>
                        `}
                        ${match.status !== 'upcoming' || match.venue ? `
                            <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${series.startPage + 1}', '_blank')">View Live Score</button>
                            <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${series.startPage + 2}', '_blank')">View Scorecard</button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading series details:', error);
    }
}

/**
 * Delete series
 */
async function deleteSeries(seriesId, seriesName) {
    if (!confirm(`Are you sure you want to delete "${seriesName}"? This will delete all matches and cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${seriesId}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Series deleted successfully');
            loadSeries();
        } else {
            alert('Failed to delete series: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting series:', error);
        alert('Failed to delete series');
    }
}

/**
 * Show create series modal
 */
function showCreateSeriesModal() {
    document.getElementById('create-series-modal').style.display = 'block';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    
    // Update page range when start page changes
    document.getElementById('start-page').addEventListener('input', () => {
        const startPage = parseInt(document.getElementById('start-page').value) || 0;
        const endPage = startPage + 19;
        document.getElementById('page-range').textContent = `${startPage} - ${endPage}`;
    });
}

/**
 * Create series
 */
async function createSeries() {
    const name = document.getElementById('series-name').value;
    const team1 = document.getElementById('team1').value;
    const team2 = document.getElementById('team2').value;
    const numMatches = parseInt(document.getElementById('num-matches').value);
    const startPage = parseInt(document.getElementById('start-page').value);
    
    if (!name || !team1 || !team2 || !startPage) {
        alert('Please fill in all fields');
        return;
    }
    
    if (startPage < 350) {
        alert('Start page must be 350 or higher');
        return;
    }
    
    try {
        const response = await fetch('/api/series/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ name, team1, team2, numMatches, startPage })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Series created successfully!');
            closeModal('create-series-modal');
            loadSeries();
        } else {
            alert('Failed to create series: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating series:', error);
        alert('Failed to create series');
    }
}

/**
 * Load news
 */
async function loadNews() {
    try {
        const response = await fetch('/api/news');
        const news = await response.json();
        
        const listDiv = document.getElementById('news-list');
        
        if (news.length === 0) {
            listDiv.innerHTML = '<div style="text-align: center; color: #ffff00; padding: 20px;">No news stories yet. Click "Create News Story" to add one.</div>';
            return;
        }
        
        let html = '';
        news.forEach(item => {
            html += `
                <div class="series-item">
                    <h3>Page ${item.page}: ${item.title}</h3>
                    <div style="color: #888; font-size: 12px; margin: 5px 0;">
                        ${item.date} | ${item.published ? '<span style="color: #00ff00;">Published</span>' : '<span style="color: #ff0000;">Unpublished</span>'}
                    </div>
                    <div style="color: #00ffff; margin: 10px 0; font-size: 14px;">
                        ${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${item.page}', '_blank')">View</button>
                        <button class="btn btn-primary btn-small" onclick="togglePublish('${item.id}', ${!item.published})">${item.published ? 'Unpublish' : 'Publish'}</button>
                        <button class="btn btn-danger btn-small" onclick="deleteNews('${item.id}', '${item.title}')">Delete</button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error('Error loading news:', error);
        document.getElementById('news-list').innerHTML = '<div style="color: #ff0000;">Failed to load news</div>';
    }
}

/**
 * Show create news modal
 */
function showCreateNewsModal() {
    document.getElementById('create-news-modal').style.display = 'block';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('news-date').value = today;
}

/**
 * Create news
 */
async function createNews() {
    const page = parseInt(document.getElementById('news-page').value);
    const title = document.getElementById('news-title').value;
    const date = document.getElementById('news-date').value;
    const content = document.getElementById('news-content').value;
    const published = document.getElementById('news-published').checked;
    
    if (!title || !content) {
        alert('Please fill in title and content');
        return;
    }
    
    try {
        const response = await fetch('/api/news/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ page, title, date, content, published })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('News created successfully!');
            closeModal('create-news-modal');
            loadNews();
        } else {
            alert('Failed to create news: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating news:', error);
        alert('Failed to create news');
    }
}

/**
 * Toggle news publish status
 */
async function togglePublish(newsId, published) {
    try {
        const response = await fetch(`/api/news/${newsId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ published })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadNews();
        } else {
            alert('Failed to update news: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating news:', error);
        alert('Failed to update news');
    }
}

/**
 * Delete news
 */
async function deleteNews(newsId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/news/${newsId}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': sessionId }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('News deleted successfully');
            loadNews();
        } else {
            alert('Failed to delete news: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting news:', error);
        alert('Failed to delete news');
    }
}

/**
 * Show create match modal
 */
function showCreateMatchModal(seriesId, matchNumber, team1, team2) {
    currentSeriesId = seriesId;
    
    document.getElementById('create-match-modal').style.display = 'block';
    document.getElementById('match-modal-title').textContent = `Create Match ${matchNumber}`;
    
    // Create match number selector
    const matchNumberSelect = document.getElementById('match-number');
    matchNumberSelect.innerHTML = `<option value="${matchNumber}">${matchNumber}</option>`;
    matchNumberSelect.value = matchNumber;
    
    // Update squad titles
    document.getElementById('team1-squad-title').textContent = `${team1} Squad (11 Players)`;
    document.getElementById('team2-squad-title').textContent = `${team2} Squad (11 Players)`;
    
    // Create squad input fields
    const team1Container = document.getElementById('team1-squad-container');
    const team2Container = document.getElementById('team2-squad-container');
    
    team1Container.innerHTML = '';
    team2Container.innerHTML = '';
    
    for (let i = 1; i <= 11; i++) {
        team1Container.innerHTML += `
            <div class="form-group">
                <input type="text" id="team1-player-${i}" placeholder="Player ${i}">
            </div>
        `;
        
        team2Container.innerHTML += `
            <div class="form-group">
                <input type="text" id="team2-player-${i}" placeholder="Player ${i}">
            </div>
        `;
    }
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('match-date').value = today;
}

/**
 * Create match
 */
async function createMatch() {
    const matchNumber = parseInt(document.getElementById('match-number').value);
    const venue = document.getElementById('match-venue').value;
    const date = document.getElementById('match-date').value;
    
    if (!venue || !date) {
        alert('Please fill in venue and date');
        return;
    }
    
    // Get squad1
    const squad1 = [];
    for (let i = 1; i <= 11; i++) {
        const player = document.getElementById(`team1-player-${i}`).value.trim();
        if (!player) {
            alert('Please fill in all squad members');
            return;
        }
        squad1.push(player);
    }
    
    // Get squad2
    const squad2 = [];
    for (let i = 1; i <= 11; i++) {
        const player = document.getElementById(`team2-player-${i}`).value.trim();
        if (!player) {
            alert('Please fill in all squad members');
            return;
        }
        squad2.push(player);
    }
    
    try {
        const response = await fetch(`/api/series/${currentSeriesId}/match/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ matchNumber, venue, date, squad1, squad2 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Match created successfully!');
            closeModal('create-match-modal');
            viewSeries(currentSeriesId);
        } else {
            alert('Failed to create match: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error creating match:', error);
        alert('Failed to create match');
    }
}

/**
 * Close modal
 */
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Handle Enter key for login
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
});

// ===== MATCH MANAGEMENT AND SCORING FUNCTIONS =====

let currentScoringMatch = null;
let currentScoringSeriesId = null;

/**
 * Manage a match (view details and score)
 */
async function manageMatch(seriesId, matchId) {
    try {
        currentScoringSeriesId = seriesId;
        
        // Load match data
        const response = await fetch(`/api/series/${seriesId}/match/${matchId}`);
        if (!response.ok) {
            alert('Failed to load match');
            return;
        }
        
        currentScoringMatch = await response.json();
        
        // Switch to scoring tab
        showTab('scoring');
        
        // Display match details
        displayScoringMatchDetails();
        
    } catch (error) {
        console.error('Error loading match:', error);
        alert('Failed to load match');
    }
}

/**
 * Display match details in scoring tab
 */
function displayScoringMatchDetails() {
    const infoDiv = document.getElementById('scoring-match-info');
    const statusDiv = document.getElementById('scoring-match-status');
    const detailsDiv = document.getElementById('match-details-display');
    const startInningsDiv = document.getElementById('scoring-start-innings');
    const scoringInterfaceDiv = document.getElementById('scoring-interface');
    
    if (!currentScoringMatch) {
        infoDiv.style.display = 'block';
        statusDiv.classList.add('hidden');
        startInningsDiv.classList.add('hidden');
        scoringInterfaceDiv.classList.add('hidden');
        return;
    }
    
    infoDiv.style.display = 'none';
    statusDiv.classList.remove('hidden');
    
    // Display match details
    let html = `
        <h4>${currentScoringMatch.title}</h4>
        <p>${currentScoringMatch.venue} - ${currentScoringMatch.date}</p>
        <p>Status: <span style="color: #00ff00;">${currentScoringMatch.status.toUpperCase()}</span></p>
    `;
    
    // Show innings summary if any
    if (currentScoringMatch.innings && currentScoringMatch.innings.length > 0) {
        html += '<div style="margin-top: 10px; background: #0a0a0a; padding: 10px; border-radius: 4px;">';
        currentScoringMatch.innings.forEach((inn, idx) => {
            const isDeclared = inn.declared ? ' dec' : '';
            html += `
                <div style="margin-bottom: 5px;">
                    <strong>Innings ${inn.number}:</strong> ${inn.battingTeam} ${inn.runs}/${inn.wickets}${isDeclared}
                    ${inn.status === 'completed' ? ' (completed)' : inn.status === 'live' ? ' (live)' : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    
    detailsDiv.innerHTML = html;
    
    // Determine which interface to show
    const currentInnings = currentScoringMatch.innings && currentScoringMatch.innings.length > 0 
        ? currentScoringMatch.innings[currentScoringMatch.innings.length - 1]
        : null;
    
    const needsNewInnings = !currentInnings || 
        currentInnings.status === 'completed' || 
        currentInnings.wickets >= 10;
    
    const matchCompleted = currentScoringMatch.result && currentScoringMatch.result.status === 'completed';
    
    if (matchCompleted) {
        startInningsDiv.classList.add('hidden');
        scoringInterfaceDiv.classList.add('hidden');
    } else if (needsNewInnings) {
        startInningsDiv.classList.remove('hidden');
        scoringInterfaceDiv.classList.add('hidden');
        setupStartInningsForm();
    } else {
        startInningsDiv.classList.add('hidden');
        scoringInterfaceDiv.classList.remove('hidden');
        setupScoringInterface();
    }
}

/**
 * Setup the start innings form
 */
function setupStartInningsForm() {
    if (!currentScoringMatch) return;
    
    const battingTeamSelect = document.getElementById('scoring-batting-team');
    const bowlingTeamSelect = document.getElementById('scoring-bowling-team');
    
    // Get teams from squads
    const teams = Object.keys(currentScoringMatch.squads || {});
    
    battingTeamSelect.innerHTML = '<option value="">Select team...</option>';
    bowlingTeamSelect.innerHTML = '<option value="">Select team...</option>';
    
    teams.forEach(team => {
        battingTeamSelect.innerHTML += `<option value="${team}">${team}</option>`;
        bowlingTeamSelect.innerHTML += `<option value="${team}">${team}</option>`;
    });
}

/**
 * Update batting order dropdowns
 */
function updateScoringBattingOrder() {
    const battingTeam = document.getElementById('scoring-batting-team').value;
    if (!battingTeam || !currentScoringMatch) return;
    
    const squad = currentScoringMatch.squads[battingTeam] || [];
    const container = document.getElementById('scoring-batting-order');
    
    container.innerHTML = '';
    for (let i = 1; i <= 11; i++) {
        const defaultPlayer = squad[i - 1] || squad[0];
        container.innerHTML += `
            <div class="form-group">
                <label>${i}. Batsman</label>
                <select id="scoring-batting-order-${i}">
                    ${squad.map(name => `<option value="${name}" ${name === defaultPlayer ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
        `;
    }
}

/**
 * Update bowling options
 */
function updateScoringBowlingOptions() {
    const bowlingTeam = document.getElementById('scoring-bowling-team').value;
    if (!bowlingTeam || !currentScoringMatch) return;
    
    const squad = currentScoringMatch.squads[bowlingTeam] || [];
    const bowlerSelect = document.getElementById('scoring-opening-bowler');
    
    bowlerSelect.innerHTML = '<option value="">Select bowler...</option>';
    squad.forEach(name => {
        bowlerSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });
}

/**
 * Start innings from dashboard
 */
async function startInningsFromDashboard() {
    const battingTeam = document.getElementById('scoring-batting-team').value;
    const bowlingTeam = document.getElementById('scoring-bowling-team').value;
    const openingBowler = document.getElementById('scoring-opening-bowler').value;
    
    if (!battingTeam || !bowlingTeam || !openingBowler) {
        alert('Please fill in all fields');
        return;
    }
    
    if (battingTeam === bowlingTeam) {
        alert('Batting and bowling teams must be different');
        return;
    }
    
    // Collect batting order
    const battingOrder = [];
    for (let i = 1; i <= 11; i++) {
        const select = document.getElementById(`scoring-batting-order-${i}`);
        if (!select || !select.value) {
            alert(`Please select batsman ${i}`);
            return;
        }
        battingOrder.push(select.value);
    }
    
    // Check for duplicates
    if (new Set(battingOrder).size !== 11) {
        alert('Each batsman must be selected only once');
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/start-innings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ battingTeam, bowlingTeam, battingOrder, openingBowler })
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            displayScoringMatchDetails();
        } else {
            const error = await response.json();
            alert('Failed to start innings: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error starting innings:', error);
        alert('Failed to start innings');
    }
}

/**
 * Setup scoring interface
 */
function setupScoringInterface() {
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    
    // Update scorecard preview
    updateScorecardPreview();
    
    // Populate bowler dropdown
    const bowlerSelect = document.getElementById('scoring-bowler');
    const bowlingSquad = currentScoringMatch.squads[currentInnings.bowlingTeam] || [];
    const allBowlers = Object.keys(currentInnings.allBowlers || {});
    const bowlerOptions = [...new Set([...bowlingSquad, ...allBowlers])];
    
    bowlerSelect.innerHTML = '<option value="">Select bowler...</option>';
    bowlerOptions.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (currentInnings.currentBowler && currentInnings.currentBowler.name === name) {
            option.selected = true;
        }
        bowlerSelect.appendChild(option);
    });
    
    // Populate dismissed batsman dropdown
    const dismissedBatsmanSelect = document.getElementById('scoring-dismissed-batsman');
    if (currentInnings.striker && currentInnings.nonStriker) {
        dismissedBatsmanSelect.innerHTML = `
            <option value="${currentInnings.striker}">${currentInnings.striker}</option>
            <option value="${currentInnings.nonStriker}">${currentInnings.nonStriker}</option>
        `;
    }
    
    // Update ball history
    updateBallHistory();
}

/**
 * Update scorecard preview
 */
function updateScorecardPreview() {
    const preview = document.getElementById('scoring-scorecard-preview');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        preview.innerHTML = '<div>No innings active</div>';
        return;
    }
    
    const innings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    
    let html = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
            ${innings.battingTeam.toUpperCase()} ${innings.runs}/${innings.wickets} 
            (${innings.overs}.${innings.balls} overs)
        </div>
    `;
    
    // Show current batsmen
    if (innings.striker && innings.nonStriker && innings.allBatsmen) {
        const strikerStats = innings.allBatsmen[innings.striker];
        const nonStrikerStats = innings.allBatsmen[innings.nonStriker];
        
        if (strikerStats && nonStrikerStats) {
            html += '<div style="margin: 10px 0;">';
            html += `<div><strong>★ ${innings.striker}:</strong> ${strikerStats.runs}* (${strikerStats.balls})</div>`;
            html += `<div>${innings.nonStriker}: ${nonStrikerStats.runs}* (${nonStrikerStats.balls})</div>`;
            html += '</div>';
        }
    }
    
    // Show current bowler
    if (innings.currentBowler && innings.allBowlers && innings.allBowlers[innings.currentBowler.name]) {
        const bowlerStats = innings.allBowlers[innings.currentBowler.name];
        html += `
            <div style="margin-top: 10px; color: #00ffff;">
                ${innings.currentBowler.name}: ${bowlerStats.overs}.${bowlerStats.balls % 6}-${bowlerStats.maidens}-${bowlerStats.runs}-${bowlerStats.wickets}
            </div>
        `;
    }
    
    preview.innerHTML = html;
}

/**
 * Update ball history
 */
function updateBallHistory() {
    const historyDiv = document.getElementById('scoring-ball-history');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        historyDiv.innerHTML = '<div>No balls recorded</div>';
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const balls = currentInnings.allBalls || [];
    
    if (balls.length === 0) {
        historyDiv.innerHTML = '<div>No balls recorded</div>';
        return;
    }
    
    // Show last 20 balls
    const recentBalls = balls.slice(-20).reverse();
    
    let html = '';
    recentBalls.forEach((ball) => {
        let runsText = ball.runs.toString();
        if (ball.overthrows && ball.overthrows > 0) {
            runsText += ` + ${ball.overthrows}ot`;
        }
        if (ball.extras) {
            runsText += `+${ball.extras}`;
        }
        
        const extraText = ball.extraType ? ` (${ball.extraType})` : '';
        const wicketText = ball.wicket ? ' 🔴 W' : '';
        
        html += `
            <div style="padding: 5px; border-bottom: 1px solid #333;">
                ${ball.over}.${ball.ball}: ${ball.batsman} ${runsText}${extraText} - ${ball.bowler}${wicketText}
            </div>
        `;
    });
    
    historyDiv.innerHTML = html;
}

/**
 * Set runs from button
 */
function setScoringRuns(runs) {
    document.getElementById('scoring-runs').value = runs;
    
    // Clear all run button highlights first
    document.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes('setScoringRuns')) {
            btn.style.background = '';
            btn.style.color = '';
        }
    });
    
    // Add visual feedback - highlight selected button
    document.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.textContent.trim() === runs.toString() && btn.onclick && btn.onclick.toString().includes('setScoringRuns')) {
            btn.style.background = '#00ff00';
            btn.style.color = '#000';
        }
    });
}

/**
 * Set extra type
 */
function setScoringExtra(type) {
    document.getElementById('scoring-extra-type').value = type;
    if (type === 'Wd' || type === 'Nb') {
        document.getElementById('scoring-extras').value = '1';
    } else if (type === 'Penalty') {
        document.getElementById('scoring-extras').value = '5';
    }
    
    // Clear all extra button highlights first
    const extraButtons = {
        '': 'None',
        'Wd': 'Wide',
        'Nb': 'No Ball',
        'Bye': 'Bye',
        'LB': 'Leg Bye',
        'Penalty': 'Penalty'
    };
    
    document.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes('setScoringExtra')) {
            btn.style.background = '';
            btn.style.color = '';
        }
    });
    
    // Add visual feedback - highlight selected button
    document.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.textContent.trim() === extraButtons[type] && btn.onclick && btn.onclick.toString().includes('setScoringExtra')) {
            btn.style.background = '#00ff00';
            btn.style.color = '#000';
        }
    });
}

/**
 * Toggle wicket details
 */
function toggleScoringWicketDetails() {
    const checked = document.getElementById('scoring-wicket').checked;
    const details = document.getElementById('scoring-wicket-details');
    if (checked) {
        details.classList.remove('hidden');
    } else {
        details.classList.add('hidden');
    }
}

/**
 * Record ball from dashboard
 */
async function recordBallFromDashboard() {
    // Enhanced validation and logging
    console.log('Recording ball...');
    console.log('Current series ID:', currentScoringSeriesId);
    console.log('Current match:', currentScoringMatch);
    
    // Validate that series and match are loaded
    if (!currentScoringSeriesId) {
        console.error('No series selected');
        alert('Error: No series selected. Please select a match to score.');
        return;
    }
    
    if (!currentScoringMatch || !currentScoringMatch.id) {
        console.error('No match loaded');
        alert('Error: No match loaded. Please select a match to score.');
        return;
    }
    
    const bowler = document.getElementById('scoring-bowler').value;
    const runs = parseInt(document.getElementById('scoring-runs').value) || 0;
    const overthrows = parseInt(document.getElementById('scoring-overthrows').value) || 0;
    const extraType = document.getElementById('scoring-extra-type').value;
    const extras = parseInt(document.getElementById('scoring-extras').value) || 0;
    const wicket = document.getElementById('scoring-wicket').checked;
    const wicketType = wicket ? document.getElementById('scoring-wicket-type').value : null;
    const dismissedBatsman = wicket ? document.getElementById('scoring-dismissed-batsman').value : null;
    
    console.log('Ball data:', { bowler, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman });
    
    if (!bowler) {
        alert('Please select a bowler');
        return;
    }
    
    try {
        const url = `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/ball`;
        console.log('Making request to:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                bowler, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman
            })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            console.log('Ball recorded successfully');
            
            // Check if a wicket fell
            const wicketFell = wicket;
            
            // Check if over is complete (balls === 0 and overs just incremented)
            const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
            const overComplete = currentInnings && currentInnings.balls === 0 && currentInnings.overs > 0;
            
            // Reset form and clear visual feedback
            document.getElementById('scoring-runs').value = '0';
            document.getElementById('scoring-overthrows').value = '0';
            document.getElementById('scoring-extra-type').value = '';
            document.getElementById('scoring-extras').value = '0';
            document.getElementById('scoring-wicket').checked = false;
            toggleScoringWicketDetails();
            
            // Clear button highlights
            document.querySelectorAll('.btn-group button').forEach(btn => {
                btn.style.background = '';
                btn.style.color = '';
            });
            
            // Update interface
            setupScoringInterface();
            
            // Show incoming batsman modal if a wicket fell
            if (wicketFell) {
                showIncomingBatsmanModalFromDashboard(dismissedBatsman);
            } else if (overComplete) {
                // Show new bowler modal if over is complete
                showNewBowlerModalFromDashboard();
            }
        } else {
            const error = await response.json();
            console.error('Server error:', error);
            alert('Failed to record ball: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error recording ball:', error);
        alert('Failed to record ball: ' + error.message);
    }
}

/**
 * Undo last ball
 */
async function undoLastBallFromDashboard() {
    if (!confirm('Undo the last ball?')) return;
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/undo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            setupScoringInterface();
        } else {
            const error = await response.json();
            alert('Failed to undo: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error undoing ball:', error);
        alert('Failed to undo');
    }
}

/**
 * Swap strike
 */
async function swapStrikeFromDashboard() {
    if (!confirm('Swap striker and non-striker?')) return;
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/swap-strike`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            setupScoringInterface();
        } else {
            const error = await response.json();
            alert('Failed to swap: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error swapping strike:', error);
        alert('Failed to swap strike');
    }
}

/**
 * Declare innings
 */
async function declareInningsFromDashboard() {
    if (!confirm('Declare this innings? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/declare`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            displayScoringMatchDetails();
        } else {
            const error = await response.json();
            alert('Failed to declare: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error declaring:', error);
        alert('Failed to declare');
    }
}

/**
 * End innings
 */
async function endInningsFromDashboard() {
    if (!confirm('End this innings? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/end-innings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            displayScoringMatchDetails();
        } else {
            const error = await response.json();
            alert('Failed to end innings: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error ending innings:', error);
        alert('Failed to end innings');
    }
}

/**
 * Show retire batsman modal
 */
function showRetireBatsmanModalFromDashboard() {
    const modal = document.getElementById('dashboard-retire-modal');
    const select = document.getElementById('dashboard-retire-batsman');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No active innings');
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    
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
    modal.style.display = 'block';
}

/**
 * Hide retire batsman modal
 */
function hideRetireBatsmanModalFromDashboard() {
    const modal = document.getElementById('dashboard-retire-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

/**
 * Confirm retire batsman
 */
async function confirmRetireBatsmanFromDashboard() {
    const batsmanName = document.getElementById('dashboard-retire-batsman').value;
    const retireType = document.getElementById('dashboard-retire-type').value;
    
    if (!batsmanName || !retireType) {
        alert('Please select batsman and retirement type');
        return;
    }
    
    if (!confirm(`Retire ${batsmanName} (${retireType})?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/retire-batsman`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ batsmanName, retireType })
        });
        
        if (response.ok) {
            hideRetireBatsmanModalFromDashboard();
            currentScoringMatch = await response.json();
            setupScoringInterface();
            
            // Show incoming batsman modal
            showIncomingBatsmanModalFromDashboard(batsmanName);
        } else {
            const error = await response.json();
            alert('Failed to retire: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error retiring batsman:', error);
        alert('Failed to retire batsman');
    }
}

/**
 * Show incoming batsman modal
 */
function showIncomingBatsmanModalFromDashboard(dismissedBatsmanName) {
    const modal = document.getElementById('dashboard-incoming-batsman-modal');
    const select = document.getElementById('dashboard-incoming-batsman');
    const infoDiv = document.getElementById('dismissed-batsman-info');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No active innings');
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    
    // Update info text
    if (dismissedBatsmanName) {
        infoDiv.textContent = `${dismissedBatsmanName} is dismissed/retired. Select the incoming batsman:`;
    } else {
        infoDiv.textContent = 'Select the incoming batsman:';
    }
    
    // Get available batsmen (not out, not currently batting, and haven't retired out/retired not out)
    const availableBatsmen = [];
    currentInnings.battingOrder.forEach(name => {
        const batsmanStats = currentInnings.allBatsmen[name];
        if (!batsmanStats) {
            // Haven't batted yet
            availableBatsmen.push(name);
        } else {
            const status = batsmanStats.status;
            // Available if not batted or retired hurt (can resume)
            if (status === 'not batted' || status === 'retired hurt') {
                availableBatsmen.push(name);
            }
        }
    });
    
    select.innerHTML = '<option value="">-- Select incoming batsman --</option>';
    availableBatsmen.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        const isRetiredHurt = currentInnings.allBatsmen[name]?.status === 'retired hurt';
        option.textContent = isRetiredHurt ? `${name} (resuming)` : name;
        select.appendChild(option);
    });
    
    modal.classList.remove('hidden');
    modal.style.display = 'block';
}

/**
 * Hide incoming batsman modal
 */
function hideIncomingBatsmanModalFromDashboard() {
    const modal = document.getElementById('dashboard-incoming-batsman-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

/**
 * Confirm incoming batsman selection
 */
async function confirmIncomingBatsmanFromDashboard() {
    const batsmanName = document.getElementById('dashboard-incoming-batsman').value;
    
    if (!batsmanName) {
        alert('Please select a batsman');
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/select-incoming-batsman`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ batsmanName })
        });
        
        if (response.ok) {
            hideIncomingBatsmanModalFromDashboard();
            currentScoringMatch = await response.json();
            setupScoringInterface();
        } else {
            const error = await response.json();
            alert('Failed to select batsman: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error selecting batsman:', error);
        alert('Failed to select batsman');
    }
}

/**
 * Show new bowler modal (end of over)
 */
function showNewBowlerModalFromDashboard() {
    const modal = document.getElementById('dashboard-new-bowler-modal');
    const select = document.getElementById('dashboard-new-bowler-select');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const bowlingSquad = currentScoringMatch.squads[currentInnings.bowlingTeam] || [];
    
    select.innerHTML = '<option value="">-- Select bowler --</option>';
    bowlingSquad.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    
    // Clear manual input
    document.getElementById('dashboard-new-bowler-manual').value = '';
    
    modal.classList.remove('hidden');
    modal.style.display = 'block';
}

/**
 * Confirm new bowler selection
 */
async function confirmNewBowlerFromDashboard() {
    let bowlerName = document.getElementById('dashboard-new-bowler-select').value;
    const manualName = document.getElementById('dashboard-new-bowler-manual').value.trim();
    
    // Use manual entry if provided
    if (manualName) {
        bowlerName = manualName;
    }
    
    if (!bowlerName) {
        alert('Please select or enter a bowler name');
        return;
    }
    
    // Update the bowler dropdown
    document.getElementById('scoring-bowler').value = bowlerName;
    
    // If bowler not in dropdown, we need to add them (for substitutes)
    const bowlerSelect = document.getElementById('scoring-bowler');
    let optionExists = false;
    for (let i = 0; i < bowlerSelect.options.length; i++) {
        if (bowlerSelect.options[i].value === bowlerName) {
            optionExists = true;
            break;
        }
    }
    
    if (!optionExists) {
        const option = document.createElement('option');
        option.value = bowlerName;
        option.textContent = bowlerName;
        bowlerSelect.appendChild(option);
    }
    
    bowlerSelect.value = bowlerName;
    
    // Hide modal
    const modal = document.getElementById('dashboard-new-bowler-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

/**
 * Update ball history with edit buttons
 */
function updateBallHistory() {
    const historyDiv = document.getElementById('scoring-ball-history');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        historyDiv.innerHTML = '<div>No balls recorded</div>';
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const balls = currentInnings.allBalls || [];
    
    if (balls.length === 0) {
        historyDiv.innerHTML = '<div>No balls recorded</div>';
        return;
    }
    
    // Show last 20 balls
    const recentBalls = balls.slice(-20).reverse();
    
    let html = '';
    recentBalls.forEach((ball, reverseIdx) => {
        const ballIndex = balls.length - 1 - reverseIdx;
        let runsText = ball.runs.toString();
        if (ball.overthrows && ball.overthrows > 0) {
            runsText += ` + ${ball.overthrows}ot`;
        }
        if (ball.extras) {
            runsText += `+${ball.extras}`;
        }
        
        const extraText = ball.extraType ? ` (${ball.extraType})` : '';
        const wicketText = ball.wicket ? ' 🔴 W' : '';
        
        html += `
            <div style="padding: 5px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <span>${ball.over}.${ball.ball}: ${ball.batsman} ${runsText}${extraText} - ${ball.bowler}${wicketText}</span>
                <button class="btn btn-secondary btn-small" onclick="showEditBallModalFromDashboard(${ballIndex})" style="padding: 3px 8px; font-size: 10px;">Edit</button>
            </div>
        `;
    });
    
    historyDiv.innerHTML = html;
}

/**
 * Show edit ball modal
 */
function showEditBallModalFromDashboard(ballIndex) {
    const modal = document.getElementById('dashboard-edit-ball-modal');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No active innings');
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const ball = currentInnings.allBalls[ballIndex];
    
    if (!ball) {
        alert('Ball not found');
        return;
    }
    
    // Set ball index
    document.getElementById('edit-ball-index').value = ballIndex;
    
    // Populate form
    document.getElementById('edit-ball-bowler').value = ball.bowler || '';
    document.getElementById('edit-ball-batsman').value = ball.batsman || '';
    document.getElementById('edit-ball-runs').value = ball.runs || 0;
    document.getElementById('edit-ball-overthrows').value = ball.overthrows || 0;
    document.getElementById('edit-ball-extra-type').value = ball.extraType || '';
    document.getElementById('edit-ball-extras').value = ball.extras || 0;
    document.getElementById('edit-ball-wicket').checked = ball.wicket || false;
    document.getElementById('edit-ball-wicket-type').value = ball.wicketType || 'bowled';
    document.getElementById('edit-ball-dismissed-batsman').value = ball.dismissedBatsman || '';
    
    // Show/hide wicket details
    const wicketDetails = document.getElementById('edit-ball-wicket-details');
    if (ball.wicket) {
        wicketDetails.classList.remove('hidden');
    } else {
        wicketDetails.classList.add('hidden');
    }
    
    // Update info
    const infoDiv = document.getElementById('edit-ball-info');
    infoDiv.textContent = `Editing ball ${ball.over}.${ball.ball}`;
    
    // Add listener for wicket checkbox
    document.getElementById('edit-ball-wicket').onchange = function() {
        if (this.checked) {
            wicketDetails.classList.remove('hidden');
        } else {
            wicketDetails.classList.add('hidden');
        }
    };
    
    modal.classList.remove('hidden');
    modal.style.display = 'block';
}

/**
 * Hide edit ball modal
 */
function hideEditBallModalFromDashboard() {
    const modal = document.getElementById('dashboard-edit-ball-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

/**
 * Confirm edit ball
 */
async function confirmEditBallFromDashboard() {
    const ballIndex = parseInt(document.getElementById('edit-ball-index').value);
    const bowler = document.getElementById('edit-ball-bowler').value;
    const batsman = document.getElementById('edit-ball-batsman').value;
    const runs = parseInt(document.getElementById('edit-ball-runs').value) || 0;
    const overthrows = parseInt(document.getElementById('edit-ball-overthrows').value) || 0;
    const extraType = document.getElementById('edit-ball-extra-type').value;
    const extras = parseInt(document.getElementById('edit-ball-extras').value) || 0;
    const wicket = document.getElementById('edit-ball-wicket').checked;
    const wicketType = wicket ? document.getElementById('edit-ball-wicket-type').value : null;
    const dismissedBatsman = wicket ? document.getElementById('edit-ball-dismissed-batsman').value : null;
    
    if (!bowler || !batsman) {
        alert('Please fill in bowler and batsman');
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/edit-ball`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                ballIndex, bowler, batsman, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman
            })
        });
        
        if (response.ok) {
            hideEditBallModalFromDashboard();
            currentScoringMatch = await response.json();
            setupScoringInterface();
        } else {
            const error = await response.json();
            alert('Failed to edit ball: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error editing ball:', error);
        alert('Failed to edit ball');
    }
}
