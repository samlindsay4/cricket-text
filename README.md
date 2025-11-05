# cricket-text

A cricket scoring and commentary system in the style of Ceefax/Teletext with live API integration for international cricket matches.

## Features

### Manual Scoring
- **Ball-by-ball commentary**: Record every ball with runs, extras, wickets, and custom commentary
- **Live scoring**: Real-time scorecard updates as balls are recorded
- **Fixtures management**: Schedule upcoming matches
- **Scorecard display**: View detailed match scorecards with innings breakdowns
- **Retro Ceefax/Teletext UI**: Authentic teletext-style interface with classic colors and typography

### Cricket API Integration (NEW)
- **Live international matches**: Fetch and display live scores from international cricket matches (Test, ODI, T20I)
- **Upcoming fixtures**: Get upcoming international cricket fixtures
- **Recent results**: View recently completed international matches
- **Automated sync**: Background service that periodically updates match data
- **Mock data support**: Works with mock data when API is unavailable (perfect for development)

## Getting Started

### Installation

```bash
npm install
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Configure your settings in `.env`:

```env
# Server Configuration
PORT=3000

# MongoDB Configuration (Optional - app works without MongoDB)
MONGODB_URI=mongodb://localhost:27017/cricket-text

# Cricket API Configuration (Optional - uses mock data without API key)
CRICKET_API_BASE_URL=https://cricbuzz-cricket.p.rapidapi.com
CRICKET_API_KEY=your_rapidapi_key_here

# Sync Service Configuration
SYNC_LIVE_INTERVAL=60000          # 60 seconds
SYNC_FIXTURES_INTERVAL=900000     # 15 minutes
SYNC_RESULTS_INTERVAL=900000      # 15 minutes
ENABLE_SYNC_SERVICE=true
INTERNATIONAL_ONLY=true
```

**Note**: The application works perfectly fine without MongoDB or an API key. It will:
- Use file-based storage if MongoDB is not available
- Use mock data if no Cricket API key is configured
- Continue to support all manual scoring features

### Running the Application

```bash
npm start
```

The application will run on http://localhost:3000

### Optional: MongoDB Setup

If you want to use MongoDB for persistence and the sync service:

1. Install MongoDB locally or use a cloud service like MongoDB Atlas
2. Update `MONGODB_URI` in your `.env` file
3. Set `ENABLE_SYNC_SERVICE=true` to enable background syncing

### Optional: Cricket API Setup

To fetch real live cricket data:

1. Sign up for a RapidAPI account at https://rapidapi.com
2. Subscribe to the Cricbuzz Cricket API
3. Copy your API key and add it to the `.env` file
4. Set `ENABLE_SYNC_SERVICE=true` to enable automatic data fetching

## Usage

### Creating a Manual Match

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
3. For API-sourced matches, data auto-updates based on sync intervals

### Managing Fixtures

1. Navigate to the "FIXTURES" page
2. Add new fixtures with team names, venue, and date

## API Endpoints

### Manual Match Management (Original)
- `GET /api/matches` - Get all manually created matches
- `POST /api/matches` - Create a new match
- `GET /api/matches/:id` - Get specific match details
- `POST /api/matches/:id/start` - Start a match
- `POST /api/matches/:id/ball` - Record a ball
- `POST /api/matches/:id/commentary` - Add commentary
- `GET /api/matches/:id/scorecard` - Get match scorecard
- `GET /api/fixtures` - Get all fixtures
- `POST /api/fixtures` - Create a new fixture

### Cricket API Integration (NEW)
- `GET /api/matches/live` - Get live international matches (from API)
- `GET /api/matches/fixtures` - Get upcoming international matches (from API)
- `GET /api/matches/results` - Get recent international results (from API)

All new API endpoints require MongoDB to be connected. If MongoDB is not available, they will return a 503 status with an appropriate error message.

## Architecture

### Data Storage
- **Dual storage system**: Supports both MongoDB and file-based storage
- **Backwards compatibility**: Manual matches work with or without MongoDB
- **API data**: Stored in MongoDB when sync service is enabled
- **Fallback**: Gracefully falls back to file storage if database is unavailable

### Sync Service
- **Background synchronization**: Automatically fetches data from Cricket API
- **Configurable intervals**: Customize how often different data types are synced
- **Rate limiting**: Built-in rate limiting to respect API constraints
- **Graceful degradation**: Works with mock data when API is unavailable

### Cricket API Service
- **Modular design**: Easy to switch between different cricket APIs
- **Error handling**: Robust error handling with fallback to mock data
- **Data transformation**: Converts API data to internal format
- **International filter**: Optionally filter to show only international matches

## Ready for the Ashes

This system is ready to use for the Ashes starting November 21, 2025. You can:
- Manually create matches for each test and record ball-by-ball
- OR enable the API integration to automatically fetch live scores
- OR use both: API for live scores and manual for detailed commentary

## Technical Details

- **Backend**: Node.js with Express
- **Database**: MongoDB with Mongoose (optional)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Data Storage**: MongoDB + JSON file fallback
- **Auto-refresh**: Live scores update every 5 seconds
- **Background Sync**: Configurable sync intervals for API data
- **API Integration**: Cricbuzz (via RapidAPI) with easy switching support

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `MONGODB_URI` | MongoDB connection string | - | No |
| `CRICKET_API_BASE_URL` | Cricket API base URL | - | No |
| `CRICKET_API_KEY` | Cricket API key | - | No |
| `SYNC_LIVE_INTERVAL` | Live match sync interval (ms) | 60000 | No |
| `SYNC_FIXTURES_INTERVAL` | Fixtures sync interval (ms) | 900000 | No |
| `SYNC_RESULTS_INTERVAL` | Results sync interval (ms) | 900000 | No |
| `ENABLE_SYNC_SERVICE` | Enable/disable sync service | false | No |
| `INTERNATIONAL_ONLY` | Filter to international matches | true | No |

## Development

### Without External Dependencies

The application works perfectly for development without any external services:

```bash
npm install
npm start
```

### With MongoDB (Local)

```bash
# Install MongoDB locally, then:
echo "MONGODB_URI=mongodb://localhost:27017/cricket-text" > .env
npm start
```

### With Full API Integration

```bash
# Setup MongoDB and get API key, then configure .env:
MONGODB_URI=mongodb://localhost:27017/cricket-text
CRICKET_API_KEY=your_actual_api_key
ENABLE_SYNC_SERVICE=true
npm start
```

## Future Enhancements

- Batting averages and player statistics
- Tournament tables (World Cup, County Championship)
- Match highlights and key moments
- Additional cricket API providers
- WebSocket support for real-time updates
- Mobile responsive design improvements
