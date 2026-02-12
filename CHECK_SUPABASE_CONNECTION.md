# 🔍 How to Check if Supabase is Connected

## Quick Check Methods

### Method 1: Check Your .env File
Look for a `.env` file in your project root. It should contain:
```
DATABASE_TYPE=postgres
DATABASE_SSL=true
DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Method 2: Run the Test Script
I've created a test script for you. Run:
```bash
node test-supabase-connection.js
```

This will tell you:
- ✅ If Supabase is connected
- ✅ What tables exist
- ❌ Any connection errors

### Method 3: Check Server Startup
When you run `npm start`, look for:
- ✅ `✅ PostgreSQL database initialized` = Connected to Supabase!
- ❌ `✅ SQLite database initialized` = Using local SQLite (not Supabase)

---

## If Supabase is NOT Connected

### Step 1: Get Your Supabase Connection String
1. Go to **https://supabase.com/dashboard**
2. Select your project (I can see you have "caipuval's Project")
3. Go to **Settings** → **Database**
4. Scroll to **"Connection Pooling"** section
5. Find **"Connection string"** (should say "Session mode" or "Transaction mode")
6. Copy it - looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

### Step 2: Create .env File
In your project root, create a file named `.env` (no extension!) with:
```
DATABASE_TYPE=postgres
DATABASE_SSL=true
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_ACTUAL_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**IMPORTANT:**
- Replace `[YOUR-PASSWORD]` or `YOUR_ACTUAL_PASSWORD` with your actual Supabase database password
- Use the **Connection Pooling** URL (port 6543), NOT the direct connection
- Don't include brackets `[]` in the password

### Step 3: Test Connection
Run:
```bash
node test-supabase-connection.js
```

You should see:
```
✅ SUCCESS! Connected to Supabase PostgreSQL!
📋 Tables found in database:
  ✅ competitions
  ✅ competition_invitations
  ✅ competition_logs
  ✅ goal_completions
  ✅ goals
  ✅ users
```

### Step 4: Restart Your Server
```bash
npm start
```

Look for: `✅ PostgreSQL database initialized`

---

## Security Note (About Those RLS Warnings)

I can see in your Supabase dashboard that there are 6 security warnings about Row Level Security (RLS). 

**This is actually OK for your app!** Here's why:
- Your app uses **custom authentication** (not Supabase Auth)
- Your Express backend handles all database access
- Users can't directly access the database - they go through your API
- RLS is for when you use Supabase's built-in Auth + direct database access

**You can ignore these warnings** - your app is secure because:
1. All database queries go through your Express server
2. Your server validates users before allowing access
3. Users never have direct database credentials

If you want to silence the warnings (optional), you can enable RLS but it won't affect your app since you're using custom auth.

---

## Quick Test

Run this command to check:
```bash
node test-supabase-connection.js
```

This will immediately tell you if Supabase is connected! 🚀
