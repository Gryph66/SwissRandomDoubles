# Tournament Archive & Sharing - Deployment Guide

## Railway Setup

### 1. Add Volume for SQLite Database

1. Go to your Railway project dashboard
2. Select your service
3. Click on "Variables" tab
4. Scroll to "Volumes" section
5. Click "New Volume"
6. Set mount path: `/data`
7. Set size: `1GB` (free tier)
8. Click "Add"

### 2. Set Environment Variables

Add the following environment variables in Railway:

```
RAILWAY_VOLUME_MOUNT_PATH=/data
MAX_TOURNAMENT_SIZE_KB=500
MAX_TOTAL_TOURNAMENTS=1000
TOURNAMENT_EXPIRATION_DAYS=90
NODE_ENV=production
BASE_URL=https://your-app-name.up.railway.app
```

**Important:** Replace `your-app-name` with your actual Railway app domain.

### 3. Update Start Command

Railway should automatically detect the start command from `package.json`, but verify it's set to:

```
npm run start
```

This runs: `NODE_ENV=production node dist-server/server/index.js`

### 4. Deploy

1. Push your code to GitHub
2. Railway will automatically build and deploy
3. Monitor the build logs for any errors
4. Once deployed, test the archive feature

## Testing After Deployment

### 1. Complete a Tournament

1. Navigate to your Railway app URL
2. Create and complete a tournament
3. Go to Admin Panel
4. Click "Archive & Get Shareable Link"

### 2. Verify Archive

1. Copy the shareable link
2. Open in a new browser/incognito window
3. Verify tournament loads correctly
4. Check all tabs work (Standings, Round Results, Playoffs, Analysis)

### 3. Check Health Endpoint

Visit: `https://your-app.railway.app/api/archive/health`

Should return:

```json
{
  "status": "ok",
  "database": "connected",
  "tournaments": 0,
  "storage": "0.00 MB",
  "nextExpiration": null
}
```

## Troubleshooting

### Database Not Found

**Error:** `ENOENT: no such file or directory, open '/data/tournaments.db'`

**Solution:**

- Verify volume is mounted at `/data`
- Check `RAILWAY_VOLUME_MOUNT_PATH` environment variable is set
- Restart the service

### Archive Returns 500 Error

**Check:**

1. Server logs in Railway dashboard
2. Database permissions
3. Volume is properly mounted

### Shareable Links Don't Work

**Check:**

1. `BASE_URL` environment variable is set correctly
2. React Router is working (check browser console)
3. API routes are accessible

## Monitoring

### Check Archive Stats

```bash
curl https://your-app.railway.app/api/archive/health
```

### View Server Logs

1. Go to Railway dashboard
2. Select your service
3. Click "Deployments"
4. Click on latest deployment
5. View logs

## Costs

**Free Tier:**

- 500 hours/month execution time
- 1GB storage (volume)
- 100GB network egress

**Expected Usage:**

- 1000 tournaments × 50KB = 50MB storage
- Well within free tier limits

**Estimated Monthly Cost:** $0 (free tier sufficient)

## Maintenance

### Cleanup Schedule

The server automatically runs cleanup every hour:

- Deletes expired tournaments (90+ days old)
- Enforces global limit (1000 max tournaments)

### Manual Cleanup

If needed, you can manually trigger cleanup by restarting the service.

### Backup

To backup archived tournaments:

1. SSH into Railway container (if available)
2. Copy `/data/tournaments.db` file
3. Store securely

Or use Railway's volume backup feature (if available).

## Security Notes

- ✅ Rate limiting prevents abuse (5 archives/day per IP)
- ✅ Size limits prevent storage bombing (500KB max)
- ✅ Auto-expiration prevents indefinite storage (90 days)
- ✅ No authentication required (public sharing by design)
- ✅ Read-only viewer (no editing capabilities)

## Support

If you encounter issues:

1. Check Railway logs
2. Verify environment variables
3. Test health endpoint
4. Check volume is mounted
