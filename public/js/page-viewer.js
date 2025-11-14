// Page Viewer JavaScript
let currentPage = 340;
let currentSubpage = 1;
let totalSubpages = 1;
let subpageInterval = null;
let refreshInterval = null;
let isSubpagePaused = false;
let isInitialScorecardLoad = true; // Track if this is the first load of a scorecard

// Batting stats cycling variables
let battingStatsCurrentTeam = 0;
let battingStatsCycleInterval = null;
let battingStatsPaused = false;

// Bowling stats cycling variables
let bowlingStatsCurrentTeam = 0;
let bowlingStatsCycleInterval = null;
let bowlingStatsPaused = false;

// Page registry cache
let activePages = null;

// Constants
const LIVE_REFRESH_INTERVAL = 10000; // 10 seconds
const SUBPAGE_CYCLE_INTERVAL = 5000; // 5 seconds
const SUBPAGES_PER_INNINGS = 2; // Batting and Bowling

/**
 * Fetch and cache the list of active pages
 */
async function getActivePages() {
    if (activePages) return activePages;
    
    try {
        const response = await fetch('/api/accessible-pages');
        if (response.ok) {
            activePages = await response.json();
            return activePages;
        }
    } catch (error) {
        console.error('Error fetching accessible pages:', error);
    }
    
    return [];
}

/**
 * Get page number from URL
 */
function getPageFromURL() {
    const path = window.location.pathname;
    if (path === '/about') {
        return 'about';
    }
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    return page ? parseInt(page) : 340;
}

/**
 * Update URL without page reload
 */
function updateURL(page) {
    const url = new URL(window.location);
    if (page === 'about') {
        window.history.pushState({}, '', '/about');
    } else {
        url.pathname = '/';
        url.searchParams.set('page', page);
        window.history.pushState({}, '', url);
    }
}

/**
 * Update header date and time
 */
function updateHeaderDateTime() {
    const now = new Date();
    // Format: Sat 08 Nov
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const dateStr = `${dayName} ${day} ${month}`;
    
    // Format: 16:51/12
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}/${seconds}`;
    
    const dateElement = document.getElementById('teletest-date');
    const timeElement = document.getElementById('teletest-time');
    
    if (dateElement) dateElement.textContent = dateStr;
    if (timeElement) timeElement.textContent = timeStr;
}

/**
 * Navigate to a specific page
 */
async function navigatePage(target) {
    const pages = await getActivePages();
    
    if (target === 'prev') {
        const currentIndex = pages.indexOf(currentPage);
        if (currentIndex > 0) {
            currentPage = pages[currentIndex - 1];
        } else {
            // Loop to last page
            currentPage = pages[pages.length - 1];
        }
    } else if (target === 'next') {
        const currentIndex = pages.indexOf(currentPage);
        if (currentIndex < pages.length - 1) {
            currentPage = pages[currentIndex + 1];
        } else {
            // Loop back to first page
            currentPage = pages[0];
        }
    } else if (target === 'about') {
        currentPage = 'about';
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
 * Generate footer navigation HTML
 * Note: Footer is now in index.html outside container for proper mobile positioning
 */
function getFooterNavigation() {
    return ''; // Footer is now a fixed element in HTML, not dynamically generated
}

/**
 * Cycle through page numbers with animation
 */
async function cyclePageNumbers(targetPage) {
    const pageDisplay = document.getElementById('page-number-display');
    const brandElement = document.querySelector('.page-header-brand');
    const dateElement = document.getElementById('teletest-date');
    const timeElement = document.getElementById('teletest-time');
    const banner = document.getElementById('main-title-bar');
    
    // Turn header green during cycling
    brandElement.style.color = '#00ff00';
    pageDisplay.style.color = '#00ff00';
    dateElement.style.color = '#00ff00';
    
    let currentNum = 300; // Always start from 300
    
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            currentNum++;
            if (currentNum > 400) {
                currentNum = 300;
            }
            pageDisplay.textContent = currentNum;
            
            if (currentNum === targetPage) {
                clearInterval(interval);
                // Restore original colors
                brandElement.style.color = '';
                pageDisplay.style.color = '';
                dateElement.style.color = '';
                timeElement.style.color = '';
                // Show the banner
                banner.style.visibility = 'visible';
                resolve();
            }
        }, 30); // 30ms per number for smooth but fast cycling
    });
}

/**
 * Load and display page content
 */
async function loadPage(pageNum, preserveSubpage = false, skipAnimation = false) {
    try {
        // Handle About page specially
        if (pageNum === 'about') {
            const response = await fetch('/api/about');
            const data = await response.json();
            
            if (!response.ok) {
                showErrorPage('Failed to load about page');
                return;
            }
            
            renderAboutPage(data);
            return;
        }
        
        // Cycle through page numbers first (unless it's an auto-refresh)
        if (!skipAnimation) {
            await cyclePageNumbers(pageNum);
        }
        
        // Clear any existing intervals
        if (subpageInterval) {
            clearInterval(subpageInterval);
            subpageInterval = null;
        }
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (battingStatsCycleInterval) {
            clearInterval(battingStatsCycleInterval);
            battingStatsCycleInterval = null;
        }
        if (bowlingStatsCycleInterval) {
            clearInterval(bowlingStatsCycleInterval);
            bowlingStatsCycleInterval = null;
        }
        
        currentPage = pageNum;
        if (!preserveSubpage) {
            currentSubpage = 1;
            isInitialScorecardLoad = true; // Reset flag when navigating to a new page
        }
        
        // Update page number display
        document.getElementById('page-number-display').textContent = pageNum;
        
        const response = await fetch(`/api/page-data?page=${pageNum}&_t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        const data = await response.json();
        
        if (!response.ok) {
            showErrorPage(data.error || 'Page not found');
            return;
        }
        
        // Store data globally for keyboard handlers
        window.currentPageData = data;
        
        // Render page based on type
        switch (data.type) {
            case 'homepage':
                renderHomepage(data);
                break;
            case 'news':
                renderNewsPage(data);
                break;
            case 'series-live':
                renderLiveScore(data);
                // Auto-refresh every 10 seconds
                refreshInterval = setInterval(() => loadPage(currentPage, false, true), LIVE_REFRESH_INTERVAL);
                break;
            case 'scorecard':
                renderScorecard(data);
                // Auto-refresh every 10 seconds, preserving current subpage
                refreshInterval = setInterval(() => loadPage(currentPage, true, true), LIVE_REFRESH_INTERVAL);
                break;
            case 'fixtures':
                renderFixtures(data);
                break;
            case 'batting-stats':
                renderBattingStats(data);
                break;
            case 'bowling-stats':
                renderBowlingStats(data);
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
        <div style="text-align: center; padding: 40px;">
            <div class="text-red" style="font-size: 32px;">PAGE NOT FOUND</div>
        </div>
        ${getFooterNavigation()}
    `;
}

/**
 * Render About Page
 */
function renderAboutPage(data) {
    // Show page number as blank or "About"
    document.getElementById('page-number-display').textContent = 'About';
    
    let html = `
        <div class="text-green" style="margin-bottom: 10px; font-weight: normal;">${data.title}</div>
    `;
    
    // Parse content and convert markdown-style links to clickable links
    const paragraphs = data.content.split('\n\n').filter(p => p.trim());
    
    paragraphs.forEach((para, index) => {
        if (para.trim()) {
            // Convert [text](url) format to HTML links
            const linkedText = para.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, 
                '<a href="$2" target="_blank" class="text-cyan" style="text-decoration: underline; cursor: pointer;">$1</a>');
            
            // First paragraph is white, rest are cyan
            const colorClass = index === 0 ? 'text-white' : 'text-cyan';
            html += `<p class="${colorClass}" style="margin-bottom: 15px;">${linkedText}</p>`;
        }
    });
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    
    // Show banner
    const banner = document.getElementById('main-title-bar');
    if (banner) {
        banner.style.visibility = 'visible';
    }
}

/**
 * Render Homepage (Page 340)
 */
async function renderHomepage(data) {
    let html = '';
    
    // Load homepage configuration
    const configResponse = await fetch('/api/homepage');
    const config = await configResponse.json();
    
    // Track first single-link for special styling
    let firstSingleLink = true;
    
    // Render each section based on type
    for (const section of config.sections) {
        if (section.type === 'news-auto') {
            html += await renderNewsAutoSection(data, section);
        } else if (section.type === 'live-auto') {
            html += await renderLiveAutoSection(data, section);
        } else if (section.type === 'header') {
            html += renderHeaderSection(section);
        } else if (section.type === 'links-grid') {
            html += renderLinksGridSection(section);
        } else if (section.type === 'single-link') {
            html += renderSingleLinkSection(section, firstSingleLink);
            firstSingleLink = false; // Only first one gets special styling
        }
    }
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render auto-populated news section
 */
async function renderNewsAutoSection(data, section) {
    let html = '';
    const limit = section.limit || 5;
    
    // Get published news
    const newsItems = data.news?.filter(n => n.published)?.slice(0, limit) || [];
    
    // Add live matches if configured
    if (section.includeLive && data.liveMatches && data.liveMatches.length > 0) {
        data.liveMatches.forEach((match, index) => {
            const currentInnings = match.innings?.[match.innings.length - 1];
            if (currentInnings) {
                const text = `${match.team1} bat in ${match.venue?.split(',')[0] || match.title}`;
                const fontSize = index === 0 && newsItems.length === 0 ? '24px' : '16px';
                html += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="page-link text-cyan" onclick="navigatePage(${match.livePage})" style="font-size: ${fontSize};">${text}</span>
                        <span class="page-link text-white" onclick="navigatePage(${match.livePage})">${match.livePage}</span>
                    </div>
                `;
            }
        });
    }
    
    // Add news items
    newsItems.forEach((newsItem, index) => {
        const isFirst = index === 0 && (!section.includeLive || !data.liveMatches || data.liveMatches.length === 0);
        const fontSize = isFirst ? '24px' : '16px';
        const color = isFirst ? 'text-white' : 'text-cyan';
        html += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span class="page-link ${color}" onclick="navigatePage(${newsItem.page})" style="font-size: ${fontSize};">${newsItem.title}</span>
                <span class="page-link text-white" onclick="navigatePage(${newsItem.page})">${newsItem.page}</span>
            </div>
        `;
    });
    
    return html;
}

/**
 * Render auto-populated live matches section
 */
async function renderLiveAutoSection(data, section) {
    let html = '';
    
    if (data.liveMatches && data.liveMatches.length > 0) {
        data.liveMatches.forEach(match => {
            const currentInnings = match.innings?.[match.innings.length - 1];
            if (currentInnings) {
                const text = `${match.team1} bat in ${match.venue?.split(',')[0] || match.title}`;
                html += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span class="page-link text-cyan" onclick="navigatePage(${match.livePage})">${text}</span>
                        <span class="page-link text-white" onclick="navigatePage(${match.livePage})">${match.livePage}</span>
                    </div>
                `;
            }
        });
    }
    
    return html;
}

