# Deployment Workflow

This guide explains how to deploy updates to Railway while preserving paper trading data.

## Before Each Deployment

**1. Backup Paper Trading Account**

```bash
npm run backup-paper-trading
```

This creates `paper-trading-backup.json` with your current:
- Balance and equity
- Open positions
- Trade history
- Performance metrics (win rate, profit factor, etc.)

**2. Commit the Backup**

```bash
git add paper-trading-backup.json
git commit -m "Backup paper trading account before deployment"
```

**3. Deploy Your Changes**

```bash
git add .
git commit -m "Your deployment message"
git push
```

Railway will automatically detect the push and redeploy.

## After Deployment (If Needed)

If Railway resets the paper trading account, you can restore from backup:

**On Railway (via CLI or dashboard logs):**

The bot will automatically use the backup file if `paper-trading-account.json` doesn't exist.

**Locally (for testing):**

```bash
npm run restore-paper-trading
```

## How It Works

- **Runtime file:** `paper-trading-account.json` (gitignored, created at runtime)
- **Backup file:** `paper-trading-backup.json` (tracked in git, survives deployments)
- **On startup:** Bot checks for backup and restores if needed

## Important Notes

⚠️ **Always backup before deploying** - Railway's filesystem is ephemeral

✅ **Backup file is tracked in git** - It persists across all deployments

🔄 **Automatic restore** - Bot will restore from backup on Railway startup

📊 **Check your backup** - Run `npm run backup-paper-trading` to see current stats

## Quick Reference

```bash
# Before deployment
npm run backup-paper-trading
git add paper-trading-backup.json
git commit -m "Backup paper trading"
git push

# After deployment (if needed)
npm run restore-paper-trading
```

## Future: Database Migration

For production, consider migrating to PostgreSQL:
- Permanent data storage
- No manual backup needed
- Survives all deployments
- Better for scaling

See `POSTGRES_MIGRATION.md` (coming soon) for migration guide.
