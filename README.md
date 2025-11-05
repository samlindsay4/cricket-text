# cricket-text

A cricket scoring and commentary system in the style of Ceefax/Teletext.

## Features

- **Ball-by-ball commentary**: Record every ball with runs, extras, wickets, and custom commentary
- **Live scoring**: Real-time scorecard updates as balls are recorded
- **Fixtures management**: Schedule upcoming matches
- **Scorecard display**: View detailed match scorecards with innings breakdowns
- **Retro Ceefax/Teletext UI**: Authentic teletext-style interface with classic colors and typography

## Getting Started

### Installation

```bash
npm install
```

### Running the Application

```bash
npm start
```

The application will run on http://localhost:3000

## Usage

### Creating a Match

1. Navigate to the "SCORING" page
2. Fill in the match details (teams, venue, date)
3. Click "CREATE MATCH"

### Starting a Match

1. Click on an upcoming match
2. Select the toss winner and decision
3. Click "START MATCH"

### Recording Balls

1. Enter the batsman and bowler names
2. Enter the runs scored
3. Select any extras (wide, no ball, bye, leg bye)
4. Check "Wicket" if a wicket fell and fill in details
5. Add optional commentary
6. Click "RECORD BALL"

### Viewing Live Scores

1. Navigate to the "LIVE SCORES" page
2. Click on any live match to see detailed scorecard and commentary

### Managing Fixtures

1. Navigate to the "FIXTURES" page
2. Add new fixtures with team names, venue, and date

## Ready for the Ashes

This system is ready to use for the Ashes starting November 21, 2025. Simply create a match for each test, record the toss, and start scoring ball-by-ball with live commentary!

## Technical Details

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Data Storage**: JSON files (persistent across restarts)
- **Auto-refresh**: Live scores update every 5 seconds

## Future Enhancements

- Batting averages
- Tournament tables (World Cup, County Championship)
- Player statistics
- Match highlights
