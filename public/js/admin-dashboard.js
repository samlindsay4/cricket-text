// Admin Dashboard JavaScript
let sessionId = localStorage.getItem('adminSessionId') || null;
let currentSeriesId = null;
let pendingNewBowlerModal = false; // Track if we need to show bowler modal after batsman selection

// Save session to localStorage when set
function setSessionId(id) {
    sessionId = id;
    if (id) {
        localStorage.setItem('adminSessionId', id);
    } else {
        localStorage.removeItem('adminSessionId');
    }
}

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
            setSessionId(data.sessionId);
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
    setSessionId(null);
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
    } else if (tabName === 'homepage') {
        loadHomepageTab();
    } else if (tabName === 'news') {
        loadNews();
    } else if (tabName === 'about') {
        loadAboutPage();
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
    const listDiv = document.getElementById('series-list');
    listDiv.innerHTML = '<div class="loading">Loading series...</div>';
    
    // Wait for sessionId to be available
    let attempts = 0;
    while (!sessionId && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!sessionId) {
        listDiv.innerHTML = '<div style="color: #ff0000;">Not authenticated. Please log in.</div>';
        return;
    }
    
    try {
        const response = await fetch('/api/series/list', {
            cache: 'no-store', // Force no cache
            headers: { 
                'X-Session-Id': sessionId,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const series = await response.json();
        
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
                        Priority ${s.priority || 'N/A'} | Pages ${s.startPage} - ${s.endPage}
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-small view-matches-btn" 
                            data-series-id="${s.id || s.dirName}">View Matches</button>
                        <button class="btn btn-secondary btn-small view-public-btn" 
                            data-start-page="${s.startPage}">View Public Page</button>
                        <button class="btn btn-secondary btn-small edit-priority-btn" 
                            data-series-id="${s.id || s.dirName}"
                            data-series-name="${s.name}"
                            data-priority="${s.priority || 1}"
                            data-start-page="${s.startPage}"
                            data-end-page="${s.endPage}">Edit Priority</button>
                        <button class="btn btn-danger btn-small delete-series-btn"
                            data-series-id="${s.id || s.dirName}"
                            data-series-name="${s.name}">Delete</button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
        // Add event listeners for buttons
        document.querySelectorAll('.view-matches-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                viewSeries(btn.dataset.seriesId);
            });
        });
        
        document.querySelectorAll('.view-public-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.open('/?page=' + btn.dataset.startPage, '_blank');
            });
        });
        
        document.querySelectorAll('.edit-priority-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showEditPriorityModal(
                    btn.dataset.seriesId,
                    btn.dataset.seriesName,
                    parseInt(btn.dataset.priority),
                    parseInt(btn.dataset.startPage),
                    parseInt(btn.dataset.endPage)
                );
            });
        });
        
        document.querySelectorAll('.delete-series-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteSeries(btn.dataset.seriesId, btn.dataset.seriesName);
            });
        });
    } catch (error) {
        console.error('Error loading series:', error);
        listDiv.innerHTML = `
            <div style="color: #ff0000; text-align: center; padding: 20px;">
                Failed to load series: ${error.message}
                <br><br>
                <button class="btn btn-primary" onclick="loadSeries()">Retry</button>
            </div>
        `;
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
                            <button class="btn btn-primary btn-small setup-match-btn" 
                                data-series-id="${seriesId}"
                                data-match-number="${match.number}"
                                data-team1="${series.team1}"
                                data-team2="${series.team2}">Setup Match</button>
                        ` : `
                            <button class="btn btn-primary btn-small manage-match-btn"
                                data-series-id="${seriesId}"
                                data-match-id="${match.id}">Manage Match</button>
                            <button class="btn btn-secondary btn-small edit-squads-btn"
                                data-series-id="${seriesId}"
                                data-match-id="${match.id}"
                                data-team1="${series.team1}"
                                data-team2="${series.team2}">Edit Squads</button>
                        `}
                        ${match.status !== 'upcoming' || match.venue ? `
                            <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${series.startPage}', '_blank')">View Live Score</button>
                            <button class="btn btn-secondary btn-small" onclick="window.open('/?page=${series.startPage + 1}', '_blank')">View Scorecard</button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
        // Add event listeners for match buttons
        document.querySelectorAll('.setup-match-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showCreateMatchModal(
                    btn.dataset.seriesId,
                    parseInt(btn.dataset.matchNumber),
                    btn.dataset.team1,
                    btn.dataset.team2
                );
            });
        });

        document.querySelectorAll('.manage-match-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                manageMatch(btn.dataset.seriesId, btn.dataset.matchId);
            });
        });

        document.querySelectorAll('.edit-squads-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showEditSquadsModal(
                    btn.dataset.seriesId,
                    btn.dataset.matchId,
                    btn.dataset.team1,
                    btn.dataset.team2
                );
            });
        });
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
            // Force cache clear
            await fetch('/api/series/list', { 
                method: 'GET',
                cache: 'reload',
                headers: { 'Cache-Control': 'no-cache' }
            });
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
 * Show edit priority modal
 */
function showEditPriorityModal(seriesId, seriesName, currentPriority, startPage, endPage) {
    document.getElementById('edit-series-id').value = seriesId;
    document.getElementById('edit-series-name').value = seriesName;
    document.getElementById('edit-current-pages').value = `${startPage} - ${endPage}`;
    document.getElementById('edit-priority').value = currentPriority;
    document.getElementById('edit-priority-modal').style.display = 'block';
}

/**
 * Update series priority
 */
async function updateSeriesPriority() {
    const seriesId = document.getElementById('edit-series-id').value;
    const newPriority = parseInt(document.getElementById('edit-priority').value);
    
    if (!confirm('Are you sure you want to change the priority? This will move the series to different page numbers and may break existing bookmarks.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${seriesId}/priority`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ priority: newPriority })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Series priority updated successfully!');
            closeModal('edit-priority-modal');
            loadSeries();
        } else {
            alert('Failed to update priority: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating priority:', error);
        alert('Failed to update priority');
    }
}

/**
 * Show create series modal
 */
function showCreateSeriesModal() {
    document.getElementById('create-series-modal').style.display = 'block';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
}

/**
 * Create series
 */
async function createSeries() {
    const name = document.getElementById('series-name').value;
    const team1 = document.getElementById('team1').value;
    const team2 = document.getElementById('team2').value;
    const numMatches = parseInt(document.getElementById('num-matches').value);
    const priority = parseInt(document.getElementById('priority').value);
    
    if (!name || !team1 || !team2 || !priority) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/api/series/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ name, team1, team2, numMatches, priority })
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
 * Load About Page
 */
