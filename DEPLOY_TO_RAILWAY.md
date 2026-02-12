# 🚀 Deploy Goals Tracker to Railway (Free Public URL!)

Your friends can access your app **FOR FREE** without buying a domain! Railway gives you a public URL like `your-app.railway.app`.

## ✅ Step-by-Step Deployment (5 minutes)

### Step 1: Push Your Code to GitHub (If Not Already)

1. **Create a GitHub repository** (if you don't have one):
   - Go to [github.com](https://github.com)
   - Click **"New repository"**
   - Name it: `goals-tracker`
   - Make it **Public** or **Private** (your choice)
   - Click **"Create repository"**

2. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/goals-tracker.git
   git push -u origin main
   ```
   *(Replace YOUR_USERNAME with your GitHub username)*

### Step 2: Deploy on Railway

1. **Go to Railway**: [railway.app](https://railway.app)
2. **Click "New Project"** → **"Deploy from GitHub repo"**
3. **Select your repository**: Choose `goals-tracker` (or whatever you named it)
4. **Railway automatically detects** it's a Node.js app
5. **Wait 2-3 minutes** - Railway builds and deploys your app!

### Step 3: Add Environment Variables

1. **Click on your deployed service** in Railway
2. Go to the **"Variables"** tab
3. **Add these variables**:
   ```
   DATABASE_TYPE=postgres
   DATABASE_URL=[Railway will automatically inject this if database is in same project]
   DATABASE_SSL=true
   PORT=3000
   ```
   *(If your database is in the same Railway project, `DATABASE_URL` is automatically available!)*

### Step 4: Connect to Your Existing Database

**Option A: Database in Same Project (Easiest)**
- If your PostgreSQL database is in the same Railway project, Railway **automatically connects** them!
- No extra configuration needed!

**Option B: Reference Database from Another Project**
1. In your app's **Variables** tab
2. Click **"+ New Variable"**
3. Click **"Add Reference"**
4. Select your PostgreSQL service
5. Select `DATABASE_URL`
6. Railway automatically connects them!

### Step 5: Get Your Public URL! 🎉

1. **Click on your deployed service** in Railway
2. Go to **"Settings"** tab
3. Under **"Domains"**, you'll see your public URL:
   - `your-app.railway.app` (or similar)
   - Or click **"Generate Domain"** to get a custom one!

4. **Share this URL with your friends!** 🚀
   - Example: `goals-tracker-production.up.railway.app`

---

## 🎯 Quick Alternative: Use Railway CLI

If you prefer command line:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd "C:\Users\robin\Downloads\Time Tracker"
railway init

# Link to existing database or create new one
railway add postgresql

# Deploy!
railway up
```

---

## 🆓 Free Tier Limits

Railway gives you:
- **$5 free credit/month**
- **512 MB RAM** per service
- **Public URL included** (no domain needed!)
- **Enough for your app + friends** (small database is free)

---

## 🌐 Custom Domain (Optional)

If you want `goals-tracker.com` instead of `your-app.railway.app`:

1. **Buy a domain** from Namecheap, GoDaddy, etc. ($10-15/year)
2. In Railway → Your Service → Settings → Domains
3. Click **"Custom Domain"**
4. Enter your domain
5. Railway gives you DNS settings to configure

**But you DON'T need this!** The free `.railway.app` URL works perfectly!

---

## 📋 What Your Friends Will See

1. They visit: `your-app.railway.app`
2. They see the login/register screen
3. They create accounts
4. **All data saves to your shared Railway PostgreSQL database!**
5. Everyone can compete on the leaderboard!

---

## ✅ Checklist

- [ ] Code pushed to GitHub
- [ ] Deployed to Railway from GitHub
- [ ] Environment variables set
- [ ] Database connected
- [ ] Got public URL from Railway
- [ ] Tested the public URL in browser
- [ ] Shared URL with friends!

---

## 🆘 Troubleshooting

**"App won't start"**
- Check Railway logs: Service → Logs tab
- Verify environment variables are set
- Make sure `PORT` variable is set (Railway might auto-set this)

**"Can't connect to database"**
- Verify database is in the same project OR
- Use Variable Reference to connect to database

**"Friends can't access"**
- Make sure your app is deployed (not just running locally)
- Check the public URL is correct
- Railway URL should work from anywhere!

---

**That's it!** Your friends can now use your Goals Tracker app at your public Railway URL! 🎉
