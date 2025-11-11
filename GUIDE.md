# TELETEST Cricket - Complete Guide

## Overview

This is a complete TELETEST-style cricket scoring system with flexible series management, page-based navigation, and authentic teletext styling. The system supports multiple Test series, news management, and live statistics aggregation.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The application will run on http://localhost:3000

- **Public pages**: http://localhost:3000/?page=340
- **Admin Dashboard**: http://localhost:3000/admin/dashboard
- **Legacy Admin**: http://localhost:3000/admin

### 3. Default Admin Password

Default password: `ashes2025`

You can change this by creating a `.env` file:

```
ADMIN_PASSWORD=your_secure_password
```

## System Architecture

### Page Numbering System

The system uses TELETEST-style page numbers:

- **Page 340**: Homepage (live matches, news, series)
- **Pages 341-345**: News stories (max 5)
- **Pages 350+**: Series pages (each series gets 20 pages)

#### Series Page Structure (example: The Ashes at page 350)

- **Page 350**: Series overview
- **Page 351**: Live score
- **Page 352**: Full scorecard (with auto-cycling subpages)
- **Page 353**: Fixtures
- **Page 354**: Results
- **Page 355**: Leading run scorers
- **Page 356**: Leading wicket takers
- **Pages 357-369**: Reserved for future use

### Directory Structure

```
data/
  series/
    the-ashes-2025/
      series.json          # Series metadata and stats
      match-1.json         # Match 1 data
      match-2.json         # Match 2 data
      ...
    india-vs-england-2025/
      series.json
      match-1.json
      ...
  news.json              # News stories
  page-registry.json     # Page number allocations
  match.json            # Legacy current match (for compatibility)
  series.json           # Legacy series data (for compatibility)
```

## Admin Dashboard Usage

### Accessing the Dashboard

1. Navigate to http://localhost:3000/admin/dashboard
2. Enter admin password
3. You'll see three tabs: Series, News, and Match Scoring

### Creating a Series

1. Click **Series** tab
2. Click **Create New Series**
3. Fill in:
   - **Series Name**: e.g., "The Ashes 2025"
   - **Team 1**: e.g., "England"
   - **Team 2**: e.g., "Australia"
   - **Number of Matches**: 1-5
   - **Start Page Number**: e.g., 350 (must be ≥350)
4. Click **Create Series**

The system will automatically:
- Create series directory structure
- Allocate 20 pages for the series
- Register pages in page registry
- Create match placeholders

### Managing Matches

1. In Series tab, click **View Matches** for a series
2. You'll see all matches with their status:
   - **Upcoming**: Not configured yet
   - **Live**: Currently in progress
   - **Completed**: Finished

#### Setting Up a Match

1. Click **Setup Match** for an upcoming match
2. Fill in:
   - **Venue**: e.g., "The Gabba, Brisbane"
   - **Date**: Match date
   - **Team 1 Squad**: 11 players
   - **Team 2 Squad**: 11 players
3. Click **Create Match**

#### Scoring a Match

Currently, scoring uses the legacy admin interface:

1. Go to http://localhost:3000/admin
2. Use the existing scoring interface
3. The match will be saved to both:
   - Legacy location: `data/match.json`
   - Series location: `data/series/{series-id}/{match-id}.json`

**Note**: Integration between new series system and legacy scoring interface is functional but basic. Future updates will fully integrate the scoring interface with the series system.

### Creating News Stories

1. Click **News** tab
2. Click **Create News Story**
3. Fill in:
   - **Page Number**: 341-345
   - **Title**: News headline
   - **Date**: Publication date
   - **Content**: News story text
   - **Publish**: Check to publish immediately
4. Click **Create News**

## Public Page Navigation

### Homepage (Page 340)

Shows:
- All live matches across all series
- Latest news headlines (with page links)
- All active series (with page links)

### News Pages (341-345)

- Display individual news stories
- Auto-formatted in TELETEST style
- Link back to homepage

### Series Pages (350+)

#### Page +0: Series Overview
- Series score (Team A X - Y Team B)
- Current match summary (if live)
- Next match details
- Navigation links to all series pages

#### Page +1: Live Score
- Real-time match scorecard
- Current batsmen and bowler
- Current over display
- Auto-refreshes every 2 seconds

#### Page +2: Full Scorecard
- Auto-cycles through innings subpages every 5 seconds
- Displays: "Page 352/4" format
- Shows batting and bowling cards for each innings

#### Page +3: Fixtures
- List of all matches in series
- Shows venue, date, status
- Completed matches show results

#### Page +4: Results
- List of completed matches only
- Shows final results

#### Page +5: Leading Run Scorers
- Aggregated batting statistics across all matches
- Sorted by total runs
- Shows: Runs, Average, High Score, 100s, 50s
- Auto-updates after every ball

#### Page +6: Leading Wicket Takers
- Aggregated bowling statistics across all matches
- Sorted by total wickets
- Shows: Wickets, Average, Best Figures, 5-wicket hauls
- Auto-updates after every ball

### Navigation Controls

Every page includes:
- **◄ PREV**: Previous page
- **▲ INDEX**: Return to homepage (340)
- **Page input + GO**: Jump to specific page
- **NEXT ►**: Next page

## Authentic TELETEST Styling

The system implements authentic BBC TELETEST/Teletext styling:

