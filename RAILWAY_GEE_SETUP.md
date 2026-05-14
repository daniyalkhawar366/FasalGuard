# 🚀 Railway Deployment Guide - GEE Credentials Setup

## Problem Fixed
Docker build was failing because it tried to copy `gee_credentials.json` which isn't in git (it contains private keys). Solution: Pass credentials via **environment variable**.

---

## ✅ Quick Fix for Railway ML Service

### Step 1: Prepare GEE Credentials
Your credentials file is at: `backend/ml_service/gee_credentials.json`

```bash
# View your credentials (for reference only - DON'T commit this!)
cat backend/ml_service/gee_credentials.json
```

### Step 2: Convert Credentials to String
**Option A - Windows PowerShell:**
```powershell
$creds = Get-Content "backend/ml_service/gee_credentials.json" -Raw
# Now copy the entire output to clipboard/env var
$creds
```

**Option B - Linux/Mac:**
```bash
cat backend/ml_service/gee_credentials.json
```

### Step 3: Add to Railway ML Service
1. Go to **Railway Dashboard**
2. Select **ML Service** (grateful-recreation-production)
3. Go to **Settings → Variables**
4. Click **+ New Variable**
5. **Key**: `GEE_CREDENTIALS_JSON`
6. **Value**: Paste the **entire** GEE credentials JSON (copy from Step 2)
7. Click Save

**Example Value** (your entire JSON credentials file):
```json
{
  "type": "service_account",
  "project_id": "bubbly-access-432919-g8",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "fasalguard@bubbly-access-432919-g8.iam.gserviceaccount.com",
  ...
}
```

### Step 4: Redeploy ML Service
1. Go to ML Service → **Redeploy**
2. Watch logs for:
   ```
   📋 Using GEE credentials from GEE_CREDENTIALS_JSON environment variable
   ✅ GEE initialised for project bubbly-access-432919-g8 using fasalguard@...
   ```

---

## Environment Variables Summary

### ML Service (`/app/ml_service/`)
| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `GEE_CREDENTIALS_JSON` | Full JSON credentials | Optional | Enables Earth Engine satellite features |
| `GEE_PROJECT_ID` | `bubbly-access-432919-g8` | No | Auto-detected from credentials |
| `MODEL_PATH_WHEAT` | Path to wheat model | No | Auto-resolves if not set |
| `SCALER_PATH_*` | Path to scalers | No | Auto-resolves if not set |
| `CONFIG_PATH_*` | Path to configs | No | Auto-resolves if not set |

### Backend Service
| Variable | Value | Required |
|----------|-------|----------|
| `PYTHON_ML_SERVICE_URL` | `https://grateful-recreation-production.up.railway.app` | Yes |
| `FRONTEND_URL` | `https://fasal-guard.vercel.app` | Yes |
| `MONGO_URI` | MongoDB Atlas connection | Yes |
| `JWT_SECRET` | JWT signing key | Yes |

---

## What Changed

### ✅ Fixed Files
- **Dockerfile** - Removed GEE credentials COPY (files in git can't have secrets)
- **satellite_predictor.py** - Added `GEE_CREDENTIALS_JSON` env var support
- **app.py** - Added startup initialization logging

### 🔑 How It Works Now
1. **Dockerfile runs** → copies models (from git) but NOT credentials
2. **ML service starts** → checks for `GEE_CREDENTIALS_JSON` env var
3. If env var exists → parse JSON and create temp credentials file
4. **GEE initializes** → uses the temp file for authentication
5. **Service ready** → satellites models load and work

---

## Testing After Deployment

### Test 1: Check Health Endpoint
```bash
curl https://grateful-recreation-production.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "yield_models_loaded": 10,
  "soil_models_loaded": true,
  "soil_models_available": [7 models],
  "message": "ML service running with pre-trained models"
}
```

### Test 2: Run Satellite Analysis
```bash
curl -X POST https://grateful-recreation-production.up.railway.app/satellite/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 31.5204,
    "longitude": 74.3587,
    "crop": "wheat",
    "city": "Lahore"
  }'
```

---

## Troubleshooting

### ❌ "GEE init failed" in Logs
**Check:**
1. Is `GEE_CREDENTIALS_JSON` set in Railway variables?
2. Is the entire JSON pasted correctly (including newlines in private_key)?
3. Does it have `client_email` field?

**Fix:** Copy-paste entire `gee_credentials.json` file content into the env var

### ❌ Satellite models still showing "not found"
1. Redeploy ML service (forces new Docker build)
2. Check logs for path resolution messages
3. Verify models exist in build: should see `✅ Satellite ensemble model loaded`

### ❌ Models still not loading from repo
The models are now in git! Check:
```bash
git log --oneline backend/ml_models/satellite_models/
```

Should see commits like: `Track ML models: satellite and soil models now in repo`

---

## Security Note

⚠️ **IMPORTANT**: 
- ✅ GEE credentials are NOW stored as Railway secrets (safe)
- ✅ Models are in git (OK - they're not sensitive)
- ❌ DON'T commit `gee_credentials.json` to git
- ❌ DON'T paste credentials in logs/chat

The env var approach is the **secure way** to handle secrets in cloud deployments.

---

## Next Steps

1. **Set `GEE_CREDENTIALS_JSON` in Railway ML Service** ← YOU ARE HERE
2. Set `PYTHON_ML_SERVICE_URL` and `FRONTEND_URL` in Railway Backend
3. Verify all env vars in Vercel Frontend
4. Test `/api/satellite/analyze` from frontend
5. Test Google sign-in flow

---

## Questions?

Check:
- **Satellite route**: `backend/routes/satelliteRoutes.js`
- **ML endpoint**: `backend/ml_service/app.py` line ~362
- **GEE setup**: `backend/ml_service/satellite_predictor.py` line ~236
- **Startup logs**: `backend/ml_service/app.py` line ~27-35
