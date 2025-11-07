# Cricket Text - Series Management & Scoring App

A comprehensive cricket series management and scoring application with authentic Ceefax/Teletext styling. Manage multiple Test series, create matches, and score games in real-time.

![Public Scorecard](https://github.com/user-attachments/assets/232ca3c7-8f11-458d-957b-75caa18bb6a7)

## Features

### Series Management System
- **Create multiple Test series** (e.g., The Ashes, India vs England)
- **Flexible series configuration**: 1-5 Test matches per series
- **Series score tracking**: Automatic win/loss tallying
- **Match status management**: Not created, upcoming, live, completed
- **Navigation**: All Series → Series Dashboard → Individual Match
- **No hardcoded data**: All series are user-created and managed

### Public Scorecard View (Page 340)
- **Authentic Ceefax styling** with classic color palette
- **Page 340** - BBC CEEFAX header
- Live match scorecard with:
  - Match title, venue, and date
  - Team score (runs/wickets and overs)
  - Current batsmen with runs and balls faced
  - Current bowler with figures (O-M-R-W)
  - **Current over display** showing ball-by-ball results
  - Fall of wickets summary
  - Recent overs summary
- **Auto-refresh** every 5 seconds when match is live
- **Mobile responsive** while maintaining Ceefax aesthetic

### Admin Scoring Interface
- **Password protected** admin access
- **Series-aware match management**
- Create matches within series with custom squads
- Start innings (select batting/bowling teams)
- **Quick-action scoring buttons**:
  - Large buttons: 0, 1, 2, 3, 4, 6
  - Extra buttons: Wd (wide), Nb (no ball), Bye, LB (leg bye)
  - Wicket recording with dismissal type
- Live scorecard preview as you score
- **Mobile-friendly** for easy scoring on phone
- **Auto-complete innings** when all out

## Technology Stack

- **Backend**: Node.js + Express
- **Storage**: JSON file-based (no database required)
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Authentication**: Simple password protection

## Installation

```bash
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. (Optional) Change the admin password in `.env`:
```env
ADMIN_PASSWORD=ashes2025
```

## Running the Application

```bash
npm start
```

The application will run on http://localhost:3000

- **Public scorecard**: http://localhost:3000
- **Series management**: http://localhost:3000/series
- **Admin interface**: http://localhost:3000/admin

## Usage

### Managing Series

1. Navigate to http://localhost:3000/series
2. Enter the admin password (default: `ashes2025`)
3. Click "Create New Series"
4. Enter series details:
   - Series name (e.g., "The Ashes 2025")
   - Team 1 name (e.g., "England")
   - Team 2 name (e.g., "Australia")
   - Number of matches (1-5)
5. Click "Create Series"

### Creating a Match in a Series

1. From the Series Management page, click "View Series" on any series
2. Click "Create New Match" or "Create Match" on a specific match slot
3. Select match number
4. Enter venue (e.g., "The Gabba, Brisbane")
5. Select date
6. Enter squads for both teams (11 players each)
7. Click "Create Match"

### Scoring a Match

1. From the Series Dashboard, click "Score Match" on any created match
2. The match will be activated and you'll be redirected to the scoring interface
3. Select batting order and opening bowler
4. Click "Start Innings"

### Starting an Innings

1. Select batting team and bowling team
2. Arrange batting order (drag or use dropdowns)
3. Select opening bowler
4. Click "Start Innings"

### Scoring Balls

1. Select batsman 1 (on strike)
2. Select batsman 2 (non-striker)
3. Select bowler
4. Click runs scored (0-6)
5. Select extras if any (Wd, Nb, Bye, LB)
6. Check "Wicket" if applicable and select dismissal type
7. Click "RECORD BALL"

The scorecard updates immediately and is visible on the public page.

## File Structure

```
cricket-text/
├── server.js                       # Express server with all routes
├── public/
│   ├── index.html                 # Public scorecard (Page 340)
│   ├── series.html                # Series management home
│   ├── series-dashboard.html      # Series dashboard with matches
│   ├── admin.html                 # Admin scoring interface
│   ├── css/
│   │   ├── ceefax.css             # Authentic Ceefax styling
│   │   └── admin.css              # Admin interface styling
│   └── js/
│       ├── scorecard.js           # Frontend logic for public view
│       └── admin.js               # Frontend logic for admin scoring
├── data/
│   ├── match.json                 # Current active match
│   └── series/                    # Series data directory
│       └── {series-slug}/
│           ├── series.json        # Series metadata and scores
│           ├── match-1.json       # Match 1 data
│           ├── match-2.json       # Match 2 data
│           └── ...
├── package.json
├── .env.example
└── README.md
```

## Data Structure

### Series Data (`data/series/{slug}/series.json`)

```javascript
{
  "slug": "the-ashes-2025",
  "name": "The Ashes 2025",
  "team1": "England",
  "team2": "Australia",
  "numberOfMatches": 5,
  "createdAt": "2025-11-07T15:07:09.526Z",
  "score": {
    "England": 0,
    "Australia": 0
  },
  "matches": [
    {
      "number": 1,
      "title": "1st Test",
      "status": "upcoming",
      "venue": "The Gabba, Brisbane",
      "date": "2025-11-21",
      "result": null
    }
    // ... more matches
  ]
}
```

### Match Data (`data/series/{slug}/match-{n}.json`)

```javascript
{
  "id": "the-ashes-2025-match-1",
  "seriesSlug": "the-ashes-2025",
  "matchNumber": 1,
  "title": "The Ashes 2025 - 1st Test",
  "venue": "The Gabba, Brisbane",
  "date": "2025-11-21",
  "status": "live",
  "format": "test",
  "maxInnings": 4,
  "currentInnings": 1,
  "innings": [
    {
      "number": 1,
      "battingTeam": "England",
      "bowlingTeam": "Australia",
      "runs": 245,
      "wickets": 4,
      "overs": 65,
      "balls": 3,
      "currentBatsmen": [...],
      "currentBowler": {...},
      "currentOver": [...],
      "fallOfWickets": [...],
      "allBalls": [...]
    }
  ],
  "squads": {
    "England": [...],
    "Australia": [...]
  }
}
```

## API Endpoints

### Series Management
- `GET /api/series/list` - List all series
- `GET /api/series/:slug` - Get specific series
- `POST /api/series/create` - Create new series (admin)
- `DELETE /api/series/:slug` - Delete series (admin)
- `GET /api/series/:slug/match/:matchNumber` - Get match from series
- `POST /api/series/:slug/match/create` - Create match in series (admin)
- `POST /api/series/:slug/match/:matchNumber/activate` - Activate match for scoring (admin)

### Match Operations
- `GET /api/match` - Get current active match data
- `POST /api/match/create` - Create new test match (admin, legacy)
- `POST /api/match/start-innings` - Start new innings (admin)
- `POST /api/match/ball` - Record a ball (admin)
- `POST /api/auth/login` - Admin login

## Ceefax Styling

The app uses authentic Ceefax colors:
- Background: `#000000` (black)
- Primary text: `#00FFFF` (cyan)
- Secondary text: `#FFFF00` (yellow)
- Highlights: `#FFFFFF` (white)
- Headers: `#0000FF` (blue) with yellow text
- Alerts: `#FF0000` (red)

Monospace font with Teletext-style fallbacks for authentic appearance.

## Screenshots

### Admin Interface

![Admin Login](https://github.com/user-attachments/assets/9ccca5ed-f735-411d-b9c8-4218e720836e)

![Create Match](https://github.com/user-attachments/assets/6e99e524-b9cc-4463-91b0-4aab7f1ed4f7)

![Scoring Interface](https://github.com/user-attachments/assets/1e8453c8-c0de-4452-a576-3ef6591aa06e)

### Public Scorecard

![Live Scorecard](https://github.com/user-attachments/assets/232ca3c7-8f11-458d-957b-75caa18bb6a7)

## License

ISC

## Ready for Any Test Series!

This application is ready to manage and score any Test cricket series. Create your series, set up matches, and enjoy the authentic Ceefax experience while tracking multiple tournaments simultaneously!