### Color Palette
- **Black (#000000)**: Background
- **White (#FFFFFF)**: Main text
- **Yellow (#FFFF00)**: Headlines, highlights
- **Cyan (#00FFFF)**: Section headers, data labels
- **Green (#00FF00)**: "CRICKET" header
- **Magenta (#FF00FF)**: Page links (e.g., "p352")
- **Red (#FF0000)**: LIVE indicators (blinking)
- **Blue (#0000FF)**: Background bars

### Typography
- Monospace font (Press Start 2P or Courier New fallback)
- All caps for headers
- Proper character spacing

### Layout
- No modern UI elements (no cards, shadows, rounded corners)
- Simple colored text on black background
- Classic teletext header bar (green on blue with shadow)
- CRT scanline effect overlay

## API Endpoints

### Series Management

```
GET    /api/series/list                    # List all series
GET    /api/series/:seriesId               # Get series details
POST   /api/series/create                  # Create new series
DELETE /api/series/:seriesId               # Delete series
```

### Match Management

```
GET    /api/series/:seriesId/match/:matchId             # Get match
POST   /api/series/:seriesId/match/create               # Create match
POST   /api/series/:seriesId/match/:matchId/ball        # Record ball
```

### News Management

```
GET    /api/news                # List all news
POST   /api/news/create         # Create news story
PUT    /api/news/:id            # Update news story
DELETE /api/news/:id            # Delete news story
```

### Page System

```
GET    /api/page-data?page=XXX  # Get page content
GET    /api/page-registry       # Get page allocations
```

### Legacy Endpoints (for compatibility)

```
GET    /api/match              # Get current match
POST   /api/match/create       # Create match (legacy)
POST   /api/match/ball         # Record ball (legacy)
POST   /api/auth/login         # Admin authentication
```

## Statistics Calculation

The system automatically calculates and updates series statistics after every ball:

### Batting Statistics
- Total runs, innings, not outs
- Batting average
- High score
- Centuries and half-centuries
- Balls faced, fours, sixes

### Bowling Statistics
- Total wickets, runs, balls
- Bowling average
- Best innings figures
- 5-wicket hauls

Statistics are aggregated across all matches in a series and displayed on pages 355 and 356.

## Subpage Auto-Cycling

The full scorecard (Page +2 for each series) automatically cycles through subpages:

- **Subpage 1**: 1st Innings Batting
- **Subpage 2**: 1st Innings Bowling
- **Subpage 3**: 2nd Innings Batting
- **Subpage 4**: 2nd Innings Bowling
- (And so on for 3rd and 4th innings)

Cycles every 5 seconds. Display shows "Page 352/4" format.

## Real-Time Updates

Live pages auto-refresh every 2 seconds:
- Page 351 (Live Score)
- Page 352 (Full Scorecard)
- Page 355 (Batting Stats)
- Page 356 (Bowling Stats)

Uses Page Visibility API to pause updates when tab is not visible.

## Multi-Series Support

The system supports unlimited series running concurrently:

1. Each series gets its own directory in `data/series/`
2. Each series is assigned a unique 20-page block
3. Page registry prevents conflicts
4. Homepage shows all series and live matches
5. Statistics are calculated independently per series

## Example Workflow

### Setting Up The Ashes 2025

1. **Create Series**:
   - Name: "The Ashes 2025"
   - Team 1: "England"
   - Team 2: "Australia"
   - Matches: 5
   - Start Page: 350

2. **Create 1st Test**:
   - Venue: "The Gabba, Brisbane"
   - Date: "2025-11-21"
   - Enter 11 players for each team

3. **Score the Match**:
   - Use legacy admin interface at /admin
   - Start innings, record balls
   - Statistics auto-update on pages 355-356

4. **Create 2nd Test**:
   - Repeat for Adelaide Oval

5. **Public Views**:
   - Homepage: http://localhost:3000/?page=340
   - The Ashes Overview: http://localhost:3000/?page=350
   - Live Score: http://localhost:3000/?page=351
   - Scorecard: http://localhost:3000/?page=352

### Adding News

1. **Create News Story**:
   - Page: 341
   - Title: "England Squad Announced"
   - Content: "England have named their squad..."
   - Publish: Yes

2. **View News**:
   - Shows on homepage
   - Direct link: http://localhost:3000/?page=341

## Security

- Password-protected admin access
- Session-based authentication
- Path traversal prevention
- Prototype pollution protection
- Input validation and sanitization
- Rate limiting on API endpoints

## Browser Compatibility

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires:
- JavaScript enabled
- Modern CSS support

## Troubleshooting

### Server won't start
- Check if port 3000 is in use
- Try: `PORT=3001 npm start`

### Admin login fails
- Check `.env` file for correct password
- Default is `ashes2025`

### Pages don't load
- Ensure server is running
- Check browser console for errors
- Verify page number is valid

### Stats not updating
- Stats only update when balls are recorded
- Check series has matches with data
- Verify match is saved in series directory

### Match disappears
- This is a known issue in old code - should not happen with new system
- Check `data/series/{series-id}/{match-id}.json` exists
- Verify match status is not corrupted

## Future Enhancements

Potential improvements:
- Full integration of scoring interface with series system
- Match state management (follow-on, declarations)
- Player statistics profiles
- Historical series archive
- Export to CSV/JSON
- Mobile-optimized admin interface
- Real-time WebSocket updates
- Commentary system
- Wagon wheels and Manhattan charts
- Team comparison graphs

## License

ISC

## Ready for The Ashes 2025! 🏏