async function loadAboutPage() {
    try {
        const response = await fetch('/api/about', {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        document.getElementById('about-title').value = data.title;
        document.getElementById('about-content').value = data.content;
    } catch (error) {
        console.error('Error loading about page:', error);
        alert('Error loading about page: ' + error.message);
    }
}

/**
 * Save About Page
 */
async function saveAboutPage(event) {
    event.preventDefault();
    
    const title = document.getElementById('about-title').value;
    const content = document.getElementById('about-content').value;
    
    console.log('Session ID:', sessionId);
    
    if (!sessionId) {
        alert('Not authenticated. Please refresh and log in again.');
        return;
    }
    
    try {
        const response = await fetch('/api/about', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ title, content })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('About page saved successfully!');
            // Reload the data to confirm the save
            await loadAboutPage();
        } else {
            alert('Error saving about page: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving about page:', error);
        alert('Error saving about page: ' + error.message);
    }
}

/**
 * Load news
 */
async function loadNews() {
    const listDiv = document.getElementById('news-list');
    listDiv.innerHTML = '<div class="loading">Loading news...</div>';
    
    try {
        const response = await fetch('/api/news', {
            cache: 'no-store', // Force no cache
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const news = await response.json();
        
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
                        <button class="btn btn-warning btn-small" onclick="showEditNewsModal('${item.id}')">Edit</button>
                        <button class="btn btn-primary btn-small" onclick="togglePublish('${item.id}', ${!item.published})">${item.published ? 'Unpublish' : 'Publish'}</button>
                        <button class="btn btn-danger btn-small delete-news-btn"
                            data-news-id="${item.id}"
                            data-news-title="${item.title}">Delete</button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
        
        // Add event listeners for delete news buttons
        document.querySelectorAll('.delete-news-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteNews(btn.dataset.newsId, btn.dataset.newsTitle);
            });
        });
    } catch (error) {
        console.error('Error loading news:', error);
        listDiv.innerHTML = `
            <div style="color: #ff0000; text-align: center; padding: 20px;">
                Failed to load news: ${error.message}
                <br><br>
                <button class="btn btn-primary" onclick="loadNews()">Retry</button>
            </div>
        `;
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
 * Show edit news modal
 */
async function showEditNewsModal(newsId) {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        console.log('News data:', data);
        console.log('Looking for ID:', newsId);
        
        const newsItem = data.find(n => n.id === newsId);
        
        if (!newsItem) {
            alert('News item not found. ID: ' + newsId);
            return;
        }
        
        document.getElementById('edit-news-id').value = newsItem.id;
        document.getElementById('edit-news-page').value = newsItem.page;
        document.getElementById('edit-news-title').value = newsItem.title;
        document.getElementById('edit-news-date').value = newsItem.date;
        document.getElementById('edit-news-content').value = newsItem.content;
        document.getElementById('edit-news-published').checked = newsItem.published;
        
        document.getElementById('edit-news-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading news item:', error);
        alert('Failed to load news item: ' + error.message);
    }
}

/**
 * Update news
 */
async function updateNews() {
    const id = document.getElementById('edit-news-id').value;
    const page = parseInt(document.getElementById('edit-news-page').value);
    const title = document.getElementById('edit-news-title').value;
    const date = document.getElementById('edit-news-date').value;
    const content = document.getElementById('edit-news-content').value;
    const published = document.getElementById('edit-news-published').checked;
    
    if (!title || !content) {
        alert('Please fill in title and content');
        return;
    }
    
    try {
        const response = await fetch(`/api/news/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ page, title, date, content, published })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('News updated successfully!');
            closeModal('edit-news-modal');
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
            // Force immediate cache clear
            await fetch('/api/news', { 
                method: 'GET',
                cache: 'reload',
                headers: { 'Cache-Control': 'no-cache' }
            });
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
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('match-date').value = today;
    document.getElementById('match-time').value = '';
}

/**
 * Create match
 */
async function createMatch() {
    const matchNumber = parseInt(document.getElementById('match-number').value);
    const venue = document.getElementById('match-venue').value;
    const date = document.getElementById('match-date').value;
    const startTime = document.getElementById('match-time').value;
    
    if (!venue || !date) {
        alert('Please fill in venue and date');
        return;
    }
    
    try {
        const body = { 
            matchNumber, 
            venue, 
            date
        };
        
        // Add start time if provided
        if (startTime && startTime.trim()) {
            body.startTime = startTime;
        }
        
        console.log('Sending match create request with body:', body);
        
        const response = await fetch(`/api/series/${currentSeriesId}/match/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        console.log('Server response:', data);
        
        if (data.success) {
            alert('Match created successfully! Use "Edit Squads" to add teams before starting the match.');
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
 * Show edit squads modal
 */
let editSquadsSeriesId = null;
let editSquadsMatchId = null;

async function showEditSquadsModal(seriesId, matchId, team1, team2) {
    editSquadsSeriesId = seriesId;
    editSquadsMatchId = matchId;
    
    // Load current match data
    try {
        const response = await fetch(`/api/series/${seriesId}/match/${matchId}`);
        if (!response.ok) {
            alert('Failed to load match data');
            return;
        }
        
        const match = await response.json();
        
        document.getElementById('edit-squads-modal').style.display = 'block';
        document.getElementById('edit-squads-title').textContent = `Edit Squads - ${match.title}`;
        
        // Update squad titles
        document.getElementById('edit-team1-squad-title').textContent = `${team1} Squad (11 Players)`;
        document.getElementById('edit-team2-squad-title').textContent = `${team2} Squad (11 Players)`;
        
        // Create squad input fields
        const team1Container = document.getElementById('edit-team1-squad-container');
        const team2Container = document.getElementById('edit-team2-squad-container');
        
        team1Container.innerHTML = '';
        team2Container.innerHTML = '';
        
        const squad1 = match.squads ? (match.squads[team1] || []) : [];
        const squad2 = match.squads ? (match.squads[team2] || []) : [];
        
        for (let i = 1; i <= 11; i++) {
            team1Container.innerHTML += `
                <div class="form-group">
                    <input type="text" id="edit-team1-player-${i}" placeholder="Player ${i}" value="${squad1[i-1] || ''}">
                </div>
            `;
            
            team2Container.innerHTML += `
                <div class="form-group">
                    <input type="text" id="edit-team2-player-${i}" placeholder="Player ${i}" value="${squad2[i-1] || ''}">
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading match:', error);
        alert('Failed to load match data');
    }
}

/**
 * Update squads
 */
async function updateSquads() {
    // Get squad1
    const squad1 = [];
    for (let i = 1; i <= 11; i++) {
        const player = document.getElementById(`edit-team1-player-${i}`).value.trim();
        if (!player) {
            alert('Please fill in all squad members for Team 1');
            return;
        }
        squad1.push(player);
    }
    
    // Get squad2
    const squad2 = [];
    for (let i = 1; i <= 11; i++) {
        const player = document.getElementById(`edit-team2-player-${i}`).value.trim();
        if (!player) {
            alert('Please fill in all squad members for Team 2');
            return;
        }
        squad2.push(player);
    }
    
    try {
        const response = await fetch(`/api/series/${editSquadsSeriesId}/match/${editSquadsMatchId}/squads`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ squad1, squad2 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Squads updated successfully!');
            closeModal('edit-squads-modal');
            viewSeries(editSquadsSeriesId);
        } else {
            alert('Failed to update squads: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating squads:', error);
        alert('Failed to update squads');
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
let selectedInningsNumber = null; // Track which innings is selected for viewing (null = current/live)

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
 * Delete last innings
 */
async function deleteLastInnings() {
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No innings to delete');
        return;
    }
    
    const lastInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const inningsNumber = lastInnings.number;
    
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete the last innings (Innings ${inningsNumber} - ${lastInnings.battingTeam})? This cannot be undone.`);
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/innings/${inningsNumber}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            displayScoringMatchDetails();
            alert('Innings deleted successfully');
        } else {
            const error = await response.json();
            alert('Failed to delete innings: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting innings:', error);
        alert('Failed to delete innings');
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
    
    // BUG FIX #2: Store current bowler value BEFORE repopulating dropdown
    const bowlerSelect = document.getElementById('scoring-bowler');
    const currentBowlerName = currentInnings.currentBowler?.name || bowlerSelect.value;
    
    // Populate bowler dropdown
    const bowlingSquad = currentScoringMatch.squads[currentInnings.bowlingTeam] || [];
    const allBowlers = Object.keys(currentInnings.allBowlers || {});
    const bowlerOptions = [...new Set([...bowlingSquad, ...allBowlers])];
    
    bowlerSelect.innerHTML = '<option value="">Select bowler...</option>';
    bowlerOptions.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        bowlerSelect.appendChild(option);
    });
    
    // BUG FIX #2: Restore the current bowler value AFTER repopulating
    if (currentBowlerName) {
        bowlerSelect.value = currentBowlerName;
    }
    
    // Populate dismissed batsman dropdown
    const dismissedBatsmanSelect = document.getElementById('scoring-dismissed-batsman');
    if (currentInnings.striker && currentInnings.nonStriker) {
        dismissedBatsmanSelect.innerHTML = `
            <option value="${currentInnings.striker}">${currentInnings.striker}</option>
            <option value="${currentInnings.nonStriker}">${currentInnings.nonStriker}</option>
        `;
    }
    
    // Populate fielder dropdown with bowling team players
    const fielderSelect = document.getElementById('scoring-fielder');
    if (fielderSelect && currentScoringMatch && currentScoringMatch.squads) {
        const bowlingTeam = currentInnings.bowlingTeam;
        const bowlingSquad = currentScoringMatch.squads[bowlingTeam];
        
        fielderSelect.innerHTML = '<option value="">None</option>';
        fielderSelect.innerHTML += '<option value="sub">sub</option>';
        
        if (bowlingSquad && Array.isArray(bowlingSquad)) {
            bowlingSquad.forEach(player => {
                const option = document.createElement('option');
                option.value = player;
                option.textContent = player;
                fielderSelect.appendChild(option);
            });
        }
    }
    
    // Update match day selector
    const daySelect = document.getElementById('match-day');
    if (daySelect && currentScoringMatch.day) {
        daySelect.value = currentScoringMatch.day;
    }
    
    // Update match message field
    const messageInput = document.getElementById('match-message');
    if (messageInput) {
        messageInput.value = currentScoringMatch.message || '';
    }
    
    // Update ball history
    updateBallHistory();
    
    // Update innings selector
    updateInningsSelector();
    
    // Show/hide delete innings button based on whether there are innings
    const deleteBtn = document.getElementById('delete-innings-btn');
    const deleteSection = document.getElementById('delete-innings-section');
    if (deleteBtn && deleteSection) {
        if (currentScoringMatch && currentScoringMatch.innings && currentScoringMatch.innings.length > 0) {
            deleteSection.style.display = 'block';
        } else {
            deleteSection.style.display = 'none';
        }
    }
}

/**
 * Update innings selector dropdown
 */
function updateInningsSelector() {
    const selector = document.getElementById('innings-selector');
    if (!selector || !currentScoringMatch || !currentScoringMatch.innings) {
        return;
    }
    
    // Clear existing options
    selector.innerHTML = '';
    
    // Add option for each innings
    currentScoringMatch.innings.forEach((innings, index) => {
        const inningsNum = index + 1;
        const option = document.createElement('option');
        option.value = inningsNum;
        
        let status = '';
        if (innings.status === 'completed') {
            status = ' - Completed';
        } else if (innings.status === 'declared') {
            status = ' - Declared';
        } else if (inningsNum === currentScoringMatch.innings.length) {
            status = ' - Live';
        }
        
        option.textContent = `Innings ${inningsNum} - ${innings.battingTeam}${status}`;
        selector.appendChild(option);
    });
    
    // Default to current/live innings (last innings)
    if (selectedInningsNumber === null || selectedInningsNumber > currentScoringMatch.innings.length) {
        selectedInningsNumber = currentScoringMatch.innings.length;
    }
    selector.value = selectedInningsNumber;
    
    // Update status badge and warning
    updateInningsStatusIndicators();
}

/**
 * Handle innings selector change
 */
function onInningsSelectorChange() {
    const selector = document.getElementById('innings-selector');
    selectedInningsNumber = parseInt(selector.value);
    
    // Update ball history for selected innings
    updateBallHistory();
    
    // Update status indicators
    updateInningsStatusIndicators();
}

/**
 * Update innings status badge and warning
 */
function updateInningsStatusIndicators() {
    if (!currentScoringMatch || !selectedInningsNumber) {
        return;
    }
    
    const innings = currentScoringMatch.innings[selectedInningsNumber - 1];
    const badge = document.getElementById('innings-status-badge');
    const warning = document.getElementById('completed-innings-warning');
    
    if (!innings || !badge || !warning) {
        return;
    }
    
    const isCurrentInnings = selectedInningsNumber === currentScoringMatch.innings.length;
    
    if (isCurrentInnings) {
        badge.textContent = '● LIVE';
        badge.style.background = '#00ff00';
        badge.style.color = '#000';
        warning.classList.add('hidden');
    } else {
        if (innings.status === 'declared') {
            badge.textContent = 'DECLARED';
        } else {
            badge.textContent = 'COMPLETED';
        }
        badge.style.background = '#666';
        badge.style.color = '#fff';
        warning.classList.remove('hidden');
    }
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
    
    // FEATURE #4: Show current bowler
    if (innings.currentBowler && innings.allBowlers && innings.allBowlers[innings.currentBowler.name]) {
        const bowlerStats = innings.allBowlers[innings.currentBowler.name];
        html += `
            <div style="margin-top: 10px; color: #00ffff;">
                ${innings.currentBowler.name}: ${bowlerStats.overs}.${bowlerStats.balls % 6}-${bowlerStats.maidens}-${bowlerStats.runs}-${bowlerStats.wickets}
            </div>
        `;
    }
    
    // BUG FIX #1: Show previous over's bowler (if not first over and different from current)
    if (innings.overs > 0 && innings.lastCompletedOver && innings.lastCompletedOver.bowler) {
        const prevBowlerName = innings.lastCompletedOver.bowler;
        if (prevBowlerName !== innings.currentBowler?.name && innings.allBowlers && innings.allBowlers[prevBowlerName]) {
            const prevBowlerStats = innings.allBowlers[prevBowlerName];
            html += `
                <div style="margin-top: 5px; color: #aaaaaa;">
                    ${prevBowlerName}: ${prevBowlerStats.overs}.${prevBowlerStats.balls % 6}-${prevBowlerStats.maidens}-${prevBowlerStats.runs}-${prevBowlerStats.wickets}
                </div>
            `;
        }
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
    
    // Use selected innings or default to current innings
    const inningsIndex = selectedInningsNumber ? selectedInningsNumber - 1 : currentScoringMatch.innings.length - 1;
    const innings = currentScoringMatch.innings[inningsIndex];
    const balls = innings.allBalls || [];
    
    if (balls.length === 0) {
        historyDiv.innerHTML = '<div>No balls recorded</div>';
        return;
    }
    
    const isCurrentInnings = (inningsIndex === currentScoringMatch.innings.length - 1);
    
    // Show all balls from the innings
    const allBalls = [...balls].reverse();
    
    let html = '';
    allBalls.forEach((ball, reverseIndex) => {
        const actualIndex = balls.length - 1 - reverseIndex;
        
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
                <div>
                    ${ball.over}.${ball.ball}: ${ball.batsman} ${runsText}${extraText} - ${ball.bowler}${wicketText}
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn btn-small" style="padding: 2px 6px; font-size: 11px;" onclick="openEditBallModalForInnings(${selectedInningsNumber || currentScoringMatch.innings.length}, ${actualIndex})">✏️ Edit</button>
                    <button class="btn btn-small" style="padding: 2px 6px; font-size: 11px;" onclick="undoBallFromInnings(${selectedInningsNumber || currentScoringMatch.innings.length}, ${actualIndex})">↶ Undo</button>
                </div>
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
    
    // Show "Add" button for No Ball or Wide (can be combined with Byes/LB)
    const addBtn = document.getElementById('add-second-extra-btn');
    if (type === 'Nb' || type === 'Wd') {
        addBtn.style.display = 'inline-block';
    } else {
        addBtn.style.display = 'none';
        // Hide second extra container if not Nb or Wd
        document.getElementById('second-extra-container').classList.add('hidden');
        document.getElementById('scoring-second-extra-type').value = '';
        document.getElementById('scoring-second-extras').value = '0';
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
 * Toggle second extra type section
 */
function toggleSecondExtra() {
    const container = document.getElementById('second-extra-container');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.getElementById('scoring-second-extra-type').value = '';
        document.getElementById('scoring-second-extras').value = '0';
    }
}

/**
 * Set second extra type (for combinations like Nb + Bye)
 */
function setScoringSecondExtra(type) {
    document.getElementById('scoring-second-extra-type').value = type;
    if (type) {
        document.getElementById('scoring-second-extras').value = '1';
    }
    
    // Clear all extra button highlights first
    const extraButtons = {
        '': 'None',
        'Bye': 'Bye',
        'LB': 'Leg Bye'
    };
    
    // Clear highlights
    const container = document.getElementById('second-extra-container');
    container.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.onclick && btn.onclick.toString().includes('setScoringSecondExtra')) {
            btn.style.background = '';
            btn.style.color = '';
        }
    });
    
    // Add visual feedback - highlight selected button
    container.querySelectorAll('.btn-group button').forEach(btn => {
        if (btn.textContent.trim() === extraButtons[type] && btn.onclick && btn.onclick.toString().includes('setScoringSecondExtra')) {
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
    const secondExtraType = document.getElementById('scoring-second-extra-type').value;
    const secondExtras = parseInt(document.getElementById('scoring-second-extras').value) || 0;
    const wicket = document.getElementById('scoring-wicket').checked;
    const wicketType = wicket ? document.getElementById('scoring-wicket-type').value : null;
    const dismissedBatsman = wicket ? document.getElementById('scoring-dismissed-batsman').value : null;
    const fielder = wicket ? document.getElementById('scoring-fielder').value : null;
    
    console.log('Ball data:', { bowler, runs, overthrows, extras, extraType, secondExtras, secondExtraType, wicket, wicketType, dismissedBatsman, fielder });
    
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
                bowler, runs, overthrows, extras, extraType, secondExtras, secondExtraType, wicket, wicketType, dismissedBatsman, fielder
            })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            console.log('Ball recorded successfully');
            
            // Check if a wicket fell
            const wicketFell = wicket;
            
            // BUG FIX #5: Check if over is complete - only if it was a legal delivery
            // Wide (Wd) and No-ball (Nb) are illegal deliveries
            const isLegalDelivery = (extraType !== 'Wd' && extraType !== 'Nb');
            const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
            const overComplete = isLegalDelivery && currentInnings && currentInnings.balls === 0 && currentInnings.overs > 0;
            
            // Reset form and clear visual feedback
            document.getElementById('scoring-runs').value = '0';
            document.getElementById('scoring-overthrows').value = '0';
            document.getElementById('scoring-extra-type').value = '';
            document.getElementById('scoring-extras').value = '0';
            document.getElementById('scoring-second-extra-type').value = '';
            document.getElementById('scoring-second-extras').value = '0';
            document.getElementById('second-extra-container').classList.add('hidden');
            document.getElementById('add-second-extra-btn').style.display = 'none';
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
            // If over is also complete, store flag to show bowler modal after batsman selection
            if (wicketFell) {
                pendingNewBowlerModal = overComplete; // Remember if we need to show bowler modal next
                showIncomingBatsmanModalFromDashboard(dismissedBatsman);
            } else if (overComplete) {
                // Show new bowler modal if over is complete (no wicket)
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
 * Declare match as draw
 */
async function declareDrawFromDashboard() {
    if (!confirm('Declare this match as a draw? This will end the match immediately. This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/declare-draw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentScoringMatch = data.match;
            displayScoringMatchDetails();
            alert('Match declared as draw');
        } else {
            const error = await response.json();
            alert('Failed to declare draw: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error declaring draw:', error);
        alert('Failed to declare draw');
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
    
    // BUG FIX #4: Find the next batsman in batting order for pre-selection
    let nextBatsmanName = null;
    for (const name of currentInnings.battingOrder) {
        const batsmanStats = currentInnings.allBatsmen[name];
        if (!batsmanStats || batsmanStats.status === 'not batted') {
            // This is the next batsman who hasn't batted yet
            nextBatsmanName = name;
            break;
        }
    }
    
    availableBatsmen.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        const isRetiredHurt = currentInnings.allBatsmen[name]?.status === 'retired hurt';
        option.textContent = isRetiredHurt ? `${name} (resuming)` : name;
        
        // BUG FIX #4: Pre-select the next batsman in batting order
        if (name === nextBatsmanName) {
            option.selected = true;
        }
        
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
            
            // Check if we need to show the new bowler modal
            // (e.g., wicket fell on the last ball of the over)
            if (pendingNewBowlerModal) {
                pendingNewBowlerModal = false; // Reset flag
                showNewBowlerModalFromDashboard();
            }
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
    
    // Find the bowler who last bowled from the current end
    let suggestedBowler = null;
    if (currentInnings.lastBowlerAtEnd && currentInnings.currentEnd) {
        suggestedBowler = currentInnings.lastBowlerAtEnd[currentInnings.currentEnd];
    }
    
    bowlingSquad.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        // BUG FIX #4: Pre-select the suggested bowler
        if (suggestedBowler && name === suggestedBowler) {
            option.selected = true;
        }
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
 * Open edit ball modal for a specific innings
 */
function openEditBallModalForInnings(inningsNumber, ballIndex) {
    const modal = document.getElementById('dashboard-edit-ball-modal');
    
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No active innings');
        return;
    }
    
    const innings = currentScoringMatch.innings[inningsNumber - 1];
    if (!innings) {
        alert('Invalid innings number');
        return;
    }
    
    const ball = innings.allBalls[ballIndex];
    if (!ball) {
        alert('Ball not found');
        return;
    }
    
    const isCurrentInnings = inningsNumber === currentScoringMatch.innings.length;
    
    // Store innings number and ball index for later
    document.getElementById('edit-ball-index').value = ballIndex;
    document.getElementById('edit-ball-index').setAttribute('data-innings-number', inningsNumber);
    
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
    document.getElementById('edit-ball-fielder').value = ball.fielder || '';
    
    // Show/hide wicket details
    const wicketDetails = document.getElementById('edit-ball-wicket-details');
    if (ball.wicket) {
        wicketDetails.classList.remove('hidden');
    } else {
        wicketDetails.classList.add('hidden');
    }
    
    // Update info with warning if editing completed innings
    const infoDiv = document.getElementById('edit-ball-info');
    let infoText = `Editing ball ${ball.over}.${ball.ball} from Innings ${inningsNumber}`;
    if (!isCurrentInnings) {
        infoText += ' <span style="color: #ffaa00;">⚠️ (Completed Innings - will recalculate match)</span>';
    }
    infoDiv.innerHTML = infoText;
    
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
 * Undo a ball from a specific innings
 */
async function undoBallFromInnings(inningsNumber, ballIndex) {
    const innings = currentScoringMatch.innings[inningsNumber - 1];
    if (!innings) {
        alert('Invalid innings number');
        return;
    }
    
    const isCurrentInnings = inningsNumber === currentScoringMatch.innings.length;
    const ball = innings.allBalls[ballIndex];
    
    let confirmMsg = `Undo ball ${ball.over}.${ball.ball}?`;
    if (!isCurrentInnings) {
        confirmMsg = `⚠️ WARNING: You are undoing a ball from a COMPLETED innings.\nThis will recalculate all match statistics and may affect the match result.\n\nUndo ball ${ball.over}.${ball.ball} from Innings ${inningsNumber}?`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    try {
        const endpoint = isCurrentInnings 
            ? `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/undo`
            : `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/undo-completed-innings-ball`;
        
        const body = isCurrentInnings ? {} : { inningsNumber, ballIndex };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            
            // Update selected innings if needed (if we removed last ball, may need to adjust)
            if (selectedInningsNumber && selectedInningsNumber > currentScoringMatch.innings.length) {
                selectedInningsNumber = currentScoringMatch.innings.length;
            }
            
            setupScoringInterface();
        } else {
            const error = await response.json();
            alert('Failed to undo: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error undoing ball:', error);
        alert('Failed to undo ball');
    }
}

/**
 * Confirm edit ball
 */
async function confirmEditBallFromDashboard() {
    const ballIndex = parseInt(document.getElementById('edit-ball-index').value);
    const inningsNumber = parseInt(document.getElementById('edit-ball-index').getAttribute('data-innings-number'));
    const bowler = document.getElementById('edit-ball-bowler').value;
    const batsman = document.getElementById('edit-ball-batsman').value;
    const runs = parseInt(document.getElementById('edit-ball-runs').value) || 0;
    const overthrows = parseInt(document.getElementById('edit-ball-overthrows').value) || 0;
    const extraType = document.getElementById('edit-ball-extra-type').value;
    const extras = parseInt(document.getElementById('edit-ball-extras').value) || 0;
    const wicket = document.getElementById('edit-ball-wicket').checked;
    const wicketType = wicket ? document.getElementById('edit-ball-wicket-type').value : null;
    const dismissedBatsman = wicket ? document.getElementById('edit-ball-dismissed-batsman').value : null;
    const fielder = wicket ? document.getElementById('edit-ball-fielder').value : null;
    
    if (!bowler || !batsman) {
        alert('Please fill in bowler and batsman');
        return;
    }
    
    // Check if editing completed innings
    const isCurrentInnings = !inningsNumber || inningsNumber === currentScoringMatch.innings.length;
    
    // Show confirmation for completed innings
    if (!isCurrentInnings) {
        if (!confirm('⚠️ You are editing a COMPLETED innings. This will recalculate all match statistics and may affect the match result. Continue?')) {
            return;
        }
    }
    
    try {
        const endpoint = isCurrentInnings 
            ? `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/edit-ball`
            : `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/edit-completed-innings-ball`;
        
        const body = isCurrentInnings 
            ? { ballIndex, bowler, batsman, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman, fielder }
            : { inningsNumber, ballIndex, bowler, batsman, runs, overthrows, extras, extraType, wicket, wicketType, dismissedBatsman, fielder };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify(body)
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

/**
 * Update match day number
 */
async function updateMatchDay() {
    const dayNum = parseInt(document.getElementById('match-day').value);
    
    console.log('updateMatchDay called:', {
        dayNum,
        currentScoringSeriesId,
        matchId: currentScoringMatch?.id,
        sessionId
    });
    
    try {
        const endpoint = currentScoringSeriesId 
            ? `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/update-day`
            : '/api/match/update-day';
        
        console.log('Calling endpoint:', endpoint);
            
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId
            },
            body: JSON.stringify({ day: dayNum })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            setupScoringInterface();
            console.log('Day updated successfully');
        } else {
            const error = await response.json();
            console.error('Server error:', error);
            alert('Failed to update day: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating day:', error);
        alert('Failed to update day');
    }
}

/**
 * Update match message
 */
async function updateMatchMessage() {
    const message = document.getElementById('match-message').value.trim();
    
    try {
        const endpoint = currentScoringSeriesId 
            ? `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/update-message`
            : '/api/match/update-message';
            
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId
            },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            setupScoringInterface();
            alert('Message updated successfully');
        } else {
            const error = await response.json();
            alert('Failed to update message: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating message:', error);
        alert('Failed to update message');
    }
}

/**
 * Clear match message
 */
async function clearMatchMessage() {
    document.getElementById('match-message').value = '';
    await updateMatchMessage();
}

/**
 * Show change batsmen modal
 */
function showChangeBatsmenModalFromDashboard() {
    if (!currentScoringMatch || !currentScoringMatch.innings || currentScoringMatch.innings.length === 0) {
        alert('No active innings');
        return;
    }
    
    const currentInnings = currentScoringMatch.innings[currentScoringMatch.innings.length - 1];
    const battingOrder = currentInnings.battingOrder || [];
    
    // Populate both dropdowns with batting order
    const strikerSelect = document.getElementById('change-striker');
    const nonStrikerSelect = document.getElementById('change-non-striker');
    
    strikerSelect.innerHTML = '<option value="">Select batsman...</option>';
    nonStrikerSelect.innerHTML = '<option value="">Select batsman...</option>';
    
    battingOrder.forEach(name => {
        const strikerOption = document.createElement('option');
        strikerOption.value = name;
        strikerOption.textContent = name;
        strikerSelect.appendChild(strikerOption);
        
        const nonStrikerOption = document.createElement('option');
        nonStrikerOption.value = name;
        nonStrikerOption.textContent = name;
        nonStrikerSelect.appendChild(nonStrikerOption);
    });
    
    // Set current values
    strikerSelect.value = currentInnings.striker || '';
    nonStrikerSelect.value = currentInnings.nonStriker || '';
    
    document.getElementById('change-batsmen-modal').style.display = 'block';
}

/**
 * Hide change batsmen modal
 */
function hideChangeBatsmenModalFromDashboard() {
    document.getElementById('change-batsmen-modal').style.display = 'none';
}

/**
 * Confirm change batsmen
 */
async function confirmChangeBatsmenFromDashboard() {
    const striker = document.getElementById('change-striker').value;
    const nonStriker = document.getElementById('change-non-striker').value;
    
    if (!striker || !nonStriker) {
        alert('Please select both batsmen');
        return;
    }
    
    if (striker === nonStriker) {
        alert('Striker and non-striker must be different');
        return;
    }
    
    try {
        const endpoint = currentScoringSeriesId 
            ? `/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/change-batsmen`
            : '/api/match/change-batsmen';
            
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId
            },
            body: JSON.stringify({ striker, nonStriker })
        });
        
        if (response.ok) {
            currentScoringMatch = await response.json();
            setupScoringInterface();
            hideChangeBatsmenModalFromDashboard();
        } else {
            const error = await response.json();
            alert('Failed to change batsmen: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error changing batsmen:', error);
        alert('Failed to change batsmen');
    }
}

// ========================================
// HOMEPAGE BUILDER
// ========================================

let homepageConfig = { sections: [] };

/**
 * Load homepage tab
 */
async function loadHomepageTab() {
    try {
        const response = await fetch('/api/homepage');
        homepageConfig = await response.json();
        
        renderHomepageSections();
    } catch (error) {
        console.error('Error loading homepage config:', error);
        alert('Failed to load homepage configuration');
    }
}

/**
 * Show homepage builder modal (deprecated - keeping for backwards compatibility)
 */
async function showHomepageBuilder() {
    showTab('homepage');
}

/**
 * Render homepage sections list
 */
function renderHomepageSections() {
    const container = document.getElementById('homepage-sections-list');
    
    if (!homepageConfig.sections || homepageConfig.sections.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">No sections yet. Add a section to get started.</div>';
        return;
    }
    
    let html = '';
    homepageConfig.sections.forEach((section, index) => {
        html += `
            <div class="homepage-section-item" data-index="${index}" draggable="true">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="cursor: move; color: #888;">☰</span>
                    <div style="flex: 1;">
                        <strong>${getSectionTypeLabel(section.type)}</strong>
                        ${getSectionPreview(section)}
                    </div>
                    <button class="btn btn-warning btn-small" onclick="editHomepageSection(${index})">Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteHomepageSection(${index})">Delete</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add drag and drop handlers
    setupDragAndDrop();
}

/**
 * Get section type label
 */
function getSectionTypeLabel(type) {
    const labels = {
        'news-auto': 'Auto News',
        'live-auto': 'Auto Live Matches',
        'header': 'Header',
        'links-grid': 'Links Grid (2 columns)',
        'single-link': 'Single Link'
    };
    return labels[type] || type;
}

/**
 * Get section preview
 */
function getSectionPreview(section) {
    if (section.type === 'header') {
        return `<div style="color: #888;">"${section.text}"</div>`;
    } else if (section.type === 'news-auto') {
        return `<div style="color: #888;">Limit: ${section.limit || 5}${section.includeLive ? ', includes live matches' : ''}</div>`;
    } else if (section.type === 'links-grid') {
        return `<div style="color: #888;">${section.links?.length || 0} links</div>`;
    } else if (section.type === 'single-link') {
        return `<div style="color: #888;">${section.text} → ${section.page}</div>`;
    }
    return '';
}

/**
 * Setup drag and drop
 */
function setupDragAndDrop() {
    const items = document.querySelectorAll('.homepage-section-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(this.dataset.index);
    this.style.opacity = '0.4';
}

function handleDragOver(e) {
    e.preventDefault();
    return false;
}

function handleDrop(e) {
    e.stopPropagation();
    const dropIndex = parseInt(this.dataset.index);
    
    if (draggedIndex !== dropIndex) {
        // Reorder sections
        const sections = [...homepageConfig.sections];
        const [removed] = sections.splice(draggedIndex, 1);
        sections.splice(dropIndex, 0, removed);
        homepageConfig.sections = sections;
        renderHomepageSections();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
}

/**
 * Add homepage section
 */
function addHomepageSection(type) {
    const newSection = {
        id: `section-${Date.now()}`,
        type: type
    };
    
    // Set defaults based on type
    if (type === 'header') {
        newSection.text = 'Section Header';
    } else if (type === 'news-auto') {
        newSection.limit = 5;
        newSection.includeLive = true;
    } else if (type === 'links-grid') {
        newSection.links = [];
    } else if (type === 'single-link') {
        newSection.text = 'Link Text';
        newSection.page = 340;
    }
    
    homepageConfig.sections.push(newSection);
    renderHomepageSections();
    
    // Auto-open edit for the new section
    editHomepageSection(homepageConfig.sections.length - 1);
}

/**
 * Edit homepage section
 */
function editHomepageSection(index) {
    const section = homepageConfig.sections[index];
    
    let form = '';
    
    if (section.type === 'header') {
        form = `
            <label>Header Text:</label>
            <input type="text" id="section-edit-text" value="${section.text || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
        `;
    } else if (section.type === 'news-auto') {
        form = `
            <label>News Limit:</label>
            <input type="number" id="section-edit-limit" value="${section.limit || 5}" style="width: 100px; padding: 8px; margin: 5px 0;">
            <br>
            <label>
                <input type="checkbox" id="section-edit-includelive" ${section.includeLive ? 'checked' : ''}>
                Include live matches
            </label>
        `;
    } else if (section.type === 'links-grid') {
        form = `
            <div id="grid-links-editor"></div>
            <button class="btn btn-primary btn-small" onclick="addGridLink(${index})">+ Add Link</button>
        `;
        setTimeout(() => renderGridLinksEditor(section, index), 100);
    } else if (section.type === 'single-link') {
        form = `
            <label>Link Text:</label>
            <input type="text" id="section-edit-text" value="${section.text || ''}" style="width: 100%; padding: 8px; margin-top: 5px;">
            <br><br>
            <label>Page Number:</label>
            <input type="number" id="section-edit-page" value="${section.page || 340}" style="width: 100px; padding: 8px; margin-top: 5px;">
        `;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.id = 'section-edit-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closeSectionEditModal()">&times;</span>
            <h3>Edit ${getSectionTypeLabel(section.type)}</h3>
            ${form}
            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="saveSectionEdit(${index})">Save</button>
                <button class="btn btn-secondary" onclick="closeSectionEditModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Render grid links editor
 */
function renderGridLinksEditor(section, sectionIndex) {
    const container = document.getElementById('grid-links-editor');
    if (!container) return;
    
    let html = '';
    (section.links || []).forEach((link, linkIndex) => {
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <input type="text" value="${link.text}" onchange="updateGridLink(${sectionIndex}, ${linkIndex}, 'text', this.value)" 
                       placeholder="Link text" style="flex: 1; padding: 8px;">
                <input type="number" value="${link.page}" onchange="updateGridLink(${sectionIndex}, ${linkIndex}, 'page', this.value)" 
                       placeholder="Page" style="width: 100px; padding: 8px;">
                <button class="btn btn-danger btn-small" onclick="deleteGridLink(${sectionIndex}, ${linkIndex})">×</button>
            </div>
        `;
    });
    container.innerHTML = html || '<div style="color: #888;">No links yet</div>';
}

/**
 * Add grid link
 */
function addGridLink(sectionIndex) {
    const section = homepageConfig.sections[sectionIndex];
    if (!section.links) section.links = [];
    section.links.push({ text: 'New Link', page: 340 });
    renderGridLinksEditor(section, sectionIndex);
}

/**
 * Update grid link
 */
function updateGridLink(sectionIndex, linkIndex, field, value) {
    const section = homepageConfig.sections[sectionIndex];
    section.links[linkIndex][field] = field === 'page' ? parseInt(value) : value;
}

/**
 * Delete grid link
 */
function deleteGridLink(sectionIndex, linkIndex) {
    const section = homepageConfig.sections[sectionIndex];
    section.links.splice(linkIndex, 1);
    renderGridLinksEditor(section, sectionIndex);
}

/**
 * Save section edit
 */
function saveSectionEdit(index) {
    const section = homepageConfig.sections[index];
    
    if (section.type === 'header') {
        section.text = document.getElementById('section-edit-text').value;
    } else if (section.type === 'news-auto') {
        section.limit = parseInt(document.getElementById('section-edit-limit').value);
        section.includeLive = document.getElementById('section-edit-includelive').checked;
    } else if (section.type === 'single-link') {
        section.text = document.getElementById('section-edit-text').value;
        section.page = parseInt(document.getElementById('section-edit-page').value);
    }
    // links-grid is updated in real-time
    
    closeSectionEditModal();
    renderHomepageSections();
}

/**
 * Close section edit modal
 */
function closeSectionEditModal() {
    const modal = document.getElementById('section-edit-modal');
    if (modal) modal.remove();
}

/**
 * Delete homepage section
 */
function deleteHomepageSection(index) {
    if (confirm('Delete this section?')) {
        homepageConfig.sections.splice(index, 1);
        renderHomepageSections();
    }
}

/**
 * Save homepage configuration
 */
async function saveHomepageConfig() {
    try {
        const response = await fetch('/api/homepage', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify(homepageConfig)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Homepage saved successfully!');
            closeModal('homepage-builder-modal');
        } else {
            alert('Failed to save homepage: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving homepage:', error);
        alert('Failed to save homepage');
    }
}

/**
 * Show Reorder Batting Modal
 */
async function showReorderBattingModal() {
    if (!currentScoringMatch || !currentScoringSeriesId) {
        alert('No active match for reordering');
        return;
    }
    
    // Populate innings selector
    const inningsSelector = document.getElementById('reorder-innings-selector');
    inningsSelector.innerHTML = '<option value="">Select innings to reorder...</option>';
    
    if (currentScoringMatch.innings && currentScoringMatch.innings.length > 0) {
        currentScoringMatch.innings.forEach((inn, index) => {
            const option = document.createElement('option');
            option.value = inn.number;
            option.textContent = `Innings ${inn.number} - ${inn.battingTeam} (${inn.runs}/${inn.wickets})`;
            inningsSelector.appendChild(option);
        });
    }
    
    // Reset container
    document.getElementById('reorder-batting-container').style.display = 'none';
    document.getElementById('reorder-batting-list').innerHTML = '';
    
    // Show modal
    document.getElementById('reorder-batting-modal').style.display = 'block';
}

/**
 * Load Batting Order For Reorder
 */
async function loadBattingOrderForReorder() {
    const inningsNumber = parseInt(document.getElementById('reorder-innings-selector').value);
    
    if (!inningsNumber) {
        document.getElementById('reorder-batting-container').style.display = 'none';
        return;
    }
    
    const innings = currentScoringMatch.innings.find(inn => inn.number === inningsNumber);
    if (!innings || !innings.battingOrder) {
        alert('Invalid innings selected');
        return;
    }
    
    // Display batting order as draggable items
    const battingList = document.getElementById('reorder-batting-list');
    battingList.innerHTML = '';
    
    innings.battingOrder.forEach((playerName, index) => {
        const item = document.createElement('div');
        item.className = 'batting-order-item';
        item.draggable = true;
        item.dataset.playerName = playerName;
        item.dataset.originalIndex = index;
        
        item.innerHTML = `
            <div class="batting-position-number">${index + 1}.</div>
            <div class="batting-player-name">${playerName}</div>
        `;
        
        // Drag event listeners
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        
        battingList.appendChild(item);
    });
    
    document.getElementById('reorder-batting-container').style.display = 'block';
}

// Track the element being dragged (standard pattern for vanilla JS drag-and-drop)
let draggedElement = null;

/**
 * Handle drag start
 */
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

/**
 * Handle drag enter
 */
function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

/**
 * Handle drop
 */
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        // Get all items
        const battingList = document.getElementById('reorder-batting-list');
        const allItems = Array.from(battingList.children);
        
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);
        
        // Reorder in DOM
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
        
        // Update position numbers
        updateBattingPositionNumbers();
    }
    
    this.classList.remove('drag-over');
    return false;
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove drag-over class from all items
    const items = document.querySelectorAll('.batting-order-item');
    items.forEach(item => {
        item.classList.remove('drag-over');
    });
}

/**
 * Update Batting Position Numbers
 */
function updateBattingPositionNumbers() {
    const items = document.querySelectorAll('.batting-order-item');
    items.forEach((item, index) => {
        const positionNumber = item.querySelector('.batting-position-number');
        if (positionNumber) {
            positionNumber.textContent = `${index + 1}.`;
        }
    });
}

/**
 * Save Reordered Batting
 */
async function saveReorderedBatting() {
    const inningsNumber = parseInt(document.getElementById('reorder-innings-selector').value);
    
    if (!inningsNumber) {
        alert('Please select an innings');
        return;
    }
    
    // Get the current order from DOM
    const items = document.querySelectorAll('.batting-order-item');
    const newBattingOrder = Array.from(items).map(item => item.dataset.playerName);
    
    if (newBattingOrder.length !== 11) {
        alert('Batting order must contain exactly 11 players');
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/reorder-batting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                inningsNumber: inningsNumber,
                newBattingOrder: newBattingOrder
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Batting order updated successfully!');
            closeModal('reorder-batting-modal');
            
            // Reload match data
            await manageMatch(currentScoringSeriesId, currentScoringMatch.id);
        } else {
            const errorMsg = data.error || 'Unknown error';
            alert(`Failed to update batting order: ${errorMsg}`);
        }
    } catch (error) {
        console.error('Error saving batting order:', error);
        alert('Failed to save batting order');
    }
}

/**
 * Open Edit Batting Positions Modal
 */
async function openEditBattingPositionsModal() {
    if (!currentScoringMatch || !currentScoringSeriesId) {
        alert('No active match for editing positions');
        return;
    }
    
    // Populate innings selector
    const inningsSelector = document.getElementById('edit-positions-innings-selector');
    inningsSelector.innerHTML = '<option value="">Select innings...</option>';
    
    if (currentScoringMatch.innings && currentScoringMatch.innings.length > 0) {
        currentScoringMatch.innings.forEach((inn, index) => {
            const option = document.createElement('option');
            option.value = inn.number;
            option.textContent = `Innings ${inn.number} - ${inn.battingTeam} (${inn.runs}/${inn.wickets})`;
            inningsSelector.appendChild(option);
        });
    }
    
    // Reset container
    document.getElementById('batsmen-position-list').innerHTML = '';
    document.getElementById('edit-position-actions').style.display = 'none';
    
    // Show modal
    document.getElementById('edit-batting-positions-modal').style.display = 'block';
}

/**
 * Load Batsmen For Position Edit
 */
async function loadBatsmenForPositionEdit() {
    const inningsNumber = parseInt(document.getElementById('edit-positions-innings-selector').value);
    
    if (!inningsNumber) {
        document.getElementById('batsmen-position-list').innerHTML = '';
        document.getElementById('edit-position-actions').style.display = 'none';
        return;
    }
    
    const innings = currentScoringMatch.innings.find(inn => inn.number === inningsNumber);
    if (!innings || !innings.allBatsmen) {
        document.getElementById('batsmen-position-list').innerHTML = '<p>No batsmen found for this innings</p>';
        return;
    }
    
    // Get all batsmen who have batted (have balls > 0 or status is not 'not batted')
    const batsmenArray = Object.entries(innings.allBatsmen)
        .map(([name, stats]) => ({ name, ...stats }))
        .filter(b => b.balls > 0 || b.status !== 'not batted')
        .sort((a, b) => {
            // Sort by current battingPosition, or fallback to battingOrder
            const posA = a.battingPosition || innings.battingOrder.indexOf(a.name) + 1;
            const posB = b.battingPosition || innings.battingOrder.indexOf(b.name) + 1;
            return posA - posB;
        });
    
    if (batsmenArray.length === 0) {
        document.getElementById('batsmen-position-list').innerHTML = '<p>No batsmen have batted yet</p>';
        document.getElementById('edit-position-actions').style.display = 'none';
        return;
    }
    
    // Build list of batsmen with editable position inputs
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid #00ff00;">';
    html += '<th style="text-align: left; padding: 8px;">Position</th>';
    html += '<th style="text-align: left; padding: 8px;">Batsman</th>';
    html += '<th style="text-align: right; padding: 8px;">Stats</th>';
    html += '<th style="text-align: center; padding: 8px;">Action</th>';
    html += '</tr></thead><tbody>';
    
    batsmenArray.forEach(batsman => {
        const currentPos = batsman.battingPosition || innings.battingOrder.indexOf(batsman.name) + 1;
        const stats = `${batsman.runs} runs (${batsman.balls} balls)`;
        const statusText = batsman.status === 'out' ? 'out' : batsman.status === 'not out' ? 'not out*' : batsman.status;
        
        html += `<tr style="border-bottom: 1px solid #333;">`;
        html += `<td style="padding: 8px;">
            <input type="number" min="1" max="11" 
                   id="pos-${batsman.name.replace(/\s/g, '-')}" 
                   value="${currentPos}" 
                   style="width: 60px; padding: 4px; background: #0a0a0a; border: 1px solid #00ff00; color: #00ff00;" />
        </td>`;
        html += `<td style="padding: 8px;">${batsman.name}</td>`;
        html += `<td style="padding: 8px; text-align: right;">${stats} - ${statusText}</td>`;
        html += `<td style="padding: 8px; text-align: center;">
            <button class="btn btn-small btn-primary" 
                    onclick="saveBattingPosition(${inningsNumber}, '${batsman.name.replace(/'/g, "\\'")}')">
                Save
            </button>
        </td>`;
        html += `</tr>`;
    });
    
    html += '</tbody></table>';
    
    document.getElementById('batsmen-position-list').innerHTML = html;
    document.getElementById('edit-position-actions').style.display = 'flex';
}

/**
 * Save Batting Position
 */
async function saveBattingPosition(inningsNumber, batsmanName) {
    const inputId = `pos-${batsmanName.replace(/\s/g, '-')}`;
    const newPosition = parseInt(document.getElementById(inputId).value);
    
    if (!newPosition || newPosition < 1 || newPosition > 11) {
        alert('Position must be between 1 and 11');
        return;
    }
    
    try {
        const response = await fetch(`/api/series/${currentScoringSeriesId}/match/${currentScoringMatch.id}/edit-batting-position`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                inningsNumber: inningsNumber,
                batsmanName: batsmanName,
                newPosition: newPosition
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Position updated for ${batsmanName}!`);
            
            // Update local match data
            currentScoringMatch = data.match;
            
            // Reload the batsmen list to show updated positions
            await loadBatsmenForPositionEdit();
            
            // Refresh the scorecard preview
            if (typeof updateScoringInterface === 'function') {
                updateScoringInterface();
            }
        } else {
            const errorMsg = data.error || 'Unknown error';
            alert(`Failed to update position: ${errorMsg}`);
        }
    } catch (error) {
        console.error('Error saving batting position:', error);
        alert('Failed to save batting position');
    }
}
