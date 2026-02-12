# 🚀 Make Your Time Tracker Public (FREE) - Complete Guide

## Current Status
✅ Your app uses **custom authentication** (not Supabase Auth)
✅ Your app supports PostgreSQL (Supabase) and SQLite
✅ You have deployment files ready

## Step 1: Set Up Supabase Database (If Not Done)

### 1.1 Create/Verify Supabase Project
1. Go to https://supabase.com
2. Sign in or create a free account
3. Click "New Project"
4. Fill in:
   - **Name:** `time-tracker` (or any name)
   - **Database Password:** Create a strong password (SAVE THIS!)
   - **Region:** Choose closest to you
5. Click "Create new project"
6. Wait 2-3 minutes for setup

### 1.2 Get Your Database Connection String
1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll to **Connection Pooling** section
3. Copy the **Connection string** (looks like):
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
4. **IMPORTANT:** Replace `[YOUR-PASSWORD]` with your actual database password
5. Save this connection string - you'll need it!

### 1.3 Verify Tables Are Created
Your app will automatically create tables when it connects, but you can verify:
1. Go to **Table Editor** in Supabase
2. You should see: `users`, `goals`, `goal_completions`, `competitions`, `competition_logs`, `competition_invitations`
3. If tables don't exist yet, they'll be created on first app connection

---

## Step 2: Deploy to Render.com (FREE)

### 2.1 Create Render Account
1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (recommended) or email
4. Verify your email

### 2.2 Push Your Code to GitHub (If Not Already)
1. Go to https://github.com
2. Create a new repository (or use existing)
3. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

### 2.3 Deploy on Render
1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub account if needed
3. Select your repository
4. Configure:
   - **Name:** `time-tracker` (or any name)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Select **Free**
5. Click **"Advanced"** and add Environment Variables:
   ```
   DATABASE_TYPE = postgres
   DATABASE_SSL = true
   DATABASE_URL = [Paste your Supabase connection string from Step 1.2]
   ```
6. Click **"Create Web Service"**
7. Wait 3-5 minutes for deployment

### 2.4 Your App is Live! 🎉
- Your app will be at: `https://your-app-name.onrender.com`
- Share this URL with friends!
- Everyone can sign up and use it
- All data saves to your Supabase database

---

## Step 3: Test Everything

### 3.1 Test Locally First (Optional)
Create a `.env` file in your project root:
```
DATABASE_TYPE=postgres
DATABASE_SSL=true
DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Then run:
```bash
npm install
npm start
```

Visit `http://localhost:3000` and test sign up/login.

### 3.2 Test on Render
1. Visit your Render URL
2. Create a test account
3. Create a goal
4. Log some time
5. Check Supabase Table Editor to see data

---

## Important Notes

### Free Tier Limitations
- **Render Free Tier:** Spins down after 15 min inactivity. First request takes ~30 seconds to wake up.
- **Supabase Free Tier:** 500MB database, 2GB bandwidth/month - plenty for personal use!

### Security
- Never commit your `.env` file to GitHub
- Your `.gitignore` should include `.env`
- Database password is only in Render environment variables

### Custom Domain (Optional)
- In Render dashboard → Settings → Custom Domain
- Add your domain (requires DNS setup)

---

## Troubleshooting

### "Database connection error"
- Verify `DATABASE_URL` in Render environment variables
- Make sure you're using the **Connection Pooling** URL (port 6543)
- Check that password is correct in the connection string

### "Tables don't exist"
- Tables are created automatically on first connection
- Check Render service logs for errors
- Verify database connection string is correct

### "App not loading"
- Check Render service logs
- Verify build completed successfully
- Check that `npm start` command is correct

---

## Alternative: Deploy to Fly.io (Also Free)

If Render doesn't work:
1. Install Fly CLI: `npm install -g @fly/cli`
2. Run: `fly launch`
3. Set secrets: `fly secrets set DATABASE_TYPE=postgres DATABASE_SSL=true DATABASE_URL=your-connection-string`

---

## Need Help?
- Check Render logs: Dashboard → Your Service → Logs
- Check Supabase logs: Dashboard → Logs
- Verify environment variables are set correctly
