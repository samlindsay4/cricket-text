// Page Viewer JavaScript
let currentPage = 340;
let currentSubpage = 1;
let totalSubpages = 1;
let subpageInterval = null;
let refreshInterval = null;

/**
 * Get page number from URL
 */
function getPageFromURL() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    return page ? parseInt(page) : 340;
}

/**
 * Update URL without page reload
 */
function updateURL(page) {
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
}

/**
 * Update header date and time
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

/**
 * Navigate to a specific page
 */
function navigatePage(target) {
    if (target === 'prev') {
        currentPage = Math.max(340, currentPage - 1);
    } else if (target === 'next') {
        currentPage = currentPage + 1;
    } else {
        currentPage = parseInt(target);
    }
    
    updateURL(currentPage);
    loadPage(currentPage);
}

/**
 * Navigate to page entered in input
 */
function navigateToInputPage() {
    const input = document.getElementById('page-input');
    const page = parseInt(input.value);
    
    if (page && page >= 340) {
        navigatePage(page);
        input.value = '';
    }
}

/**
 * Load and display page content
 */
async function loadPage(pageNum) {
    try {
        // Clear any existing intervals
        if (subpageInterval) {
            clearInterval(subpageInterval);
            subpageInterval = null;
        }
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        
        currentPage = pageNum;
        currentSubpage = 1;
        
        // Update page number display
        document.getElementById('page-number-display').textContent = `P${pageNum}`;
        document.getElementById('current-page-num').textContent = pageNum;
        
        const response = await fetch(`/api/page-data?page=${pageNum}`);
        const data = await response.json();
        
        if (!response.ok) {
            showErrorPage(data.error || 'Page not found');
            return;
        }
        
        // Render page based on type
        switch (data.type) {
            case 'homepage':
                renderHomepage(data);
                break;
            case 'news':
                renderNewsPage(data);
                break;
            case 'series-overview':
                renderSeriesOverview(data);
                break;
            case 'series-live':
                renderLiveScore(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), 2000);
                break;
            case 'scorecard':
                renderScorecard(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), 2000);
                break;
            case 'fixtures':
                renderFixtures(data);
                break;
            case 'results':
                renderResults(data);
                break;
            case 'batting-stats':
                renderBattingStats(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), 2000);
                break;
            case 'bowling-stats':
                renderBowlingStats(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), 2000);
                break;
            default:
                showErrorPage('Unknown page type');
        }
    } catch (error) {
        console.error('Error loading page:', error);
        showErrorPage('Failed to load page');
    }
}

/**
 * Show error page
 */
