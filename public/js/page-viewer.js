// Page Viewer JavaScript
let currentPage = 340;
let currentSubpage = 1;
let totalSubpages = 1;
let subpageInterval = null;
let refreshInterval = null;

// Constants
const LIVE_REFRESH_INTERVAL = 2000; // 2 seconds
const SUBPAGE_CYCLE_INTERVAL = 5000; // 5 seconds
const SUBPAGES_PER_INNINGS = 2; // Batting and Bowling

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
    // Format: SAT 08 NOV
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const dateStr = `${dayName} ${day} ${month}`;
    
    // Format: 16:51/12
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}/${seconds}`;
    
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
        document.getElementById('page-number-display').textContent = pageNum;
        
        const response = await fetch(`/api/page-data?page=${pageNum}&_t=${Date.now()}`, {
            cache: 'no-store'
        });
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
                refreshInterval = setInterval(() => loadPage(currentPage), LIVE_REFRESH_INTERVAL);
                break;
            case 'scorecard':
                renderScorecard(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), LIVE_REFRESH_INTERVAL);
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
                refreshInterval = setInterval(() => loadPage(currentPage), LIVE_REFRESH_INTERVAL);
                break;
            case 'bowling-stats':
                renderBowlingStats(data);
                // Auto-refresh every 2 seconds
                refreshInterval = setInterval(() => loadPage(currentPage), LIVE_REFRESH_INTERVAL);
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
                    ${match.matchSituation && match.matchSituation.leadBy ? `<div style="color: var(--teletext-cyan); font-size: 8px;">Trail by ${match.matchSituation.leadBy} runs</div>` : ''}
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
 * Render Live Score - TELETEST Style
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
    
    const currentInnings = match.innings[match.innings.length - 1];
    
    // Calculate match situation
    let matchSituation = '';
    
    // Determine day of test match (rough estimation based on overs)
    let totalOvers = 0;
    match.innings.forEach(inn => totalOvers += (inn.overs || 0));
    let dayNum = Math.min(5, Math.ceil(totalOvers / 90) || 1);
    
    // Helper function to capitalize first letter of each word
    const capitalizeWords = (str) => {
        return str.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    // Build match header with venue and day - font size 18px
    let html = `
        <div style="display: flex; justify-content: space-between; color: var(--teletext-green); font-size: 18px; margin-bottom: 10px; font-family: var(--font-teletext);">
            <span>${match.title.toUpperCase()}, ${capitalizeWords(match.venue || '')} (Day ${dayNum})</span>
            <span style="color: var(--teletext-white);">1/1</span>
        </div>
    `;
    
    // Group innings by team and calculate cumulative scores
    const team1 = match.team1;
    const team2 = match.team2;
    
    const team1Innings = match.innings.filter(i => i.battingTeam === team1);
    const team2Innings = match.innings.filter(i => i.battingTeam === team2);
    
    // Display team scores - ALWAYS show at least first innings - font size 18px
    if (team1Innings.length > 0) {
        const firstInns = team1Innings[0];
        const wicketsText = firstInns.wickets >= 10 ? '' : `-${firstInns.wickets}`;
        const isCurrentFirst = firstInns === currentInnings;
        let scoreText = isCurrentFirst ? `${firstInns.runs}${wicketsText} (${firstInns.overs}.${firstInns.balls} ov)` : `${firstInns.runs}`;
        
        if (team1Innings.length > 1) {
            const secondInns = team1Innings[1];
            const decText = secondInns.declared ? ' dec' : '';
            const wicketsText2 = secondInns.wickets >= 10 ? '' : `-${secondInns.wickets}`;
            // Only show overs for ongoing innings (current innings)
            const isCurrentInnings = secondInns === currentInnings;
            const oversText = isCurrentInnings ? ` (${secondInns.overs}.${secondInns.balls} ov)` : '';
            scoreText += ` & ${secondInns.runs}${wicketsText2}${decText}${oversText}`;
        }
        
        html += `
            <div style="color: var(--teletext-yellow); font-size: 18px; margin: 5px 0; font-family: var(--font-teletext);">
                ${capitalizeWords(team1)}: ${scoreText}
            </div>
        `;
    }
    
    if (team2Innings.length > 0) {
        const firstInns = team2Innings[0];
        const wicketsText = firstInns.wickets >= 10 ? '' : `-${firstInns.wickets}`;
        const isCurrentFirst = firstInns === currentInnings;
        let scoreText = isCurrentFirst ? `${firstInns.runs}${wicketsText} (${firstInns.overs}.${firstInns.balls} ov)` : `${firstInns.runs}`;
        
        if (team2Innings.length > 1) {
            const secondInns = team2Innings[1];
            const decText = secondInns.declared ? ' dec' : '';
            const wicketsText2 = secondInns.wickets >= 10 ? '' : `-${secondInns.wickets}`;
            // Only show overs for ongoing innings (current innings)
            const isCurrentInnings = secondInns === currentInnings;
            const oversText = isCurrentInnings ? ` (${secondInns.overs}.${secondInns.balls} ov)` : '';
            scoreText += ` & ${secondInns.runs}${wicketsText2}${decText}${oversText}`;
        }
        
        html += `
            <div style="color: var(--teletext-yellow); font-size: 18px; margin: 5px 0; font-family: var(--font-teletext);">
                ${capitalizeWords(team2)}: ${scoreText}
            </div>
        `;
    }
    
    // Match situation (lead/trail/chase) - sentence case - consistent 10px font
    const team1Total = team1Innings.reduce((sum, i) => sum + i.runs, 0);
    const team2Total = team2Innings.reduce((sum, i) => sum + i.runs, 0);
    
    // Check if match is completed and show result
    if (match.status === 'completed' && match.result) {
        // Show the match result
        matchSituation = match.result;
    } else if (match.innings.length === 2) {
        // First innings of each team complete
        const lead = team1Total - team2Total;
        
        if (lead > 0 && currentInnings.battingTeam === team2) {
            matchSituation = `${capitalizeWords(team2)} trail by ${lead} runs`;
        } else if (lead < 0 && currentInnings.battingTeam === team1) {
            matchSituation = `${capitalizeWords(team1)} trail by ${Math.abs(lead)} runs`;
        }
    } else if (match.innings.length >= 4 || (match.innings.length === 3 && currentInnings.number === 4)) {
        // Fourth innings - calculate chase target
        const target = team1Total - team2Total + 1;
        if (target > 0 && currentInnings.battingTeam === team2) {
            matchSituation = `${capitalizeWords(team2)} require ${target} to win`;
        } else if (target < 0 && currentInnings.battingTeam === team1) {
            matchSituation = `${capitalizeWords(team1)} require ${Math.abs(target)} to win`;
        }
    } else if (match.innings.length === 3) {
        // Third innings - show lead
        const lead = team1Total - team2Total;
        if (lead > 0 && currentInnings.battingTeam === team1) {
            matchSituation = `${capitalizeWords(team1)} lead by ${lead} runs`;
        } else if (lead < 0 && currentInnings.battingTeam === team2) {
            matchSituation = `${capitalizeWords(team2)} lead by ${Math.abs(lead)} runs`;
        }
    }
    
    if (matchSituation) {
        html += `
            <div style="color: var(--teletext-yellow); font-size: 18px; margin: 10px 0 15px 0; font-family: var(--font-teletext);">
                ${matchSituation}
            </div>
        `;
    }
    
    // Calculate innings number for this team (1st or 2nd)
    const teamInningsCount = match.innings.filter(i => i.battingTeam === currentInnings.battingTeam).length;
    const teamInningsOrdinal = teamInningsCount === 1 ? '1st' : '2nd';
    
    // Section header for current innings - white text, no background - font size 18px
    html += `
        <div style="color: var(--teletext-white); padding: 5px 0; margin: 15px 0 5px 0; font-size: 18px; font-weight: bold; font-family: var(--font-teletext);">
            ${currentInnings.battingTeam.toUpperCase()}, ${teamInningsOrdinal} Inns:
        </div>
    `;
    
    // Batting table - only show current 2 batsmen - with fixed column widths for alignment - font size 18px
    html += `
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 18px; font-family: var(--font-teletext);">
            <tr style="background: var(--teletext-black);">
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 60%;">Batters</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">R</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">B</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">4s</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">6s</th>
            </tr>
    `;
    
    // Show batsmen - for completed matches show last 2, for live show striker and non-striker
    if (currentInnings.allBatsmen) {
        if (match.status === 'completed' || !currentInnings.striker || !currentInnings.nonStriker) {
            // For completed matches or when striker info is missing, show last 2 batsmen who batted
            const batsmenArray = Object.values(currentInnings.allBatsmen)
                .filter(b => b.balls > 0)
                .sort((a, b) => {
                    // Sort by batting order or balls faced
                    return (b.balls || 0) - (a.balls || 0);
                })
                .slice(0, 2);
            
            batsmenArray.forEach(batsman => {
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${batsman.name || 'Unknown'}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${batsman.runs}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${batsman.balls}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${batsman.fours || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${batsman.sixes || 0}</td>
                    </tr>
                `;
            });
        } else {
            // For live matches, show striker and non-striker (always show both even if nonStriker hasn't faced yet)
            const striker = currentInnings.allBatsmen[currentInnings.striker];
            const nonStriker = currentInnings.allBatsmen[currentInnings.nonStriker];
            
            // Always show striker
            if (striker) {
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${striker.name || currentInnings.striker}*</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${striker.runs || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${striker.balls || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${striker.fours || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${striker.sixes || 0}</td>
                    </tr>
                `;
            }
            
            // Always show non-striker (even if they haven't faced a ball yet - show 0s)
            if (nonStriker || currentInnings.nonStriker) {
                const nsName = nonStriker ? (nonStriker.name || currentInnings.nonStriker) : currentInnings.nonStriker;
                const nsRuns = nonStriker ? (nonStriker.runs || 0) : 0;
                const nsBalls = nonStriker ? (nonStriker.balls || 0) : 0;
                const nsFours = nonStriker ? (nonStriker.fours || 0) : 0;
                const nsSixes = nonStriker ? (nonStriker.sixes || 0) : 0;
                
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${nsName}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${nsRuns}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${nsBalls}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${nsFours}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${nsSixes}</td>
                    </tr>
                `;
            }
        }
    }
    
    html += '</table>';
    
    // Bowling table - only show current 2 bowlers - with fixed column widths for alignment - font size 18px
    html += `
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0 10px 0; font-size: 18px; font-family: var(--font-teletext);">
            <tr style="background: var(--teletext-black);">
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 60%;">Bowlers</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">O</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">M</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">R</th>
                <th style="color: var(--teletext-cyan); text-align: left; padding: 4px 4px 4px 0; width: 10%;">W</th>
            </tr>
    `;
    
    // Show bowlers - for completed matches show last 2, for live show current and previous (only if there are 2+)
    if (currentInnings.allBowlers) {
        if (match.status === 'completed' || !currentInnings.currentBowler) {
            // For completed matches or when current bowler info is missing, show last 2 bowlers
            const bowlersArray = Object.values(currentInnings.allBowlers)
                .filter(b => b.balls > 0)
                .sort((a, b) => b.balls - a.balls)
                .slice(0, 2);
            
            bowlersArray.forEach(bowler => {
                const oversStr = Math.floor(bowler.balls / 6) + '.' + (bowler.balls % 6);
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${bowler.name || 'Unknown'}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${oversStr}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${bowler.maidens || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${bowler.runs}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${bowler.wickets}</td>
                    </tr>
                `;
            });
        } else {
            // For live matches, show current bowler
            const currentBowler = currentInnings.allBowlers[currentInnings.currentBowler.name];
            
            if (currentBowler) {
                const oversStr = Math.floor(currentBowler.balls / 6) + '.' + (currentBowler.balls % 6);
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${currentBowler.name || 'Unknown'}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${oversStr}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${currentBowler.maidens || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${currentBowler.runs}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${currentBowler.wickets}</td>
                    </tr>
                `;
            }
            
            // Find previous bowler (not current bowler, sorted by most recent) - only show if there are other bowlers
            const otherBowlers = Object.values(currentInnings.allBowlers)
                .filter(b => b.balls > 0 && b.name !== currentInnings.currentBowler.name)
                .sort((a, b) => b.balls - a.balls);
            
            // Only show previous bowler if there is one (i.e., not in first over)
            if (otherBowlers.length > 0) {
                const prevBowler = otherBowlers[0];
                const oversStr = Math.floor(prevBowler.balls / 6) + '.' + (prevBowler.balls % 6);
                html += `
                    <tr>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${prevBowler.name || 'Unknown'}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${oversStr}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${prevBowler.maidens || 0}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${prevBowler.runs}</td>
                        <td style="color: var(--teletext-white); padding: 4px 4px 4px 0;">${prevBowler.wickets}</td>
                    </tr>
                `;
            }
        }
    }
    
    html += '</table>';
    
    // Recent over at bottom - most recent ball first, proper formatting - font size 18px
    // Show current over if it exists, otherwise show previous completed over
    let overToDisplay = null;
    let overLabel = '';
    
    if (currentInnings.currentOver && currentInnings.currentOver.length > 0) {
        // Show current over in progress
        overToDisplay = currentInnings.currentOver;
        overLabel = `Current over (Over ${currentInnings.overs}):`;
    } else if (currentInnings.previousOver && currentInnings.previousOver.length > 0) {
        // No current over balls yet, show previous completed over
        overToDisplay = currentInnings.previousOver;
        overLabel = `Previous over (Over ${currentInnings.overs - 1}):`;
    }
    
    if (overToDisplay) {
        html += `<div style="color: var(--teletext-cyan); font-size: 18px; margin: 20px 0 5px 0; font-family: var(--font-teletext);">${overLabel}</div>`;
        html += '<div style="color: var(--teletext-cyan); font-size: 18px; margin: 5px 0 10px 0; font-family: var(--font-teletext);">';
        
        // Reverse the order so most recent ball is first
        const ballsReversed = [...overToDisplay].reverse();
        
        ballsReversed.forEach((ball, idx) => {
            if (idx > 0) html += ' ';
            
            let ballDisplay = '';
            
            if (ball.wicket) {
                ballDisplay = 'W';
            } else if (ball.overthrows && ball.overthrows > 0) {
                // Overthrows scenario: "1+4" means 1 run + 4 overthrows = 5 total
                ballDisplay = `${ball.runs}+${ball.overthrows}`;
            } else if (ball.extrasType) {
                // Handle extras based on extrasType: NB, WD, B, LB, PEN
                const extrasType = ball.extrasType.toLowerCase();
                let extrasLabel = '';
                
                if (extrasType === 'nb' || extrasType === 'noball') {
                    extrasLabel = 'NB';
                } else if (extrasType === 'wd' || extrasType === 'wide') {
                    extrasLabel = 'WD';
                } else if (extrasType === 'b' || extrasType === 'bye') {
                    extrasLabel = 'B';
                } else if (extrasType === 'lb' || extrasType === 'legbye') {
                    extrasLabel = 'LB';
                } else if (extrasType === 'pen' || extrasType === 'penalty') {
                    extrasLabel = 'PEN';
                } else {
                    extrasLabel = ball.extrasType.toUpperCase();
                }
                
                if (ball.runs > 0 && ball.extras > 0) {
                    // Runs + extras (e.g., "4+NB" for 4 runs off a no ball)
                    ballDisplay = `${ball.runs}+${extrasLabel}`;
                } else if (ball.extras > 1) {
                    // Multiple extras (e.g., "5WD" for 5 wides)
                    ballDisplay = `${ball.extras}${extrasLabel}`;
                } else if (ball.runs > 0) {
                    // Just runs with extras type (e.g., "4+NB")
                    ballDisplay = `${ball.runs}+${extrasLabel}`;
                } else {
                    // Just the extras label (e.g., "NB" for no ball with 0 runs)
                    ballDisplay = extrasLabel;
                }
            } else if (ball.runs === 4) {
                ballDisplay = '4';
            } else if (ball.runs === 6) {
                ballDisplay = '6';
            } else if (ball.runs > 0) {
                ballDisplay = ball.runs.toString();
            } else {
                ballDisplay = '•';
            }
            
            // Color coding
            let color = 'var(--teletext-white)';
            if (ball.wicket) {
                color = 'var(--teletext-red)';
            } else if (ball.runs === 4 || ball.runs === 6) {
                color = 'var(--teletext-green)';
            }
            
            html += `<span style="color: ${color};">${ballDisplay}</span>`;
        });
        
        html += '</div>';
    }
    
    // Footer with promotion message (like in mockup) - font size 18px
    html += `
        <div style="background: var(--teletext-blue); color: var(--teletext-yellow); padding: 10px; margin-top: 20px; text-align: center; font-size: 18px; font-family: var(--font-teletext);">
            Buy the latest Tailenders merch.<br>Go Well!
        </div>
    `;
    
    // Navigation links at bottom - font size 18px
    html += `
        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 18px; font-family: var(--font-teletext);">
            <span class="page-link" style="color: var(--teletext-red);" onclick="navigatePage(340)">Cricket</span>
            <span class="page-link" style="color: var(--teletext-green);" onclick="navigatePage(${data.series.startPage + 1})">Live</span>
            <span class="page-link" style="color: var(--teletext-yellow);" onclick="navigatePage(${data.series.startPage + 3})">Fixtures</span>
            <span class="page-link" style="color: var(--teletext-cyan);" onclick="navigatePage(${data.series.startPage})">Donate</span>
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
    totalSubpages = match.innings.length * SUBPAGES_PER_INNINGS;
    
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
    }, SUBPAGE_CYCLE_INTERVAL);
}

/**
 * Render specific scorecard subpage
 * Subpage calculation: inningsIndex = floor((subpage - 1) / 2)
 * If subpage is odd (1, 3, 5, 7): show batting
 * If subpage is even (2, 4, 6, 8): show bowling
 */
function renderScorecardSubpage(match, subpage) {
    const inningsIndex = Math.floor((subpage - 1) / SUBPAGES_PER_INNINGS);
    const isBatting = (subpage % SUBPAGES_PER_INNINGS === 1);
    
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