/**
 * Render header section
 */
function renderHeaderSection(section) {
    return `<div class="text-white" style="margin-top: 20px;">${section.text}</div>`;
}

/**
 * Render links grid section (2 columns)
 */
function renderLinksGridSection(section) {
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px;">';
    
    (section.links || []).forEach(link => {
        html += `
            <div style="display: flex; justify-content: space-between;">
                <span class="page-link text-cyan" onclick="navigatePage(${link.page})">${link.text}</span>
                <span class="page-link text-white" onclick="navigatePage(${link.page})">${link.page}</span>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

/**
 * Render single link section
 */
function renderSingleLinkSection(section, isFirst = false) {
    const style = isFirst ? 'transform: scaleY(1.4); display: inline-block;' : '';
    const color = isFirst ? 'text-white' : 'text-cyan';
    const marginTop = isFirst ? 'margin-top: 15px; margin-bottom: 10px' : '';
    
    return `
        <div style="display: flex; justify-content: space-between; gap: 20px; ${marginTop}">
            <span class="page-link ${color}" onclick="navigatePage(${section.page})" style="${style}">${section.text}</span>
            <span class="page-link text-white" onclick="navigatePage(${section.page})" style="${style}">${section.page}</span>
        </div>
    `;
}

/**
 * Render News Page
 */
function renderNewsPage(data) {
    const news = data.newsItem;
    
    // Split content by double newlines to get paragraphs
    const paragraphs = news.content.split(/\n\n+/).filter(p => p.trim());
    
    let html = `
        <div class="text-green">${news.title}</div>
    `;
    
    // First paragraph in white, rest in cyan
    paragraphs.forEach((paragraph, index) => {
        const color = index === 0 ? 'text-white' : 'text-cyan';
        html += `<div class="${color}" style="margin-bottom: 15px;">${paragraph}</div>`;
    });
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Live Score - TELETEST Style
 */
function renderLiveScore(data) {
    const match = data.match;
    
    if (!match) {
        document.getElementById('page-content').innerHTML = `
            <span class="text-white">
                NO LIVE MATCH
            </span>
        `;
        return;
    }
    
    // Get day number from match data, or calculate as fallback
    let dayNum = match.day || 1;
    if (!match.day && match.innings && match.innings.length > 0) {
        // Fallback: estimate based on overs
        let totalOvers = 0;
        match.innings.forEach(inn => totalOvers += (inn.overs || 0));
        dayNum = Math.min(5, Math.ceil(totalOvers / 90) || 1);
    }
    
    // Helper function to capitalize first letter of each word
    const capitalizeWords = (str) => {
        return str.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    // Build match header with venue and day
    let html = `
        <div class="live-match-header">
            <span>${match.title.toUpperCase()}, ${capitalizeWords(match.venue || '')} (Day ${dayNum})</span>
            <span class="text-white">1/1</span>
        </div>
    `;
    
    // Show match message if it exists
    if (match.message && match.message.trim()) {
        html += `
            <div class="text-green">
                ${match.message}
            </div>
        `;
    }
    
    // If no innings yet (upcoming match), show empty tables and stop
    if (!match.innings || match.innings.length === 0) {
        html += `
            <div class="text-white">
                Match yet to begin
            </div>
            <table class="live-batting-table">
                <tr class="live-batting-table-header">
                    <th>Batters</th>
                    <th>R</th>
                    <th>B</th>
                    <th>4</th>
                    <th>6</th>
                </tr>
            </table>
            <table class="live-bowling-table">
                <tr class="live-bowling-table-header">
                    <th>Bowlers</th>
                    <th>O</th>
                    <th>M</th>
                    <th>R</th>
                    <th>W</th>
                </tr>
            </table>
        `;
        document.getElementById('page-content').innerHTML = html;
        document.getElementById('subpage-indicator').textContent = '';
        return;
    }
    
    const currentInnings = match.innings[match.innings.length - 1];
    
    // Calculate match situation
    let matchSituation = '';
    
    // Group innings by team and calculate cumulative scores
    // Get team names from match.team1/team2 OR derive from innings data
    let team1 = match.team1;
    let team2 = match.team2;
    
    // If team1/team2 not set, extract from innings
    if (!team1 && match.innings && match.innings.length > 0) {
        team1 = match.innings[0].battingTeam;
        if (match.innings.length > 1 && match.innings[1].battingTeam !== team1) {
            team2 = match.innings[1].battingTeam;
        } else if (match.innings.length > 2) {
            team2 = match.innings[2].battingTeam;
        }
    }
    
    const team1Innings = match.innings.filter(i => i.battingTeam === team1);
    const team2Innings = match.innings.filter(i => i.battingTeam === team2);
    
    // Check for follow-on: innings 2 and 3 have the same batting team
    const isFollowOn = match.innings.length >= 3 && 
                       match.innings[1].battingTeam === match.innings[2].battingTeam;
    const followOnTeam = isFollowOn ? match.innings[2].battingTeam : null;
    
    // ALWAYS display team scores (even if 0-0)
    // Team 1 score
    if (team1) {
        let scoreText = '0-0 (0 ov)'; // Default for no innings
        
        if (team1Innings.length > 0) {
            const firstInns = team1Innings[0];
            const wicketsText = firstInns.wickets >= 10 ? '' : `-${firstInns.wickets}`;
            const decText = firstInns.declared ? 'd' : '';
            const isCurrentFirst = firstInns === currentInnings;
            scoreText = isCurrentFirst ? `${firstInns.runs}${wicketsText}${decText} (${firstInns.overs}.${firstInns.balls} ov)` : `${firstInns.runs}${wicketsText}${decText}`;
            
            if (team1Innings.length > 1) {
                const secondInns = team1Innings[1];
                const decText = secondInns.declared ? 'd' : '';
                const wicketsText2 = secondInns.wickets >= 10 ? '' : `-${secondInns.wickets}`;
                // Only show overs for ongoing innings (current innings)
                const isCurrentInnings = secondInns === currentInnings;
                const foText = (isFollowOn && followOnTeam === team1) ? ' fo' : '';
                const oversText = isCurrentInnings ? ` (${secondInns.overs}.${secondInns.balls} ov)` : '';
                scoreText += ` & ${secondInns.runs}${wicketsText2}${decText}${foText}${oversText}`;
            }
        }
        
        html += `
            <span class="text-yellow">
                ${capitalizeWords(team1)}: ${scoreText}
            </span>
        `;
    }
    
    // Team 2 score
    if (team2) {
        let scoreText = '0-0 (0 ov)'; // Default for no innings
        
        if (team2Innings.length > 0) {
            const firstInns = team2Innings[0];
            const wicketsText = firstInns.wickets >= 10 ? '' : `-${firstInns.wickets}`;
            const decText = firstInns.declared ? 'd' : '';
            const isCurrentFirst = firstInns === currentInnings;
            scoreText = isCurrentFirst ? `${firstInns.runs}${wicketsText}${decText} (${firstInns.overs}.${firstInns.balls} ov)` : `${firstInns.runs}${wicketsText}${decText}`;
            
            if (team2Innings.length > 1) {
                const secondInns = team2Innings[1];
                const decText = secondInns.declared ? 'd' : '';
                const wicketsText2 = secondInns.wickets >= 10 ? '' : `-${secondInns.wickets}`;
                // Only show overs for ongoing innings (current innings)
                const isCurrentInnings = secondInns === currentInnings;
                const foText = (isFollowOn && followOnTeam === team2) ? ' fo' : '';
                const oversText = isCurrentInnings ? ` (${secondInns.overs}.${secondInns.balls} ov)` : '';
                scoreText += ` & ${secondInns.runs}${wicketsText2}${decText}${foText}${oversText}`;
            }
        }
        
        html += `
            <div class="text-yellow">
                ${capitalizeWords(team2)}: ${scoreText}
            </div>
        `;
    }
    
    // Match situation (lead/trail/chase) - sentence case
    const team1Total = team1Innings.reduce((sum, i) => sum + i.runs, 0);
    const team2Total = team2Innings.reduce((sum, i) => sum + i.runs, 0);
    
    // Check if match is completed and show result
    if (match.status === 'completed' && match.result) {
        // Show the match result
        const result = match.result;
        const winnerName = capitalizeWords(result.winner);
        
        if (result.winType === 'innings') {
            matchSituation = `${winnerName} won by an innings and ${result.margin} runs`;
        } else if (result.winType === 'runs') {
            matchSituation = `${winnerName} won by ${result.margin} runs`;
        } else if (result.winType === 'wickets') {
            matchSituation = `${winnerName} won by ${result.margin} wickets`;
        } else if (result.winType === 'tie') {
            matchSituation = 'Match tied';
        }
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
        // Third innings
        if (isFollowOn) {
            // Follow-on: Team batting second innings is still trailing
            // Need to compare their combined score vs opponent's first innings
            const followOnTeamTotal = followOnTeam === team1 ? team1Total : team2Total;
            const opponentTeam = followOnTeam === team1 ? team2 : team1;
            const opponentTotal = followOnTeam === team1 ? team2Total : team1Total;
            
            const deficit = opponentTotal - followOnTeamTotal;
            if (deficit > 0) {
                matchSituation = `${capitalizeWords(followOnTeam)} trail by ${deficit} runs`;
            } else if (deficit < 0) {
                matchSituation = `${capitalizeWords(followOnTeam)} lead by ${Math.abs(deficit)} runs`;
            }
        } else {
            // Normal third innings - show lead
            const lead = team1Total - team2Total;
            if (lead > 0 && currentInnings.battingTeam === team1) {
                matchSituation = `${capitalizeWords(team1)} lead by ${lead} runs`;
            } else if (lead < 0 && currentInnings.battingTeam === team2) {
                matchSituation = `${capitalizeWords(team2)} lead by ${Math.abs(lead)} runs`;
            }
        }
    }
    
    if (matchSituation) {
        html += `
            <span class="text-yellow">
                ${matchSituation}
            </span>
        `;
    }
    
    // Calculate innings number for this team (1st or 2nd)
    const teamInningsCount = match.innings.filter(i => i.battingTeam === currentInnings.battingTeam).length;
    const teamInningsOrdinal = teamInningsCount === 1 ? '1st' : '2nd';
    
    // Section header for current innings
    html += `
        <div class="text-white">
            ${currentInnings.battingTeam.toUpperCase()}, ${teamInningsOrdinal} Inns:
        </div>
    `;
    
    // Batting table - only show current 2 batsmen
    html += `
        <table class="live-batting-table">
            <tr class="live-batting-table-header">
                <th>Batters</th>
                <th>R</th>
                <th>B</th>
                <th>4</th>
                <th>6</th>
            </tr>
    `;
    
    // Show batsmen - for completed matches show last 2, for live show striker and non-striker
    if (currentInnings.allBatsmen) {
        if (match.status === 'completed' || !currentInnings.striker || !currentInnings.nonStriker || currentInnings.wickets >= 10) {
            // For completed matches, all out, or when striker info is missing, show only batsmen who are genuinely not out
            // Exclude anyone who has a "howOut" field (dismissed) or status is explicitly "out"
            const batsmenArray = Object.entries(currentInnings.allBatsmen)
                .map(([name, stats]) => ({ name, ...stats }))
                .filter(b => (b.status === 'not out' || b.status === 'batting') && !b.howOut)
                .sort((a, b) => {
                    // Sort by balls faced (descending)
                    return (b.balls || 0) - (a.balls || 0);
                })
                .slice(0, 2);
            
            batsmenArray.forEach(batsman => {
                html += `
                    <tr>
                        <td>${batsman.name || 'Unknown'}</td>
                        <td>${batsman.runs}</td>
                        <td>${batsman.balls}</td>
                        <td>${batsman.fours || 0}</td>
                        <td>${batsman.sixes || 0}</td>
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
                        <td>${striker.name || currentInnings.striker}*</td>
                        <td>${striker.runs || 0}</td>
                        <td>${striker.balls || 0}</td>
                        <td>${striker.fours || 0}</td>
                        <td>${striker.sixes || 0}</td>
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
                        <td>${nsName}</td>
                        <td>${nsRuns}</td>
                        <td>${nsBalls}</td>
                        <td>${nsFours}</td>
                        <td>${nsSixes}</td>
                    </tr>
                `;
            }
        }
    }
    
    html += '</table>';
    
    // Bowling table - only show current 2 bowlers
    html += `
        <table class="live-bowling-table">
            <tr class="live-bowling-table-header">
                <th>Bowlers</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
            </tr>
    `;
    
    // Show bowlers - organized by bowling end (End A vs End B)
    if (currentInnings.allBowlers) {
        // Track bowlers by END (A or B)
        let endA = null;
        let endB = null;
        
        const balls = currentInnings.balls || 0;
        
        // First, populate from lastBowlerAtEnd if available
        if (currentInnings.lastBowlerAtEnd) {
            if (currentInnings.lastBowlerAtEnd['End A']) {
                const bowlerName = currentInnings.lastBowlerAtEnd['End A'];
                const stats = currentInnings.allBowlers[bowlerName];
                if (stats) {
                    endA = {
                        name: bowlerName,
                        balls: stats.balls || 0,
                        runs: stats.runs || 0,
                        wickets: stats.wickets || 0,
                        maidens: stats.maidens || 0
                    };
                }
            }
            
            if (currentInnings.lastBowlerAtEnd['End B']) {
                const bowlerName = currentInnings.lastBowlerAtEnd['End B'];
                const stats = currentInnings.allBowlers[bowlerName];
                if (stats) {
                    endB = {
                        name: bowlerName,
                        balls: stats.balls || 0,
                        runs: stats.runs || 0,
                        wickets: stats.wickets || 0,
                        maidens: stats.maidens || 0
                    };
                }
            }
        }
        
        // If currently bowling (balls > 0), update the current end with current bowler
        if (balls > 0 && currentInnings.currentBowler && currentInnings.currentBowler.name && currentInnings.currentEnd) {
            const currentBowlerName = currentInnings.currentBowler.name;
            const stats = currentInnings.allBowlers[currentBowlerName];
            
            if (stats) {
                const bowlerData = {
                    name: currentBowlerName,
                    balls: stats.balls || 0,
                    runs: stats.runs || 0,
                    wickets: stats.wickets || 0,
                    maidens: stats.maidens || 0
                };
                
                if (currentInnings.currentEnd === 'End A') {
                    endA = bowlerData;
                } else {
                    endB = bowlerData;
                }
            }
        }
        
        // Fallback if we don't have lastBowlerAtEnd yet (backward compatibility)
        if (!currentInnings.lastBowlerAtEnd) {
            if (currentInnings.lastCompletedOver && currentInnings.lastCompletedOver.bowler) {
                const lastBowlerName = currentInnings.lastCompletedOver.bowler;
                const lastEnd = currentInnings.lastCompletedOver.end;
                const stats = currentInnings.allBowlers[lastBowlerName];
                
                if (stats) {
                    const bowlerData = {
                        name: lastBowlerName,
                        balls: stats.balls || 0,
                        runs: stats.runs || 0,
                        wickets: stats.wickets || 0,
                        maidens: stats.maidens || 0
                    };
                    
                    if (lastEnd === 'End A') {
                        endA = bowlerData;
                    } else if (lastEnd === 'End B') {
                        endB = bowlerData;
                    }
                }
            }
            
            // Find the other active bowler
            if ((!endA || !endB) && Object.keys(currentInnings.allBowlers).length >= 2) {
                const knownBowler = endA?.name || endB?.name;
                
                // Find bowler with most balls (likely the other active bowler)
                let bestCandidate = null;
                let maxBalls = 0;
                
                for (const [name, stats] of Object.entries(currentInnings.allBowlers)) {
                    if (name !== knownBowler && stats.balls > maxBalls) {
                        bestCandidate = {
                            name: name,
                            balls: stats.balls || 0,
                            runs: stats.runs || 0,
                            wickets: stats.wickets || 0,
                            maidens: stats.maidens || 0
                        };
                        maxBalls = stats.balls;
                    }
                }
                
                if (bestCandidate) {
                    if (!endA) {
                        endA = bestCandidate;
                    } else if (!endB) {
                        endB = bestCandidate;
                    }
                }
            }
        }
        
        // Display bowlers (End A first, then End B)
        [endA, endB].forEach(bowler => {
            if (bowler) {
                const balls = bowler.balls % 6;
                const oversStr = Math.floor(bowler.balls / 6) + (balls > 0 ? '.' + balls : '');
                html += `
                    <tr>
                        <td>${bowler.name}</td>
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
    
    // Recent over at bottom - most recent ball first, proper formatting
    // Show current over if it exists, otherwise show previous completed over
    let overToDisplay = null;
    let overLabel = '';
    
    if (currentInnings.currentOver && currentInnings.currentOver.length > 0) {
        // Show current over in progress
        overToDisplay = currentInnings.currentOver;
        // Add 1 to overs because currentInnings.overs is 0-indexed (first over shows as 0, should be 1)
        overLabel = `Current over (Over ${currentInnings.overs + 1}):`;
    } else if (currentInnings.previousOver && currentInnings.previousOver.length > 0) {
        // No current over balls yet, show previous completed over
        overToDisplay = currentInnings.previousOver;
        overLabel = `Previous over (Over ${currentInnings.overs}):`;
    }
    
    if (overToDisplay) {
        html += `<div class="text-cyan">${overLabel}</div>`;
        html += '<div class="text-cyan">';
        
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
            } else if (ball.extraType) {
                // Handle extras based on extrasType: NB, WD, B, LB, PEN
                // Use toUpperCase for case-insensitive comparison
                const extrasType = (ball.extraType || '').toUpperCase();
                let extrasLabel = '';
                
                if (extrasType === 'NB' || extrasType === 'NOBALL') {
                    extrasLabel = 'NB';
                } else if (extrasType === 'WD' || extrasType === 'WIDE') {
                    extrasLabel = 'WD';
                } else if (extrasType === 'B' || extrasType === 'BYE') {
                    extrasLabel = 'B';
                } else if (extrasType === 'LB' || extrasType === 'LEGBYE') {
                    extrasLabel = 'LB';
                } else if (extrasType === 'PEN' || extrasType === 'PENALTY') {
                    extrasLabel = 'PEN';
                } else {
                    extrasLabel = extrasType; // fallback - already uppercase
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
            
            // Color coding with CSS classes
            let colorClass = 'text-white';
            if (ball.wicket) {
                colorClass = 'text-red';
            } else if (ball.runs === 4 || ball.runs === 6) {
                colorClass = 'text-green';
            }
            
            html += `<span class="${colorClass}">${ballDisplay}</span>`;
        });
        
        html += '</div>';
    }
    
    html += getFooterNavigation();
    
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
            <div class="text-white" style="text-align: center; padding: 40px;">
                NO MATCH DATA
            </div>
        `;
        return;
    }
    
    // Calculate total subpages (2 per innings: batting and bowling)
    totalSubpages = match.innings.length * SUBPAGES_PER_INNINGS;
    
    // If this is the initial load, decide which innings to show
    if (isInitialScorecardLoad && currentSubpage === 1) {
        if (match.status === 'live') {
            // For live matches, jump to the current (most recent) innings
            const lastInningsIndex = match.innings.length - 1;
            currentSubpage = (lastInningsIndex * SUBPAGES_PER_INNINGS) + 1;
        } else {
            // For completed matches, stay on first innings (subpage 1)
            currentSubpage = 1;
        }
        isInitialScorecardLoad = false; // Mark that we've done the initial jump
    }
    
    // Render current subpage
    renderScorecardSubpage(match, currentSubpage);
    
    // Start auto-cycling subpages (unless paused)
    startSubpageCycling();
}

/**
 * Toggle pause/play for subpage cycling
 */
function toggleSubpagePause() {
    isSubpagePaused = !isSubpagePaused;
    const btn = document.getElementById('pauseBtn');
    if (btn) {
        if (isSubpagePaused) {
            btn.classList.remove('text-magenta');
            btn.classList.add('text-green');
        } else {
            btn.classList.remove('text-green');
            btn.classList.add('text-magenta');
        }
    }
    
    if (isSubpagePaused) {
        // Clear the interval when paused
        if (subpageInterval) {
            clearInterval(subpageInterval);
            subpageInterval = null;
        }
    } else {
        // Resume cycling when unpaused
        startSubpageCycling();
    }
}

/**
 * Navigate to next subpage
 */
function nextSubpage() {
    currentSubpage++;
    if (currentSubpage > totalSubpages) {
        currentSubpage = 1;
    }
    
    // Fetch current match data and re-render
    fetch(`/api/page-data?page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
            if (data.type === 'scorecard' && data.match) {
                renderScorecardSubpage(data.match, currentSubpage);
            }
        })
        .catch(error => console.error('Error fetching page data:', error));
}

