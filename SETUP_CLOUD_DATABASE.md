# 🚀 Cloud Database Setup - Quick Guide

## Step 1: Create Supabase Account & Project

1. **Sign in to Supabase** (opening in browser now...)
   - Go to https://supabase.com/dashboard
   - Sign in with GitHub (easiest) or email

2. **Create a New Project**
   - Click "New Project"
   - **Name**: `goals-tracker` (or any name you like)
   - **Database Password**: Choose a strong password (SAVE THIS!)
   - **Region**: Choose closest to you (e.g., US East, EU West)
   - **Pricing Plan**: Free (0$ forever, perfect for personal use)
   - Click "Create new project"
   - ⏳ Wait ~2 minutes for setup to complete

## Step 2: Get Database Connection String

1. Once project is ready, go to **Settings** (gear icon on left sidebar)
2. Click **Database** in the settings menu
3. Scroll down to **Connection Pooling** section
4. Find the **Connection string** - should look like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-x-region.pooler.supabase.com:6543/postgres
   ```
5. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with the password you created in Step 1
6. Copy the complete connection string

## Step 3: Update .env File

I'll update your `.env` file with the new connection string once you provide it.

Just paste the connection string here (with the password filled in), and I'll update everything automatically!

## 📊 What You'll Get

✅ **Cloud Database** - Accessible from anywhere  
✅ **Free Forever** - Supabase free tier: 500MB storage, unlimited API requests  
✅ **Multi-user Support** - Friends can create their own accounts  
✅ **Automatic Backups** - Supabase handles it  
✅ **SSL Secure** - All connections encrypted  

## 🌐 After Database Setup

Once the database is connected, you can:
1. **Deploy the app** to Railway/Render/Vercel so friends can access it
2. **Share the URL** with friends (e.g., `https://your-app.com`)
3. **Friends create accounts** - each gets their own login
4. **Compete together** - leaderboards, competitions work across all users!

---

**Ready?** Follow the steps above, then paste your connection string here and I'll complete the setup!
