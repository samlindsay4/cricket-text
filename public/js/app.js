// Global state
let currentMatchId = null;
let activeScoringMatchId = null;
let refreshInterval = null;

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        switchPage(page);
    });
});

function switchPage(page) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === page) {
            btn.classList.add('active');
        }
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    // Load page data
    if (page === 'live') {
        loadMatches();
        startAutoRefresh();
    } else if (page === 'fixtures') {
        loadFixtures();
        stopAutoRefresh();
    } else if (page === 'scoring') {
        loadUpcomingMatches();
        stopAutoRefresh();
    }
}

// Auto-refresh for live page
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        if (currentMatchId) {
            loadMatchDetail(currentMatchId);
        } else {
            loadMatches();
        }
    }, 5000); // Refresh every 5 seconds
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Fixtures
document.getElementById('fixture-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fixture = {
        teamA: document.getElementById('fixture-teamA').value,
        teamB: document.getElementById('fixture-teamB').value,
        venue: document.getElementById('fixture-venue').value,
        date: document.getElementById('fixture-date').value
    };
    
    try {
        const response = await fetch('/api/fixtures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fixture)
        });
        
        if (response.ok) {
            e.target.reset();
            loadFixtures();
        }
    } catch (error) {
        console.error('Error creating fixture:', error);
    }
});