/**
 * Navigate to previous subpage
 */
function previousSubpage() {
    currentSubpage--;
    if (currentSubpage < 1) {
        currentSubpage = totalSubpages;
    }
    
    // Fetch current match data and re-render
    fetch(`/api/page-data?page=${currentPage}`)
        .then(response => response.json())
        .then(data => {
            if (data.type === 'scorecard' && data.match) {
                renderScorecardSubpage(data.match, currentSubpage);
            }
        })
        .catch(error => console.error('Error fetching page data:', error));
}

/**
 * Start subpage cycling interval
 */
function startSubpageCycling() {
    if (subpageInterval) {
        clearInterval(subpageInterval);
    }
    
    subpageInterval = setInterval(() => {
        if (!isSubpagePaused) {
            currentSubpage++;
            if (currentSubpage > totalSubpages) {
                currentSubpage = 1;
            }
            
            // Fetch current match data and re-render
            fetch(`/api/page-data?page=${currentPage}`)
                .then(response => response.json())
                .then(data => {
                    if (data.type === 'scorecard' && data.match) {
                        renderScorecardSubpage(data.match, currentSubpage);
                    }
                })
                .catch(error => console.error('Error fetching page data:', error));
        }
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
    
    // Helper function to capitalize first letter of each word
    const capitalizeWords = (str) => {
        return str.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    };
    
    // Helper function to abbreviate long names (Teletext style)
    // Only abbreviate on mobile (screen width < 768px)
    const abbreviateName = (name) => {
        if (!name || name.length < 8) return name;
        if (window.innerWidth >= 768) return name; // Don't abbreviate on desktop
        
        // Split by spaces to handle multi-part names
        const parts = name.split(' ');
        
        if (parts.length > 1) {
            // Multi-part name: abbreviate each part if needed
            return parts.map(part => {
                if (part.length < 8) return part; // Keep short parts
                // Long part: use first letter + apostrophe + last 4 chars
                return `${part[0]}'${part.slice(-4)}`;
            }).join(' ');
        } else {
            // Single name ≥8 chars: first letter + apostrophe + last 4 chars
            return `${name[0]}'${name.slice(-4)}`;
        }
    };
    
    // Calculate innings ordinal (1st or 2nd)
    // Count only innings up to and including the current one
    const teamInningsCount = match.innings.slice(0, inningsIndex + 1).filter(i => i.battingTeam === innings.battingTeam).length;
    const inningsOrdinal = teamInningsCount === 1 ? '1st' : '2nd';
    
    // Check if this is a follow-on innings
    const isFollowOn = match.innings.length >= 3 && 
                       match.innings[1].battingTeam === match.innings[2].battingTeam;
    const followOnTeam = isFollowOn ? match.innings[2].battingTeam : null;
    const showFollowOn = isFollowOn && followOnTeam === innings.battingTeam && teamInningsCount === 2;
    
    // Header with match title, venue, and subpage indicator
    let html = `
        <div class="live-match-header">
            <span class="text-green">${match.title.toUpperCase()}, ${capitalizeWords(match.venue || '')}</span>
            <span style="display: inline-flex; align-items: center; gap: 10px;">
                <span onclick="previousSubpage()" class="text-magenta" style="cursor: pointer;">◄</span>
                <span onclick="toggleSubpagePause()" id="pauseBtn" class="${isSubpagePaused ? 'text-green' : 'text-magenta'}" style="cursor: pointer;">||</span>
                <span onclick="nextSubpage()" class="text-magenta" style="cursor: pointer; margin-right: 5px;">►</span>
                <span class="text-white">${subpage}/${totalSubpages}</span>
            </span>
        </div>
    `;
    
    // Add match result for completed matches
    if (match.status === 'completed') {
        // Format result from result object
        let resultText = '';
        if (match.result && typeof match.result === 'object') {
            if (match.result.winType === 'draw') {
                resultText = 'Match drawn';
            } else if (match.result.winner) {
                const winner = match.result.winner;
                const winType = match.result.winType;
                const margin = match.result.margin;
                
                if (winType === 'innings') {
                    resultText = `${winner} won by an innings and ${margin} runs`;
                } else if (winType === 'runs') {
                    resultText = `${winner} won by ${margin} runs`;
                } else if (winType === 'wickets') {
                    resultText = `${winner} won by ${margin} wickets`;
                } else if (margin) {
                    resultText = `${winner} won by ${margin}`;
                } else {
                    resultText = `${winner} won`;
                }
            }
        }
        
        if (resultText) {
            html += `
                <div class="text-yellow" style="margin-bottom: 5px;">
                    ${resultText}
                </div>
            `;
        }
    }
    
    html += `
        <div class="text-white" style="margin-bottom: 0px;">
            ${innings.battingTeam.toUpperCase()}, ${inningsOrdinal} Inns${showFollowOn ? ' (fo)' : ''}:
        </div>
    `;
    
    if (isBatting) {
        // Show batting card as a table
        html += '<table class="stats-table" style="width: 100%;">';
        
        if (innings.allBatsmen) {
            // Get all batsmen who have batted (balls > 0 or status !== 'not batted')
            const batsmenArray = Object.entries(innings.allBatsmen)
                .map(([name, stats]) => ({ name, ...stats }))
                .filter(b => b.balls > 0 || b.status !== 'not batted');
            
            batsmenArray.forEach(batsman => {
                // Check if batsman returned after being retired hurt
                // If howOut is 'retired hurt' but status is not 'out', they've returned to batting
                const returnedFromRetiredHurt = batsman.howOut === 'retired hurt' && batsman.status !== 'out';
                const isNotOut = (batsman.status === 'not out' || batsman.status === 'batting') && (!batsman.howOut || returnedFromRetiredHurt);
                const rowClass = isNotOut ? 'text-white' : 'text-cyan';
                
                // Format dismissal info - combine type and fielder in one column
                let dismissalInfo = '';
                
                if (batsman.howOut && !returnedFromRetiredHurt) {
                    const howOut = batsman.howOut;
                    
                    // Get fielder from the dismissal ball
                    let fielder = '';
                    if (innings.allBalls) {
                        const dismissalBall = innings.allBalls.find(b => 
                            b.wicket && b.dismissedBatsman === batsman.name
                        );
                        if (dismissalBall && dismissalBall.fielder) {
                            fielder = dismissalBall.fielder;
                        }
                    }
                    
                    if (howOut === 'bowled') {
                        dismissalInfo = '';
                    } else if (howOut === 'caught') {
                        dismissalInfo = fielder ? `c ${abbreviateName(fielder)}` : 'c';
                    } else if (howOut === 'lbw') {
                        dismissalInfo = 'lbw';
                    } else if (howOut === 'stumped') {
                        dismissalInfo = fielder ? `st ${abbreviateName(fielder)}` : 'st';
                    } else if (howOut === 'run out') {
                        dismissalInfo = 'run out';
                    } else if (howOut === 'caught and bowled') {
                        dismissalInfo = 'c & ';
                    } else if (howOut === 'hit wicket') {
                        dismissalInfo = 'hit wkt';
                    } else if (howOut === 'retired hurt') {
                        dismissalInfo = window.innerWidth < 768 ? 'r hurt' : 'retired hurt';
                    } else {
                        dismissalInfo = howOut;
                    }
                } else if (isNotOut) {
                    dismissalInfo = 'not out';
                }
                
                // Get bowler name from the dismissal ball
                let bowlerName = '';
                if (batsman.howOut && innings.allBalls) {
                    const dismissalBall = innings.allBalls.find(b => 
                        b.wicket && b.dismissedBatsman === batsman.name
                    );
                    if (batsman.howOut === 'run out') {
                        // For run out, show fielder in bowler column
                        if (dismissalBall && dismissalBall.fielder) {
                            bowlerName = `(${abbreviateName(dismissalBall.fielder)})`;
                        }
                    } else {
                        if (dismissalBall && dismissalBall.bowler) {
                            bowlerName = `b ${abbreviateName(dismissalBall.bowler)}`;
                        }
                    }
                }
                
                html += `
                    <tr class="${rowClass}">
                        <td style="width: 27%;">${abbreviateName(batsman.name)}</td>
                        <td style="width: 27%; text-align: left;">${dismissalInfo}</td>
                        <td style="width: 26%; text-align: left;">${bowlerName}</td>
                        <td style="width: 20%; text-align: right;">${batsman.runs}(${batsman.balls})</td>
                    </tr>
                `;
            });
        }
        
        // Calculate extras from all balls
        let extras = 0;
        if (innings.allBalls) {
            innings.allBalls.forEach(ball => {
                extras += (ball.extras || 0) + (ball.secondExtras || 0);
            });
        }
        
        html += `
            <tr class="text-cyan">
                <td colspan="2"></td>
                <td style="text-align: left;">Extras</td>
                <td style="text-align: right;">${extras}</td>
            </tr>
        `;
        
        // Total row
        const totalOversStr = innings.overs + (innings.balls > 0 ? '.' + innings.balls : '');
        const decSuffix = innings.declared ? ' dec' : '';
        const isMobile = window.innerWidth < 768;
        let wicketsStr;
        if (innings.wickets >= 10) {
            wicketsStr = 'all out';
        } else if (isMobile) {
            // Mobile: "for 3 dec" instead of "for 3 wkts dec"
            wicketsStr = `for ${innings.wickets}${decSuffix}`;
        } else {
            // Desktop: "for 3 wkts dec"
            wicketsStr = `for ${innings.wickets} wkt${innings.wickets === 1 ? '' : 's'}${decSuffix}`;
        }
        const oversLabel = isMobile ? 'ov' : 'ovs';
        html += `
            <tr class="text-white">
                <td colspan="3">TOTAL (${wicketsStr}, ${totalOversStr} ${oversLabel})</td>
                <td style="text-align: right;">${innings.runs}</td>
            </tr>
        `;
        
        html += '</table>';
        
        // Fall of wickets
        if (innings.fallOfWickets && innings.fallOfWickets.length > 0) {
            const fowText = innings.fallOfWickets
                .map((fow, idx) => `${idx + 1}-${fow.runs}`)
                .join(' ');
            html += `
                <div class="text-white" style="margin-top: 10px;">
                    Fall: ${fowText}
                </div>
            `;
        }
        
    } else {
        // Show bowling card
        html += '<table class="stats-table" style="width: 100%;">';
        
        // Header row
        html += `
            <tr class="text-white">
                <th style="width: 40%; text-align: left; font-weight: normal;">BOWLER</th>
                <th style="width: 15%; text-align: right; font-weight: normal;">O</th>
                <th style="width: 15%; text-align: right; font-weight: normal;">M</th>
                <th style="width: 15%; text-align: right; font-weight: normal;">R</th>
                <th style="width: 15%; text-align: right; font-weight: normal;">W</th>
            </tr>
        `;
        
        if (innings.allBowlers) {
            Object.values(innings.allBowlers).forEach(bowler => {
                if (bowler.balls > 0) {
                    const balls = bowler.balls % 6;
                    const oversStr = bowler.overs + (balls > 0 ? '.' + balls : '');
                    html += `
                        <tr class="text-cyan">
                            <td style="width: 40%;">${bowler.name || 'Unknown'}</td>
                            <td style="width: 15%; text-align: right;">${oversStr}</td>
                            <td style="width: 15%; text-align: right;">${bowler.maidens}</td>
                            <td style="width: 15%; text-align: right;">${bowler.runs}</td>
                            <td style="width: 15%; text-align: right;">${bowler.wickets}</td>
                        </tr>
                    `;
                }
            });
        }
        
        html += '</table>';
        
        // Total row
        const totalOversStr = innings.overs + (innings.balls > 0 ? '.' + innings.balls : '');
        const decSuffix = innings.declared ? ' dec' : '';
        const isMobile = window.innerWidth < 768;
        let wicketsStr;
        if (innings.wickets >= 10) {
            wicketsStr = 'all out';
        } else if (isMobile) {
            // Mobile: "for 3 dec" instead of "for 3 wkts dec"
            wicketsStr = `for ${innings.wickets}${decSuffix}`;
        } else {
            // Desktop: "for 3 wkts dec"
            wicketsStr = `for ${innings.wickets} wkt${innings.wickets === 1 ? '' : 's'}${decSuffix}`;
        }
        const oversLabel = isMobile ? 'ov' : 'ovs';
        html += `
            <div class="text-white" style="margin-top: 10px; display: flex; justify-content: space-between;">
                <span>TOTAL (${wicketsStr}, ${totalOversStr} ${oversLabel})</span>
                <span>${innings.runs}</span>
            </div>
        `;
        
        // Fall of wickets
        if (innings.fallOfWickets && innings.fallOfWickets.length > 0) {
            const fowText = innings.fallOfWickets
                .map((fow, idx) => `${idx + 1}-${fow.runs}`)
                .join(' ');
            html += `
                <div class="text-white" style="margin-top: 10px;">
                    Fall: ${fowText}
                </div>
            `;
        }
    }
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Fixtures page
 */
async function renderFixtures(data) {
    const series = data.series;
    
    // Helper function to format date as "Mon 10 Nov"
    function formatMatchDate(dateStr) {
        if (!dateStr) return 'Date TBC';
        const date = new Date(dateStr);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
    }
    
    // Helper function to determine text color based on result
    function getMatchColor(match, series) {
        if (match.status !== 'completed' || !match.result) {
            return 'text-white'; // Upcoming or live
        }
        
        // Check if it's a draw
        if (match.result.toLowerCase().includes('drawn')) {
            return 'text-white';
        }
        
        // Check who won
        if (match.result.toLowerCase().includes(series.team1.toLowerCase())) {
            return 'text-cyan'; // Team 1 (England) wins
        } else if (match.result.toLowerCase().includes(series.team2.toLowerCase())) {
            return 'text-yellow'; // Team 2 (Australia) wins
        }
        
        return 'text-white'; // Default
    }
    
    let html = `
        <div class="live-match-header">
            <span class="text-green">${series.name} - Fixtures</span>
            <span class="text-white">1/1</span>
        </div>
        <div style="margin-top: 10px;"></div>
    `;
    
    // Fetch live match data if needed
    const liveMatches = series.matches.filter(m => m.status === 'live');
    const liveMatchData = {};
    
    for (const match of liveMatches) {
        try {
            const response = await fetch(`/api/series/${series.id || data.series.matches[0].id.split('-match-')[0]}/match/${match.id}`);
            if (response.ok) {
                liveMatchData[match.id] = await response.json();
            }
        } catch (error) {
            console.error('Error fetching live match data:', error);
        }
    }
    
    series.matches.forEach((match, index) => {
        const textColor = getMatchColor(match, series);
        const formattedDate = formatMatchDate(match.date);
        const startTime = match.startTime || '00:00 GMT';
        const livePrefix = match.status === 'live' ? 'LIVE - ' : '';
        
        // Determine if match should be clickable and which page
        let clickableClass = '';
        let onClickAttr = '';
        if (match.status === 'live') {
            // Live match goes to live score page (startPage + 0)
            clickableClass = 'page-link';
            onClickAttr = `onclick="navigatePage(${series.startPage})"`;
        } else if (match.status !== 'upcoming') {
            // Completed match goes to match scorecard page (startPage + 3 + match index)
            const matchScorecardPage = series.startPage + 3 + index;
            clickableClass = 'page-link';
            onClickAttr = `onclick="navigatePage(${matchScorecardPage})"`;
        }
        
        html += `
            <div class="${textColor}">
                <span class="${clickableClass}" ${onClickAttr}>${livePrefix}${match.title}, ${match.venue || 'Venue TBC'}</span>
            </div>
            <div class="${textColor}">
                <span class="${clickableClass}" ${onClickAttr}>${formattedDate} ${startTime}</span>
            </div>
        `;
        
        // Show live score for live matches
        if (match.status === 'live' && liveMatchData[match.id]) {
            const liveMatch = liveMatchData[match.id];
            if (liveMatch.innings && liveMatch.innings.length > 0) {
                const currentInnings = liveMatch.innings[liveMatch.innings.length - 1];
                const inningsLabel = currentInnings.number === 1 ? '1st Inns' : 
                                   currentInnings.number === 2 ? '2nd Inns' :
                                   currentInnings.number === 3 ? '3rd Inns' : '4th Inns';
                html += `<div class="${textColor}"><span class="${clickableClass}" ${onClickAttr}>${currentInnings.battingTeam}: ${currentInnings.runs}-${currentInnings.wickets} (${inningsLabel})</span></div>`;
            }
        }
        
        // Show result for completed matches
        if (match.result) {
            html += `<div class="${textColor}"><span class="${clickableClass}" ${onClickAttr}>${match.result}</span></div>`;
        }
        
        // Add line break between fixtures (but not after the last one)
        if (index < series.matches.length - 1) {
            html += `<div style="margin-top: 15px;"></div>`;
        }
    });
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Batting Stats page with team cycling
 */
function renderBattingStats(data) {
    const series = data.series;
    window.currentPageData = data;
    
    // Reset to team 0 when loading the page
    battingStatsCurrentTeam = 0;
    battingStatsPaused = false;
    
    // Clear any existing intervals
    if (battingStatsCycleInterval) {
        clearInterval(battingStatsCycleInterval);
        battingStatsCycleInterval = null;
    }
    
    // Render first team
    renderBattingStatsTeam(data, battingStatsCurrentTeam);
    
    // Start auto-cycling
    battingStatsCycleInterval = setInterval(() => {
        if (window.currentPageData && window.currentPageData.type === 'batting-stats') {
            const teams = [window.currentPageData.series.team1, window.currentPageData.series.team2];
            if (!battingStatsPaused) {
                battingStatsCurrentTeam = (battingStatsCurrentTeam + 1) % teams.length;
                renderBattingStatsTeam(window.currentPageData, battingStatsCurrentTeam);
            }
        }
    }, 5000);
    
    // Add keyboard event listener
    document.removeEventListener('keydown', handleBattingStatsKeyPress);
    document.addEventListener('keydown', handleBattingStatsKeyPress);
}

function handleBattingStatsKeyPress(e) {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    
    if (e.key === ' ') {
        e.preventDefault();
        battingStatsPaused = !battingStatsPaused;
        renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        battingStatsPaused = true;
        battingStatsCurrentTeam = (battingStatsCurrentTeam + 1) % teams.length;
        renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        battingStatsPaused = true;
        battingStatsCurrentTeam = (battingStatsCurrentTeam - 1 + teams.length) % teams.length;
        renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
    }
}

function toggleBattingStatsPause() {
    battingStatsPaused = !battingStatsPaused;
    const currentData = window.currentPageData;
    if (currentData) {
        renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
    }
}

function skipBattingStatsForward() {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    battingStatsPaused = true;
    battingStatsCurrentTeam = (battingStatsCurrentTeam + 1) % teams.length;
    renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
}

function skipBattingStatsBackward() {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    battingStatsPaused = true;
    battingStatsCurrentTeam = (battingStatsCurrentTeam - 1 + teams.length) % teams.length;
    renderBattingStatsTeam(currentData, battingStatsCurrentTeam);
}

function renderBattingStatsTeam(data, teamIndex) {
    const series = data.series;
    const batsmen = data.batsmen || [];
    const teams = [series.team1, series.team2];
    const currentTeam = teams[teamIndex];
    
    // Filter batsmen for current team
    const teamBatsmen = batsmen.filter(b => b.team === currentTeam);
    
    let html = `
        <div class="live-match-header">
            <span class="text-green">Runs - ${currentTeam}</span>
            <span class="text-white">
                <span onclick="skipBattingStatsBackward()" class="text-magenta" style="cursor: pointer;">◄</span>
                <span onclick="toggleBattingStatsPause()" id="batting-pause-btn" class="${battingStatsPaused ? 'text-green' : 'text-magenta'}" style="cursor: pointer;">||</span>
                <span onclick="skipBattingStatsForward()" class="text-magenta" style="cursor: pointer; margin-right: 5px;">►</span>
                ${teamIndex + 1}/${teams.length}
            </span>
        </div>
        <div style="margin-top: 10px;"></div>
    `;
    
    if (teamBatsmen.length > 0) {
        html += '<table class="stats-table batting-stats">';
        html += '<tr class="text-cyan"><th>Player</th><th>R</th><th>Avg</th><th>HS</th><th>100</th><th>50</th></tr>';
        
        teamBatsmen.slice(0, 20).forEach((b, index) => {
            const rowColor = index % 2 === 0 ? 'text-white' : 'text-cyan';
            const highScoreDisplay = b.highScoreNotOut ? `${b.highScore}*` : b.highScore;
            html += `
                <tr class="${rowColor}">
                    <td>${b.name}</td>
                    <td>${b.runs}</td>
                    <td>${b.average}</td>
                    <td>${highScoreDisplay}</td>
                    <td>${b.hundreds}</td>
                    <td>${b.fifties}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    } else {
        html += `<div class="text-yellow" style="text-align: center; padding: 40px;">NO STATS AVAILABLE YET</div>`;
    }
    
    html += getFooterNavigation();
    
    document.getElementById('page-content').innerHTML = html;
    document.getElementById('subpage-indicator').textContent = '';
}

/**
 * Render Bowling Stats page
 */
function renderBowlingStats(data) {
    const series = data.series;
    window.currentPageData = data;
    
    // Reset to team 0 when loading the page
    bowlingStatsCurrentTeam = 0;
    bowlingStatsPaused = false;
    
    // Clear any existing intervals
    if (bowlingStatsCycleInterval) {
        clearInterval(bowlingStatsCycleInterval);
        bowlingStatsCycleInterval = null;
    }
    
    // Render first team
    renderBowlingStatsTeam(data, bowlingStatsCurrentTeam);
    
    // Start auto-cycling
    bowlingStatsCycleInterval = setInterval(() => {
        if (window.currentPageData && window.currentPageData.type === 'bowling-stats') {
            const teams = [window.currentPageData.series.team1, window.currentPageData.series.team2];
            if (!bowlingStatsPaused) {
                bowlingStatsCurrentTeam = (bowlingStatsCurrentTeam + 1) % teams.length;
                renderBowlingStatsTeam(window.currentPageData, bowlingStatsCurrentTeam);
            }
        }
    }, 5000);
    
    // Add keyboard event listener
    document.removeEventListener('keydown', handleBowlingStatsKeyPress);
    document.addEventListener('keydown', handleBowlingStatsKeyPress);
}

function handleBowlingStatsKeyPress(e) {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    
    if (e.key === ' ') {
        e.preventDefault();
        bowlingStatsPaused = !bowlingStatsPaused;
        renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        bowlingStatsPaused = true;
        bowlingStatsCurrentTeam = (bowlingStatsCurrentTeam + 1) % teams.length;
        renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        bowlingStatsPaused = true;
        bowlingStatsCurrentTeam = (bowlingStatsCurrentTeam - 1 + teams.length) % teams.length;
        renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
    }
}

function toggleBowlingStatsPause() {
    bowlingStatsPaused = !bowlingStatsPaused;
    const currentData = window.currentPageData;
    if (currentData) {
        renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
    }
}

function skipBowlingStatsForward() {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    bowlingStatsPaused = true;
    bowlingStatsCurrentTeam = (bowlingStatsCurrentTeam + 1) % teams.length;
    renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
}

function skipBowlingStatsBackward() {
    const currentData = window.currentPageData;
    if (!currentData) return;
    
    const teams = [currentData.series.team1, currentData.series.team2];
    bowlingStatsPaused = true;
    bowlingStatsCurrentTeam = (bowlingStatsCurrentTeam - 1 + teams.length) % teams.length;
    renderBowlingStatsTeam(currentData, bowlingStatsCurrentTeam);
}

function renderBowlingStatsTeam(data, teamIndex) {
    const series = data.series;
    const bowlers = data.bowlers || [];
    const teams = [series.team1, series.team2];
    const currentTeam = teams[teamIndex];
    
    // Filter bowlers for current team
    const teamBowlers = bowlers.filter(b => b.team === currentTeam);
    
    let html = `
        <div class="live-match-header">
            <span class="text-green">Wickets - ${currentTeam}</span>
            <span class="text-white">
                <span onclick="skipBowlingStatsBackward()" class="text-magenta" style="cursor: pointer;">◄</span>
                <span onclick="toggleBowlingStatsPause()" id="bowling-pause-btn" class="${bowlingStatsPaused ? 'text-green' : 'text-magenta'}" style="cursor: pointer;">||</span>
                <span onclick="skipBowlingStatsForward()" class="text-magenta" style="cursor: pointer; margin-right: 5px;">►</span>
                ${teamIndex + 1}/${teams.length}
            </span>
        </div>
        <div style="margin-top: 10px;"></div>
    `;
    
    if (teamBowlers.length > 0) {
        html += '<table class="stats-table bowling-stats">';
        html += '<tr class="text-cyan"><th>Player</th><th>W</th><th>Avg</th><th>Best</th><th>5W</th></tr>';
        
        teamBowlers.slice(0, 20).forEach((b, index) => {
            const rowColor = index % 2 === 0 ? 'text-white' : 'text-cyan';
            const bestFigures = `${b.bestFigures.wickets}/${b.bestFigures.runs}`;
            html += `
                <tr class="${rowColor}">
                    <td>${b.name}</td>
                    <td>${b.wickets}</td>
                    <td>${b.average}</td>
                    <td>${bestFigures}</td>
                    <td>${b.fiveWickets}</td>
                </tr>
            `;
        });
        
        html += '</table>';
    } else {
        html += `<div class="text-yellow" style="text-align: center; padding: 40px;">NO STATS AVAILABLE YET</div>`;
    }
    
    html += getFooterNavigation();
    
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
    const pageInput = document.getElementById('page-input');
    if (pageInput) {
        pageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                navigateToInputPage();
            }
        });
    }
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        const page = getPageFromURL();
        loadPage(page);
    });
    
    // Initialize keypad as collapsed on mobile
    const keypad = document.getElementById('mobile-keypad');
    if (keypad) {
        keypad.classList.add('collapsed');
    }
});

// Mobile Keypad Functions
let keypadValue = '';
let originalPageNumber = '';

function toggleKeypad() {
    const keypad = document.getElementById('mobile-keypad');
    keypad.classList.toggle('collapsed');
    
    // Change state
    if (keypad.classList.contains('collapsed')) {
        // Restore original page number if user didn't navigate
        if (keypadValue && keypadValue.length < 3) {
            document.getElementById('page-number-display').textContent = originalPageNumber;
            keypadValue = '';
        }
    } else {
        // Store the current page number
        originalPageNumber = currentPage;
        keypadValue = '';
    }
}

function keypadInput(digit) {
    if (keypadValue.length < 3) {
        keypadValue += digit;
        // Update the header page number display
        const displayValue = keypadValue.padEnd(3, '_');
        document.getElementById('page-number-display').textContent = displayValue;
        
        // Auto-navigate when 3 digits entered, but only if first digit is 3
        if (keypadValue.length === 3) {
            if (keypadValue[0] === '3') {
                setTimeout(() => {
                    keypadGo();
                }, 300);
            } else {
                // Invalid page number, clear after a moment
                setTimeout(() => {
                    keypadClear();
                }, 800);
            }
        }
    }
}

function keypadClear() {
    keypadValue = '';
    document.getElementById('page-number-display').textContent = originalPageNumber;
}

function keypadBackspace() {
    if (keypadValue.length > 0) {
        keypadValue = keypadValue.slice(0, -1);
        const display = keypadValue.padEnd(3, '_');
        document.getElementById('page-number-display').textContent = display;
    }
    if (keypadValue.length === 0) {
        document.getElementById('page-number-display').textContent = originalPageNumber;
    }
}

function keypadGo() {
    if (keypadValue.length === 3) {
        const pageNum = parseInt(keypadValue);
        keypadValue = '';
        navigatePage(pageNum);
        // Collapse keypad after navigation
        const keypad = document.getElementById('mobile-keypad');
        keypad.classList.add('collapsed');
    }
}
