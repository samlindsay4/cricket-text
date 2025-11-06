# Cricket Text - Ashes Scoring App

A simplified cricket scoring application for manually scoring Ashes Test matches with authentic Ceefax/Teletext styling.

![Public Scorecard](https://github.com/user-attachments/assets/232ca3c7-8f11-458d-957b-75caa18bb6a7)

## Features

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
- Create new Ashes Test matches
- Start innings (select batting/bowling teams)
- **Quick-action scoring buttons**:
  - Large buttons: 0, 1, 2, 3, 4, 6
  - Extra buttons: Wd (wide), Nb (no ball), Bye, LB (leg bye)
  - Wicket recording with dismissal type
- Live scorecard preview as you score
- **Mobile-friendly** for easy scoring on phone

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
- **Admin interface**: http://localhost:3000/admin

## Usage

### Accessing Admin Interface

1. Navigate to http://localhost:3000/admin
2. Enter the admin password (default: `ashes2025`)

### Creating a Match

1. Login to admin interface
2. Select test number (1st - 5th Test)
3. Enter venue (e.g., "The Gabba, Brisbane")
4. Select date
5. Click "Create Match"

### Starting an Innings

1. Select batting team (England or Australia)
2. Select bowling team
3. Click "Start Innings"

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
├── server.js                 # Express server with all routes
├── public/
│   ├── index.html           # Public scorecard (Page 340)
│   ├── admin.html           # Admin scoring interface
│   ├── css/
│   │   ├── ceefax.css       # Authentic Ceefax styling
│   │   └── admin.css        # Admin interface styling
│   └── js/
│       ├── scorecard.js     # Frontend logic for public view
│       └── admin.js         # Frontend logic for admin scoring
├── data/
│   └── match.json           # Current match data storage
├── package.json
├── .env.example
└── README.md
```

## Data Structure

Match data is stored in `data/match.json`:

```javascript
{
  "id": "ashes-test-1",
  "title": "The Ashes - 1st Test",
  "venue": "The Gabba, Brisbane",
  "date": "2025-11-21",
  "status": "live",
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

- `GET /api/match` - Get current match data
- `POST /api/match/create` - Create new Ashes test match (admin)
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

## Ready for The Ashes 2025!

This application is ready to use for The Ashes starting November 21, 2025. Simply create a match, start scoring, and enjoy the authentic Ceefax experience!
