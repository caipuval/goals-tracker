# 🚀 Quick Deploy Guide - Share Your App with Friends!

**No domain needed!** Railway gives you a FREE public URL like `your-app.railway.app`

## 🎯 Easiest Method: Deploy from GitHub

### 1. Push Your Code to GitHub (2 minutes)

If you haven't already:

```bash
cd "C:\Users\robin\Downloads\Time Tracker"
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Then go to [github.com](https://github.com) → **New repository** → Create it, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/goals-tracker.git
git push -u origin main
```

### 2. Deploy on Railway (3 minutes)

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Select your `goals-tracker` repository
5. **Railway automatically:**
   - Detects it's Node.js
   - Builds your app
   - Deploys it
   - Gives you a public URL!

### 3. Connect Your Database

**If your database is in the same Railway project:**
- Railway **automatically connects** them! ✅
- No configuration needed!

**If database is in a different project:**
1. Go to your app's **Variables** tab
2. Click **"+ New Variable"** → **"Add Reference"**
3. Select your PostgreSQL service
4. Select `DATABASE_URL`
5. Done! ✅

### 4. Get Your Public URL! 🎉

1. Click on your deployed service in Railway
2. Go to **"Settings"** tab
3. Scroll to **"Domains"** section
4. You'll see: `your-app.up.railway.app` (or similar)
5. **Copy this URL and share with friends!** 🚀

---

## ✅ That's It!

Your friends can now:
1. Visit your public Railway URL
2. Create accounts
3. Track goals together
4. Compete on the leaderboard!

**All using the FREE Railway URL - no domain purchase needed!**

---

## 💡 Optional: Custom Domain (If You Want)

If you want `goals-tracker.com`:
1. Buy domain from Namecheap/GoDaddy (~$10/year)
2. In Railway → Settings → Domains → Custom Domain
3. Add your domain
4. Configure DNS (Railway shows you how)

**But this is OPTIONAL!** The free `.railway.app` URL works perfectly!

---

## 🆘 Need Help?

Check the detailed guide: `DEPLOY_TO_RAILWAY.md`