function showErrorPage(message) {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div style="text-align: center; color: var(--teletext-red); padding: 40px;">
            <div style="font-size: 16px; margin-bottom: 20px;">PAGE NOT FOUND</div>
            <div style="font-size: 10px;">${message}</div>
            <div style="margin-top: 20px;">
                <span class="page-link" onclick="navigatePage(340)">Return to Homepage (p340)</span>
            </div>
        </div>
    `;
}

/**
 * Render Homepage (Page 340)
 */
function renderHomepage(data) {
    let html = '<div class="headline" style="font-size: 16px; margin-bottom: 20px;">CEEFAX CRICKET</div>';
    
    // Live Matches
    if (data.liveMatches && data.liveMatches.length > 0) {
        html += '<div class="section-header" style="background: var(--teletext-yellow); color: var(--teletext-black); padding: 8px; margin: 15px 0;">LIVE MATCHES</div>';
        
        data.liveMatches.forEach(match => {
            const currentInnings = match.innings[match.innings.length - 1];
            html += `
                <div class="mini-score">
                    <div style="color: var(--teletext-yellow); font-size: 12px;">
                        → ${match.seriesName.toUpperCase()}
                        <span class="page-link" onclick="navigatePage(${match.seriesPage})">p${match.seriesPage}</span>
                    </div>
                    <div style="color: var(--teletext-white); margin-top: 5px;">
                        ${currentInnings.battingTeam} ${currentInnings.runs}/${currentInnings.wickets} (${currentInnings.overs}.${currentInnings.balls} overs)
                    </div>
                    ${match.matchSituation.leadBy ? `<div style="color: var(--teletext-cyan); font-size: 8px;">Trail by ${match.matchSituation.leadBy} runs</div>` : ''}
                </div>
            `;
        });
    }
    
    // News
    if (data.news && data.news.length > 0) {
        html += '<div class="section-header" style="background: var(--teletext-yellow); color: var(--teletext-black); padding: 8px; margin: 15px 0;">NEWS</div>';
        
        data.news.forEach(newsItem => {
            html += `
                <div style="margin: 10px 0;">
                    <span class="page-link" onclick="navigatePage(${newsItem.page})">${newsItem.title}</span>
                    <span class="page-link" style="float: right;">p${newsItem.page}</span>
                </div>
            `;
        });
    }
    
    // Series
    if (data.series && data.series.length > 0) {
        html += '<div class="section-header" style="background: var(--teletext-yellow); color: var(--teletext-black); padding: 8px; margin: 15px 0;">SERIES</div>';
        
        data.series.forEach(series => {
            const seriesScore = Object.entries(series.seriesScore)
                .map(([team, wins]) => `${team} ${wins}`)
                .join(' - ');
            
            html += `
                <div style="margin: 10px 0;">
                    <span class="page-link" onclick="navigatePage(${series.startPage})">${series.name}</span>
                    <span class="page-link" style="float: right;">p${series.startPage}</span>
                    <div style="color: var(--teletext-cyan); font-size: 8px; margin-top: 3px;">${seriesScore}</div>
                </div>
            `;
        });
    }
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render News Page
 */
function renderNewsPage(data) {
    const news = data.newsItem;
    const html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${news.title.toUpperCase()}</div>
        <div style="color: var(--teletext-cyan); font-size: 8px; margin-bottom: 15px;">${news.date}</div>
        <div class="news-content">${news.content}</div>
        <div style="margin-top: 20px;">
            <span class="page-link" onclick="navigatePage(340)">Homepage</span>
            <span class="page-link" style="float: right;">p340</span>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Series Overview (Page +0)
 */
function renderSeriesOverview(data) {
    const series = data.series;
    const seriesScoreText = Object.entries(series.seriesScore)
        .map(([team, wins]) => `${team} ${wins}`)
        .join(' - ');
    
    let html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${series.name.toUpperCase()}</div>
        <div style="color: var(--teletext-white); margin-bottom: 10px;">${series.team1} vs ${series.team2}</div>
        <div class="series-score-line">SERIES: ${seriesScoreText}</div>
    `;
    
    // Current Match
    if (data.currentMatch) {
        const match = data.currentMatch;
        html += `
            <div class="section-header" style="background: var(--teletext-cyan); color: var(--teletext-black); padding: 8px; margin: 15px 0;">
                CURRENT MATCH <span class="live-indicator">LIVE</span>
            </div>
            <div style="color: var(--teletext-white);">
                ${match.title} - ${match.venue}
            </div>
        `;
    }
    
    // Next Match
    if (data.nextMatch) {
        const match = data.nextMatch;
        html += `
            <div class="section-header" style="background: var(--teletext-yellow); color: var(--teletext-black); padding: 8px; margin: 15px 0;">NEXT MATCH</div>
            <div style="color: var(--teletext-white);">
                ${match.title} - ${match.venue || 'TBC'}
                <div style="color: var(--teletext-cyan); font-size: 8px; margin-top: 5px;">${match.date || 'Date TBC'}</div>
            </div>
        `;
    }
    
    // Navigation links
    html += `
        <div style="margin-top: 30px; color: var(--teletext-white);">
            <div style="margin: 5px 0;">
                <span>Live Score</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 1})">p${series.startPage + 1}</span>
            </div>
            <div style="margin: 5px 0;">
                <span>Full Scorecard</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 2})">p${series.startPage + 2}</span>
            </div>
            <div style="margin: 5px 0;">
                <span>Fixtures</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 3})">p${series.startPage + 3}</span>
            </div>
            <div style="margin: 5px 0;">
                <span>Results</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 4})">p${series.startPage + 4}</span>
            </div>
            <div style="margin: 5px 0;">
                <span>Leading Run Scorers</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 5})">p${series.startPage + 5}</span>
            </div>
            <div style="margin: 5px 0;">
                <span>Leading Wicket Takers</span>
                <span class="page-link" style="float: right;" onclick="navigatePage(${series.startPage + 6})">p${series.startPage + 6}</span>
            </div>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Live Score (reuse existing scorecard logic)
 */
function renderLiveScore(data) {
    const match = data.match;
    
    if (!match || !match.innings || match.innings.length === 0) {
        document.getElementById('page-content').innerHTML = `
            <div style="text-align: center; color: var(--teletext-yellow); padding: 40px;">
                NO LIVE MATCH
            </div>
        `;
        return;
    }
    
    // Use similar rendering to the original scorecard
    const currentInnings = match.innings[match.innings.length - 1];
    
    let html = `
        <div class="headline" style="font-size: 14px;">
            ${match.title.toUpperCase()} <span class="live-indicator">LIVE</span>
        </div>
        <div style="color: var(--teletext-cyan); font-size: 8px; margin: 10px 0;">${match.venue}</div>
        
        <div class="score-display">
            <div class="team-score">
                ${currentInnings.battingTeam.toUpperCase()} ${currentInnings.runs}/${currentInnings.wickets}
            </div>
            <div style="font-size: 10px;">(${currentInnings.overs}.${currentInnings.balls} overs)</div>
        </div>
    `;
    
    // Current batsmen
    if (currentInnings.striker && currentInnings.allBatsmen) {
        html += '<div class="batsmen">';
        
        const striker = currentInnings.allBatsmen[currentInnings.striker];
        const nonStriker = currentInnings.allBatsmen[currentInnings.nonStriker];
        
        if (striker) {
            html += `
                <div class="batsman">
                    <span class="batsman-name">${striker.name || currentInnings.striker}*</span>
                    <span class="batsman-stats">${striker.runs} (${striker.balls})</span>
                </div>
            `;
        }
        
        if (nonStriker) {
            html += `
                <div class="batsman">
                    <span class="batsman-name">${nonStriker.name || currentInnings.nonStriker}</span>
                    <span class="batsman-stats">${nonStriker.runs} (${nonStriker.balls})</span>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    // Current bowler
    if (currentInnings.currentBowler && currentInnings.allBowlers) {
        const bowler = currentInnings.allBowlers[currentInnings.currentBowler.name];
        if (bowler) {
            html += `
                <div class="bowler">
                    <div class="bowler-name">${bowler.name}</div>
                    <div>${bowler.overs}.${bowler.balls % 6}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}</div>
                </div>
            `;
        }
    }
    
    // Current over
    if (currentInnings.currentOver && currentInnings.currentOver.length > 0) {
        html += '<div class="current-over-section"><div class="over-title">THIS OVER</div><div class="over-balls">';
        
        currentInnings.currentOver.forEach(ball => {
            let ballClass = 'ball ball-dot';
            let ballText = '•';
            
            if (ball.wicket) {
                ballClass = 'ball ball-wicket';
                ballText = 'W';
            } else if (ball.runs === 4) {
                ballClass = 'ball ball-boundary';
                ballText = '4';
            } else if (ball.runs === 6) {
                ballClass = 'ball ball-boundary';
                ballText = '6';
            } else if (ball.runs > 0 || ball.extras > 0) {
                ballClass = 'ball ball-runs';
                ballText = (ball.runs + ball.extras).toString();
            }
            
            html += `<div class="${ballClass}">${ballText}</div>`;
        });
        
        html += '</div></div>';
    }
    
    html += `
        <div style="margin-top: 20px;">
            <span class="page-link" onclick="navigatePage(${data.series.startPage + 2})">Full Scorecard</span>
            <span class="page-link" style="float: right;">p${data.series.startPage + 2}</span>
        </div>
    `;
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Full Scorecard with subpage cycling
 */
function renderScorecard(data) {
    const match = data.match;
    
    if (!match || !match.innings || match.innings.length === 0) {
        document.getElementById('page-content').innerHTML = `
            <div style="text-align: center; color: var(--teletext-yellow); padding: 40px;">
                NO MATCH DATA
            </div>
        `;
        return;
    }
    
    // Calculate total subpages (2 per innings: batting and bowling)
    totalSubpages = match.innings.length * 2;
    
    // Render current subpage
    renderScorecardSubpage(match, currentSubpage);
    
    // Auto-cycle subpages every 5 seconds
    if (subpageInterval) {
        clearInterval(subpageInterval);
    }
    
    subpageInterval = setInterval(() => {
        currentSubpage++;
        if (currentSubpage > totalSubpages) {
            currentSubpage = 1;
        }
        renderScorecardSubpage(match, currentSubpage);
    }, 5000);
}

/**
 * Render specific scorecard subpage
 */
function renderScorecardSubpage(match, subpage) {
    const inningsIndex = Math.floor((subpage - 1) / 2);
    const isBatting = (subpage % 2 === 1);
    
    if (inningsIndex >= match.innings.length) {
        return;
    }
    
    const innings = match.innings[inningsIndex];
    
    let html = `
        <div class="headline" style="font-size: 14px;">${match.title.toUpperCase()}</div>
        <div style="color: var(--teletext-cyan); font-size: 8px; margin: 10px 0;">${match.venue}</div>
        
        <div class="section-header" style="background: var(--teletext-yellow); color: var(--teletext-black); padding: 8px; margin: 15px 0;">
            ${innings.battingTeam.toUpperCase()} ${isBatting ? 'BATTING' : 'BOWLING'} - INNINGS ${innings.number}
        </div>
    `;
    
    if (isBatting) {
        // Show batting card
        html += '<table class="stats-table"><tr><th>BATSMAN</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr>';
        
        if (innings.allBatsmen) {
            Object.values(innings.allBatsmen).forEach(batsman => {
                if (batsman.balls > 0 || batsman.status !== 'not batted') {
                    html += `
                        <tr>
                            <td>${batsman.name || 'Unknown'} ${batsman.status === 'batting' ? '*' : ''}</td>
                            <td>${batsman.runs}</td>
                            <td>${batsman.balls}</td>
                            <td>${batsman.fours}</td>
                            <td>${batsman.sixes}</td>
                        </tr>
                    `;
                }
            });
        }
        
        html += `
            <tr style="background: var(--teletext-blue);">
                <td><strong>TOTAL</strong></td>
                <td><strong>${innings.runs}/${innings.wickets}</strong></td>
                <td colspan="3"><strong>(${innings.overs}.${innings.balls} overs)</strong></td>
            </tr>
        </table>`;
    } else {
        // Show bowling card
        html += '<table class="stats-table"><tr><th>BOWLER</th><th>O</th><th>M</th><th>R</th><th>W</th></tr>';
        
        if (innings.allBowlers) {
            Object.values(innings.allBowlers).forEach(bowler => {
                if (bowler.balls > 0) {
                    const oversStr = bowler.overs + '.' + (bowler.balls % 6);
                    html += `
                        <tr>
                            <td>${bowler.name || 'Unknown'}</td>
                            <td>${oversStr}</td>
                            <td>${bowler.maidens}</td>
                            <td>${bowler.runs}</td>
                            <td>${bowler.wickets}</td>
                        </tr>
                    `;
                }
            });
        }
        
        html += '</table>';
    }
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = `Page ${currentPage}/${subpage}`;
}

/**
 * Render Fixtures page
 */
function renderFixtures(data) {
    const series = data.series;
    
    let html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${series.name.toUpperCase()} - FIXTURES</div>
    `;
    
    series.matches.forEach(match => {
        const statusIcon = match.status === 'completed' ? '✓' : match.status === 'live' ? '→' : '';
        const statusColor = match.status === 'completed' ? 'var(--teletext-green)' : 
                           match.status === 'live' ? 'var(--teletext-red)' : 'var(--teletext-yellow)';
        
        html += `
            <div class="fixture-item">
                <div style="color: ${statusColor}; font-size: 10px;">
                    ${statusIcon} ${match.title.toUpperCase()}
                </div>
                <div style="color: var(--teletext-white); margin-top: 5px;">
                    ${match.venue || 'Venue TBC'}
                </div>
                <div style="color: var(--teletext-cyan); font-size: 8px; margin-top: 3px;">
                    ${match.date || 'Date TBC'}
                </div>
                ${match.result ? `<div style="color: var(--teletext-yellow); font-size: 8px; margin-top: 3px;">${match.result}</div>` : ''}
            </div>
        `;
    });
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Results page
 */
function renderResults(data) {
    const series = data.series;
    
    let html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${series.name.toUpperCase()} - RESULTS</div>
    `;
    
    if (data.completedMatches && data.completedMatches.length > 0) {
        data.completedMatches.forEach(match => {
            html += `
                <div class="fixture-item">
                    <div style="color: var(--teletext-green); font-size: 10px;">
                        ✓ ${match.title.toUpperCase()}
                    </div>
                    <div style="color: var(--teletext-white); margin-top: 5px;">
                        ${match.venue}
                    </div>
                    ${match.result ? `<div style="color: var(--teletext-yellow); font-size: 8px; margin-top: 5px;">${match.result}</div>` : ''}
                </div>
            `;
        });
    } else {
        html += `<div style="text-align: center; color: var(--teletext-yellow); padding: 20px;">NO COMPLETED MATCHES</div>`;
    }
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Batting Stats page
 */
function renderBattingStats(data) {
    const series = data.series;
    const batsmen = data.batsmen || [];
    
    let html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${series.name.toUpperCase()} - LEADING RUN SCORERS</div>
    `;
    
    if (batsmen.length > 0) {
        html += '<table class="stats-table"><tr><th>PLAYER</th><th>RUNS</th><th>AVG</th><th>HS</th><th>100s</th><th>50s</th></tr>';
        
        batsmen.slice(0, 20).forEach(b => {
            html += `
                <tr>
                    <td>${b.name} (${b.team})</td>
                    <td>${b.runs}</td>
                    <td>${b.average}</td>
                    <td>${b.highScore}</td>
                    <td>${b.hundreds}</td>
                    <td>${b.fifties}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    } else {
        html += `<div style="text-align: center; color: var(--teletext-yellow); padding: 20px;">NO STATS AVAILABLE YET</div>`;
    }
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Bowling Stats page
 */
function renderBowlingStats(data) {
    const series = data.series;
    const bowlers = data.bowlers || [];
    
    let html = `
        <div class="headline" style="font-size: 14px; margin-bottom: 15px;">${series.name.toUpperCase()} - LEADING WICKET TAKERS</div>
    `;
    
    if (bowlers.length > 0) {
        html += '<table class="stats-table"><tr><th>PLAYER</th><th>WKTS</th><th>AVG</th><th>BEST</th><th>5W</th></tr>';
        
        bowlers.slice(0, 20).forEach(b => {
            const bestFigures = `${b.bestFigures.wickets}/${b.bestFigures.runs}`;
            html += `
                <tr>
                    <td>${b.name} (${b.team})</td>
                    <td>${b.wickets}</td>
                    <td>${b.average}</td>
                    <td>${bestFigures}</td>
                    <td>${b.fiveWickets}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    } else {
        html += `<div style="text-align: center; color: var(--teletext-yellow); padding: 20px;">NO STATS AVAILABLE YET</div>`;
    }
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Update clock every second
    updateHeaderDateTime();
    setInterval(updateHeaderDateTime, 1000);
    
    // Load initial page
    const page = getPageFromURL();
    loadPage(page);
    
    // Handle Enter key in page input
    document.getElementById('page-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            navigateToInputPage();
        }
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        const page = getPageFromURL();
        loadPage(page);
    });
});
