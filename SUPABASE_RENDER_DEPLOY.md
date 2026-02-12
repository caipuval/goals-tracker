# 🚀 Deploy Time Tracker with Supabase (FREE) - Step by Step

## ✅ What You Need
- Supabase account (free)
- Render account (free)
- GitHub account (free)

---

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project
1. Go to **https://supabase.com**
2. Sign in or create account (free)
3. Click **"New Project"**
4. Fill in:
   - **Name:** `time-tracker` (or any name)
   - **Database Password:** Create a strong password ⚠️ **SAVE THIS!**
   - **Region:** Choose closest to you
5. Click **"Create new project"**
6. Wait 2-3 minutes for setup

### 1.2 Get Connection String
1. In Supabase dashboard → **Settings** → **Database**
2. Scroll to **"Connection Pooling"** section
3. Find **"Connection string"** (should say "Session mode" or "Transaction mode")
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
5. **IMPORTANT:** Replace `[YOUR-PASSWORD]` with your actual database password
6. **Save this connection string** - you'll need it for Render!

### 1.3 Verify Database is Ready
- Tables will be created automatically when your app connects
- You can check in **Table Editor** after deployment

---

## Step 2: Push Code to GitHub

### 2.1 Initialize Git (If Not Done)
Open terminal in your project folder and run:

```bash
cd "C:\Users\robin\Downloads\Time Tracker"
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

### 2.2 Create GitHub Repository
1. Go to **https://github.com**
2. Click **"+"** → **"New repository"**
3. Name it: `time-tracker` (or any name)
4. **Don't** check "Initialize with README"
5. Click **"Create repository"**

### 2.3 Push Your Code
Copy the commands GitHub shows (or use these):

```bash
git remote add origin https://github.com/YOUR_USERNAME/time-tracker.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3: Deploy to Render.com

### 3.1 Create Render Account
1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (recommended - one click)
4. Authorize Render to access your GitHub

### 3.2 Create Web Service
1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect account"** if GitHub isn't connected
3. Select your **`time-tracker`** repository
4. Click **"Connect"**

### 3.3 Configure Service
Fill in:
- **Name:** `time-tracker` (or any name)
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** Select **Free**

### 3.4 Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"** and add these 3:

**Variable 1:**
- Key: `DATABASE_TYPE`
- Value: `postgres`

**Variable 2:**
- Key: `DATABASE_SSL`
- Value: `true`

**Variable 3:**
- Key: `DATABASE_URL`
- Value: `[Paste your Supabase connection string from Step 1.2]`
  - Make sure you replaced `[YOUR-PASSWORD]` with your actual password!

### 3.5 Deploy!
1. Click **"Create Web Service"**
2. Wait 3-5 minutes for deployment
3. Watch the build logs - it should say "Build successful"

---

## Step 4: Get Your Public URL! 🎉

1. Once deployment completes, you'll see a URL like:
   ```
   https://time-tracker.onrender.com
   ```
2. **Click the URL** to open your app
3. **Share this URL with friends!** They can now:
   - Create accounts
   - Track goals
   - Join competitions
   - All data saves to your Supabase database!

---

## Step 5: Test Everything

### 5.1 Test the App
1. Visit your Render URL
2. Create a test account
3. Create a goal
4. Log some time
5. Check it works!

### 5.2 Verify Data in Supabase
1. Go to Supabase dashboard
2. Click **"Table Editor"**
3. You should see tables: `users`, `goals`, `goal_completions`, etc.
4. Click on `users` - you should see your test account!

---

## ✅ You're Done!

Your app is now:
- ✅ Publicly accessible
- ✅ Free to use
- ✅ Saving data to Supabase
- ✅ Ready for friends to use!

---

## 🆘 Troubleshooting

### "Build failed" in Render
- Check build logs in Render dashboard
- Make sure `package.json` has all dependencies
- Verify `npm install` completes successfully

### "Database connection error"
- Double-check `DATABASE_URL` in Render environment variables
- Make sure you're using **Connection Pooling** URL (port 6543)
- Verify password is correct in connection string
- Check Supabase project is active (not paused)

### "App not loading"
- Check Render service logs
- Verify service is running (not sleeping)
- Free tier spins down after 15 min - first request takes ~30 seconds

### "Tables don't exist"
- Tables are created automatically on first connection
- Check Render logs for database errors
- Verify database connection string is correct

---

## 💡 Free Tier Notes

### Render Free Tier:
- ✅ Free forever
- ⚠️ Spins down after 15 min inactivity
- ⚠️ First request after spin-down takes ~30 seconds
- ✅ Perfect for personal/small group use

### Supabase Free Tier:
- ✅ 500MB database storage
- ✅ 2GB bandwidth/month
- ✅ Unlimited API requests
- ✅ Perfect for your use case!

---

## 🎯 Next Steps

1. Share your Render URL with friends
2. Everyone creates accounts
3. Start tracking goals together!
4. Compete on leaderboards!

**Enjoy your public Time Tracker! 🚀**
