# Railway Deployment Guide

This guide explains how to deploy Cricket Text to Railway with persistent data storage using volumes.

## Why Railway Volumes?

The application stores match data, series information, and news stories in JSON files. Without persistent volumes:

- ❌ Data is lost on each deployment
- ❌ Deleted series reappear after redeployment
- ❌ Match scoring data is lost when code is updated
- ❌ Git history becomes cluttered with data changes

With Railway volumes:

- ✅ Data persists across deployments
- ✅ Code updates don't affect live data
- ✅ Git remains clean with only code changes
- ✅ No more data loss issues

## Initial Setup

### 1. Create a Railway Project

1. Go to [Railway.app](https://railway.app/)
2. Create a new project
3. Connect your GitHub repository
4. Railway will detect the Node.js application automatically

### 2. Add a Volume

1. In your Railway project, click **"New"** → **"Volume"**
2. Configure the volume:
   - **Name**: `cricket-data` (or any name you prefer)
   - **Mount Path**: `/app/data-persistent`
3. Click **"Add Volume"**

### 3. Configure Environment Variables

In your Railway project settings, add the following environment variables:

```bash
# Required - Points to the volume mount
RAILWAY_VOLUME_MOUNT_PATH=/app/data-persistent

# Required - Set a secure admin password
ADMIN_PASSWORD=your-secure-password-here

# Optional - Custom port (Railway sets this automatically)
PORT=3000
```

### 4. Deploy

1. Commit and push your code to GitHub
2. Railway will automatically deploy your application
3. The app will create necessary directories in the volume on first run

## Data Migration

If you have existing data in your local `./data` directory that you want to migrate to Railway:

### Option 1: Using Railway CLI (Recommended)

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Link to your project:
   ```bash
   railway link
   ```

4. Copy your local data to the volume:
   ```bash
   railway run bash -c "cp -r ./data/* /app/data-persistent/"
   ```

### Option 2: Manual Upload via Admin Interface

1. Deploy the application to Railway
2. Access the admin interface at `https://your-app.railway.app/admin`
3. Manually recreate your series, matches, and news items through the UI

### Option 3: Using the API

Use the Railway API endpoints to programmatically upload your data:

```bash
# Example: Create a series via API
curl -X POST https://your-app.railway.app/api/series/create \
  -H "Content-Type: application/json" \
  -H "x-session-id: YOUR_SESSION_ID" \
  -d '{
    "name": "The Ashes 2025",
    "team1": "England",
    "team2": "Australia",
    "numMatches": 5,
    "startPage": 350
  }'
```

## Verifying the Setup

After deployment, verify that the volume is working:

1. **Check logs**: Look for the startup message showing the data directory path
   ```
   Cricket Text - Ashes Scoring App
   Server running on port 3000
   ```

2. **Create test data**: 
   - Login to admin interface
   - Create a test series or news item
   - Deploy a code change (e.g., update README)
   - Verify the test data still exists after deployment

3. **Check volume contents** (using Railway CLI):
   ```bash
   railway run ls -la /app/data-persistent
   ```

## Data Structure in Volume

The volume will contain the following structure:

```
/app/data-persistent/
├── about.json           # About page content
├── homepage.json        # Homepage configuration
├── match.json          # Current/legacy match data
├── news.json           # News stories
├── page-registry.json  # Page number allocations
├── series.json         # Legacy series data
└── series/             # Series directory
    └── {series-id}/    # Individual series folders
        ├── series.json # Series metadata
        └── *.json      # Match data files
```

## Troubleshooting

### Data not persisting after deployment

**Symptom**: Data disappears after each deployment

**Solution**: 
1. Verify `RAILWAY_VOLUME_MOUNT_PATH` is set correctly in environment variables
2. Check that the volume is mounted at the correct path
3. Review Railway logs for permission errors

### Permission errors

**Symptom**: Cannot write to data directory

**Solution**:
1. Ensure the volume mount path is writable
2. Railway volumes should have correct permissions by default
3. Check Railway logs for specific error messages

### Volume not found

**Symptom**: Application cannot find the volume

**Solution**:
1. Verify the volume is created and attached to your service
2. Check that `RAILWAY_VOLUME_MOUNT_PATH` matches the volume's mount path
3. Restart the Railway service

### Data from Git still appearing

**Symptom**: Old data files from Git are being used

**Solution**:
1. Ensure `.gitignore` is properly configured to exclude `data/*.json`
2. Remove committed JSON files from Git history if needed:
   ```bash
   git rm --cached data/*.json
   git commit -m "Remove data files from Git"
   ```
3. Redeploy to Railway

## Development Workflow

### Local Development

When developing locally, the app uses `./data` directory by default:

```bash
# No RAILWAY_VOLUME_MOUNT_PATH set
npm start
# Uses ./data directory
```

### Testing with Volume Path Locally

To test the volume path behavior locally:

```bash
# Create a test directory
mkdir -p /tmp/cricket-data

# Set the environment variable
export RAILWAY_VOLUME_MOUNT_PATH=/tmp/cricket-data

# Run the app
npm start
# Uses /tmp/cricket-data directory
```

## Backup Strategy

### Automated Backups

Consider setting up automated backups of your Railway volume:

1. Use Railway's built-in backup features (if available)
2. Create a scheduled job to export data via API
3. Use Railway CLI to periodically download volume contents

### Manual Backup

To manually backup your data:

```bash
# Using Railway CLI
railway run tar -czf /tmp/backup.tar.gz /app/data-persistent
railway run cat /tmp/backup.tar.gz > backup-$(date +%Y%m%d).tar.gz
```

### Restore from Backup

To restore data from a backup:

```bash
# Upload backup file
railway run bash -c "cat > /tmp/backup.tar.gz" < backup.tar.gz

# Extract to volume
railway run tar -xzf /tmp/backup.tar.gz -C /
```

## Security Considerations

1. **Admin Password**: Always set a strong `ADMIN_PASSWORD` in production
2. **Volume Access**: Only your Railway service should have access to the volume
3. **Data Encryption**: Railway volumes are encrypted at rest
4. **Backups**: Keep regular backups of critical match data

## Cost Considerations

Railway's pricing includes:

- **Volume Storage**: Charged per GB/month
- **Volume Usage**: The Cricket Text app uses minimal storage (typically < 100MB)
- **Free Tier**: Railway offers a free tier that includes volume storage

Estimated storage usage:
- Base files: ~10 KB
- Per series: ~5-10 KB
- Per match: ~50-100 KB (depending on overs bowled)
- 5 series with 25 matches: ~2-3 MB total

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway Volumes Guide](https://docs.railway.app/reference/volumes)
- [Railway CLI Documentation](https://docs.railway.app/develop/cli)

## Support

If you encounter issues with Railway deployment:

1. Check Railway's status page
2. Review Railway logs in the dashboard
3. Consult Railway's documentation
4. Open an issue in the GitHub repository
