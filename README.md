# Cricket Text - Ceefax Cricket Scoring System

A complete Ceefax-style cricket scoring application with flexible series management, page-based navigation, and authentic teletext styling.

![Ceefax Cricket](https://github.com/user-attachments/assets/232ca3c7-8f11-458d-957b-75caa18bb6a7)

## 🎯 Features

### 🏏 Multi-Series Management
- Create and manage multiple Test series (no hardcoding!)
- Each series: custom name, teams, 1-5 matches
- Manual page number assignment (e.g., The Ashes = 350-356)
- Automatic series score tracking
- Delete series when finished

### 📺 Authentic Ceefax Styling
- **Classic teletext appearance** with proper color palette
- **Green "CRICKET" header** on blue background with shadow
- **Color-coded elements**: Yellow headlines, cyan sections, magenta page links
- **Blinking LIVE indicators** in red
- **CRT scanline effect** for authentic feel
- **Monospace font** (Press Start 2P with Courier fallback)
- No modern UI elements - pure Ceefax aesthetic

### 📄 Page-Based Navigation System
- **Page 340**: Cricket Homepage (live matches, news, series)
- **Pages 341-345**: News stories (max 5)
- **Pages 350+**: Series pages (each series gets 20 pages)

#### Series Page Structure (example: The Ashes starting at page 350)
- **Page 350**: Series overview with score and navigation
- **Page 351**: Live score with real-time updates
- **Page 352**: Full scorecard with auto-cycling subpages
- **Page 353**: Fixtures list
- **Page 354**: Results summary
- **Page 355**: Leading run scorers (auto-updated)
- **Page 356**: Leading wicket takers (auto-updated)

### 🔄 Subpage Auto-Cycling
- Scorecard automatically cycles through innings every 5 seconds
- Display format: "Page 352/4"
- Subpages: Batting, Bowling for each innings

### 📊 Live Statistics Aggregation
- **Real-time batting stats**: Runs, average, high score, 100s, 50s
- **Real-time bowling stats**: Wickets, average, best figures, 5-wicket hauls
- Aggregated across all matches in series
- Updates after every ball

### 📰 News Management
- Create, edit, delete news stories
- Assign to pages 341-345
- Publish/unpublish control
- Display on homepage with links

### 🎮 Navigation Controls
- Page number entry with GO button
- Previous/Next page buttons
- Index button (returns to homepage)
- Direct page links (e.g., "p352")
- URL-based navigation (?page=340)

### ⚡ Real-Time Updates
- Live pages auto-refresh every 2 seconds
- Uses Page Visibility API to pause when hidden
- Efficient polling strategy

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Configuration

1. (Optional) Create `.env` file:
```env
ADMIN_PASSWORD=ashes2025
```

### Running the Application

```bash
npm start
```

The application will run on http://localhost:3000

## 📍 Key URLs

- **Homepage**: http://localhost:3000/?page=340
- **Admin Dashboard**: http://localhost:3000/admin-dashboard.html (unified management interface)

**Default admin password**: `ashes2025`

## 📖 Usage Guide

### Creating a Series

1. Navigate to http://localhost:3000/admin/dashboard
2. Login with admin password
3. Click **Series** tab → **Create New Series**
4. Fill in:
   - Series Name: "The Ashes 2025"
   - Team 1: "England"
   - Team 2: "Australia"  
   - Number of Matches: 5
   - Start Page: 350
5. Click **Create Series**

### Setting Up a Match

1. In Series tab, click **View Matches** for your series
2. Click **Setup Match** for an upcoming match
3. Fill in:
   - Venue: "The Gabba, Brisbane"
   - Date: Match date
   - Both team squads (11 players each)
4. Click **Create Match**

### Scoring a Match

1. In Series tab, click **View Matches** for your series
2. Click **Manage Match** for the match you want to score
3. Use the integrated scoring interface to:
   - Start innings (select batting/bowling teams, set batting order, choose opening bowler)
   - Record balls (runs, extras, wickets)
   - Use admin actions (undo, swap strike, declare, end innings)
4. Match data saves automatically
5. Statistics auto-update on pages 355-356

### Creating News

1. Click **News** tab → **Create News Story**
2. Select page number (341-345)
3. Enter title, date, and content
4. Check "Publish immediately" if desired
5. Click **Create News**

### Viewing Public Pages

- **Homepage**: /?page=340
- **Series Overview**: /?page=350 (for Ashes at 350)
- **Live Score**: /?page=351
- **Full Scorecard**: /?page=352
- **Fixtures**: /?page=353
- **Results**: /?page=354
- **Run Scorers**: /?page=355
- **Wicket Takers**: /?page=356
- **News**: /?page=341, 342, etc.

## 📁 File Structure

```
cricket-text/
├── server.js                   # Express server with all routes & API
├── public/
│   ├── page.html              # Main page viewer
│   ├── admin.html             # Legacy admin (deprecated - use admin-dashboard.html)
│   ├── admin-dashboard.html   # Unified admin dashboard
│   ├── css/
│   │   ├── ceefax.css        # Authentic Ceefax styling
│   │   └── admin.css         # Admin interface styling
│   └── js/
│       ├── page-viewer.js    # Page navigation & rendering
│       ├── admin-dashboard.js # Dashboard functionality (includes scoring)
│       ├── admin.js          # Legacy scoring interface (deprecated)
│       └── scorecard.js      # Legacy scorecard display
├── data/
│   ├── series/               # Series data
│   │   └── {series-id}/
│   │       ├── series.json   # Series metadata & stats
│   │       └── match-*.json  # Match data files
│   ├── news.json             # News stories
│   ├── page-registry.json    # Page allocations
│   └── match.json            # Legacy current match
├── package.json
├── .env.example
├── README.md
└── GUIDE.md                   # Comprehensive guide
```

## 🎨 Ceefax Styling

The system uses authentic BBC Ceefax colors and styling:

### Color Palette
- **Black (#000000)**: Background
- **White (#FFFFFF)**: Main text
- **Yellow (#FFFF00)**: Headlines, highlights
- **Cyan (#00FFFF)**: Section headers, data labels
- **Green (#00FF00)**: "CRICKET" header
- **Magenta (#FF00FF)**: Page links
- **Red (#FF0000)**: LIVE indicators (blinking)
- **Blue (#0000FF)**: Background bars

### Design Features
- No modern UI (no cards, shadows, rounded corners)
- Monospace font with teletext aesthetic
- Classic header bar (green on blue with shadow)
- CRT scanline overlay effect
- Proper character spacing and layout

## 🔌 API Endpoints

### Series Management
```
GET    /api/series/list                           # List all series
GET    /api/series/:seriesId                      # Get series details
POST   /api/series/create                         # Create new series
DELETE /api/series/:seriesId                      # Delete series
POST   /api/series/:seriesId/match/create         # Create match
POST   /api/series/:seriesId/match/:matchId/ball  # Record ball
```

### News Management
```
GET    /api/news           # List all news
POST   /api/news/create    # Create news story
PUT    /api/news/:id       # Update news story
DELETE /api/news/:id       # Delete news story
```

### Page System
```
GET    /api/page-data?page=XXX  # Get page content
GET    /api/page-registry       # Get page allocations
```

### Authentication
```
POST   /api/auth/login     # Admin login
```

## 💡 Example Workflow

1. **Create "The Ashes 2025" series** (pages 350-369)
2. **Setup 1st Test** at The Gabba with squads
3. **Score the match** using legacy admin interface
4. **Stats auto-update** on pages 355-356
5. **Create news** about England squad on page 341
6. **Public views**:
   - Homepage shows live match
   - Series pages show stats
   - News appears on homepage and page 341

## 🔒 Security

- Password-protected admin access
- Session-based authentication
- Path traversal prevention
- Prototype pollution protection
- Input validation and sanitization
- Rate limiting on API endpoints (60 requests/minute)

## 🌐 Browser Compatibility

Tested on Chrome, Firefox, Safari (latest versions). Requires JavaScript and modern CSS support.

## 📚 Documentation

See [GUIDE.md](GUIDE.md) for comprehensive documentation including:
- Detailed usage instructions
- API documentation
- Statistics calculation
- Troubleshooting
- Future enhancements

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **Storage**: JSON file-based (no database required)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: Session-based with bcrypt
- **Styling**: Custom Ceefax/Teletext CSS

## 🐛 Known Issues

- Mobile admin interface could be improved
- Some edge cases in match scoring may need refinement

## 🚧 Future Enhancements

- WebSocket real-time updates
- Player profiles and career stats
- Commentary system
- Mobile-optimized admin
- Export to CSV/JSON
- Historical series archive

## 📝 License

ISC

## 🏏 Ready for The Ashes 2025!

This application is ready to use for The Ashes starting November 21, 2025. Create your series, set up matches, start scoring, and enjoy the authentic Ceefax experience!