async function loadFixtures() {
    try {
        const response = await fetch('/api/fixtures');
        const fixtures = await response.json();
        
        const list = document.getElementById('fixtures-list');
        if (fixtures.length === 0) {
            list.innerHTML = '<div class="fixture-item">No fixtures scheduled</div>';
            return;
        }
        
        list.innerHTML = fixtures.map(f => `
            <div class="fixture-item">
                <div class="match-header">
                    <div class="match-teams">${f.teamA} vs ${f.teamB}</div>
                </div>
                <div class="match-info">
                    📍 ${f.venue} | 📅 ${formatDate(f.date)}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading fixtures:', error);
    }
}

// Matches
async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        const matches = await response.json();
        
        const liveMatches = matches.filter(m => m.status === 'live');
        const list = document.getElementById('matches-list');
        
        if (liveMatches.length === 0) {
            list.innerHTML = '<div class="match-item">No live matches</div>';
            return;
        }
        
        list.innerHTML = liveMatches.map(m => {
            const currentInnings = m.innings[m.innings.length - 1];
            let scoreText = '';
            
            if (currentInnings) {
                scoreText = `${currentInnings.battingTeam}: ${currentInnings.runs}/${currentInnings.wickets} (${currentInnings.overs}.${currentInnings.balls} ov)`;
            }
            
            return `
                <div class="match-item" onclick="viewMatch('${m.id}')">
                    <div class="match-header">
                        <div class="match-teams">${m.teamA} vs ${m.teamB}</div>
                        <div class="match-status live">● LIVE</div>
                    </div>
                    <div class="match-score">${scoreText}</div>
                    <div class="match-info">
                        📍 ${m.venue} | 📅 ${formatDate(m.date)}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

function viewMatch(matchId) {
    currentMatchId = matchId;
    document.getElementById('matches-list').style.display = 'none';
    document.getElementById('live-match-detail').style.display = 'block';
    loadMatchDetail(matchId);
}

function backToMatches() {
    currentMatchId = null;
    document.getElementById('matches-list').style.display = 'block';
    document.getElementById('live-match-detail').style.display = 'none';
    loadMatches();
}

async function loadMatchDetail(matchId) {
    try {
        const response = await fetch(`/api/matches/${matchId}`);
        const match = await response.json();
        
        // Display scorecard
        const scorecardDiv = document.getElementById('scorecard');
        const currentInnings = match.innings[match.innings.length - 1];
        
        let scorecardHTML = `
            <div class="scorecard">
                <div class="scorecard-header">
                    <div class="scorecard-teams">${match.teamA} vs ${match.teamB}</div>
                    <div class="scorecard-venue">📍 ${match.venue} | 📅 ${formatDate(match.date)}</div>
                </div>
        `;
        
        if (currentInnings) {
            scorecardHTML += `
                <div class="innings">
                    <div class="innings-header">
                        ${currentInnings.battingTeam} Innings
                    </div>
                    <div class="innings-score">
                        ${currentInnings.runs}/${currentInnings.wickets}
                        (${currentInnings.overs}.${currentInnings.balls} overs)
                    </div>
                    <div class="innings-extras">
                        Extras: ${currentInnings.extras.wides + currentInnings.extras.noBalls + currentInnings.extras.byes + currentInnings.extras.legByes}
                        (w ${currentInnings.extras.wides}, nb ${currentInnings.extras.noBalls}, b ${currentInnings.extras.byes}, lb ${currentInnings.extras.legByes})
                    </div>
                </div>
            `;
        }
        
        scorecardHTML += '</div>';
        scorecardDiv.innerHTML = scorecardHTML;
        
        // Display commentary
        const commentaryDiv = document.getElementById('commentary');
        if (match.commentary.length === 0) {
            commentaryDiv.innerHTML = '<div class="commentary-item">No commentary yet</div>';
        } else {
            commentaryDiv.innerHTML = match.commentary.map(c => `
                <div class="commentary-item">
                    ${c.over ? `<div class="commentary-over">${c.over}</div>` : ''}
                    <div class="${c.wicket ? 'commentary-wicket' : 'commentary-text'}">
                        ${c.text}
                    </div>
                    <div class="commentary-time">${formatTime(c.timestamp)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading match detail:', error);
    }
}

// Scoring
document.getElementById('create-match-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const match = {
        teamA: document.getElementById('match-teamA').value,
        teamB: document.getElementById('match-teamB').value,
        venue: document.getElementById('match-venue').value,
        date: document.getElementById('match-date').value
    };
    
    try {
        const response = await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(match)
        });
        
        if (response.ok) {
            const newMatch = await response.json();
            e.target.reset();
            loadUpcomingMatches();
            selectMatchForScoring(newMatch.id);
        }
    } catch (error) {
        console.error('Error creating match:', error);
    }
});

async function loadUpcomingMatches() {
    try {
        const response = await fetch('/api/matches');
        const matches = await response.json();
        
        const upcomingMatches = matches.filter(m => m.status === 'upcoming');
        const list = document.getElementById('upcoming-matches');
        
        if (upcomingMatches.length === 0) {
            list.innerHTML = '';
            return;
        }
        
        list.innerHTML = '<h3>UPCOMING MATCHES</h3>' + upcomingMatches.map(m => `
            <div class="match-item" onclick="selectMatchForScoring('${m.id}')">
                <div class="match-header">
                    <div class="match-teams">${m.teamA} vs ${m.teamB}</div>
                    <div class="match-status">UPCOMING</div>
                </div>
                <div class="match-info">
                    📍 ${m.venue} | 📅 ${formatDate(m.date)}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading upcoming matches:', error);
    }
}

async function selectMatchForScoring(matchId) {
    activeScoringMatchId = matchId; // Store the active match ID for scoring
    try {
        const response = await fetch(`/api/matches/${matchId}`);
        const match = await response.json();
        
        document.getElementById('active-match-section').style.display = 'block';
        document.getElementById('active-match-info').innerHTML = `
            <div class="match-teams">${match.teamA} vs ${match.teamB}</div>
            <div class="match-info">📍 ${match.venue} | 📅 ${formatDate(match.date)}</div>
        `;
        
        // Setup toss form
        const tossWinnerSelect = document.getElementById('toss-winner');
        tossWinnerSelect.innerHTML = `
            <option value="">Select Toss Winner</option>
            <option value="${match.teamA}">${match.teamA}</option>
            <option value="${match.teamB}">${match.teamB}</option>
        `;
        
        if (match.status === 'upcoming') {
            document.getElementById('toss-section').style.display = 'block';
            document.getElementById('scoring-section').style.display = 'none';
            
            document.getElementById('toss-form').onsubmit = async (e) => {
                e.preventDefault();
                await startMatch(matchId);
            };
        } else if (match.status === 'live') {
            document.getElementById('toss-section').style.display = 'none';
            document.getElementById('scoring-section').style.display = 'block';
            updateCurrentScore(match);
        }
    } catch (error) {
        console.error('Error selecting match:', error);
    }
}

async function startMatch(matchId) {
    const tossWinner = document.getElementById('toss-winner').value;
    const tossDecision = document.getElementById('toss-decision').value;
    
    try {
        const response = await fetch(`/api/matches/${matchId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tossWinner, tossDecision })
        });
        
        if (response.ok) {
            const match = await response.json();
            document.getElementById('toss-section').style.display = 'none';
            document.getElementById('scoring-section').style.display = 'block';
            updateCurrentScore(match);
            loadUpcomingMatches();
        }
    } catch (error) {
        console.error('Error starting match:', error);
    }
}

function updateCurrentScore(match) {
    const currentInnings = match.innings[match.innings.length - 1];
    if (currentInnings) {
        document.getElementById('current-score').innerHTML = `
            <div class="scorecard">
                <div class="innings-header">${currentInnings.battingTeam} Innings</div>
                <div class="innings-score">
                    ${currentInnings.runs}/${currentInnings.wickets}
                    (${currentInnings.overs}.${currentInnings.balls} overs)
                </div>
            </div>
        `;
    }
}

// Wicket checkbox handling
document.getElementById('wicket').addEventListener('change', (e) => {
    document.getElementById('wicket-details').style.display = 
        e.target.checked ? 'block' : 'none';
});

// Ball form submission
document.getElementById('ball-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!activeScoringMatchId) {
        alert('No active match selected');
        return;
    }
    
    const ball = {
        batsman: document.getElementById('batsman').value,
        bowler: document.getElementById('bowler').value,
        runs: parseInt(document.getElementById('runs').value) || 0,
        extraType: document.getElementById('extra-type').value || null,
        extras: parseInt(document.getElementById('extras').value) || 0,
        wicket: document.getElementById('wicket').checked,
        wicketType: document.getElementById('wicket').checked ? 
            document.getElementById('wicket-type').value : null,
        dismissedBatsman: document.getElementById('wicket').checked ? 
            document.getElementById('dismissed-batsman').value : null,
        commentary: document.getElementById('ball-commentary').value
    };
    
    try {
        const response = await fetch(`/api/matches/${activeScoringMatchId}/ball`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ball)
        });
        
        if (response.ok) {
            const result = await response.json();
            updateCurrentScore(result.match);
            
            // Reset form except batsman and bowler
            document.getElementById('runs').value = '0';
            document.getElementById('extra-type').value = '';
            document.getElementById('extras').value = '0';
            document.getElementById('wicket').checked = false;
            document.getElementById('wicket-details').style.display = 'none';
            document.getElementById('ball-commentary').value = '';
        }
    } catch (error) {
        console.error('Error recording ball:', error);
    }
});

// Utility functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Initialize
loadMatches();
startAutoRefresh();
