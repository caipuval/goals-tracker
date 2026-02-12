# 📊 Database Setup Guide

The Goals Tracker now supports both **SQLite (local)** and **PostgreSQL (cloud)** databases. This allows your friends to use the app and share data!

## 🚀 Quick Start (Local SQLite - Current Setup)

The app currently uses SQLite by default. No configuration needed! Just run:

```bash
npm install
npm start
```

This uses a local `goals.db` file (good for single-user testing).

---

## ☁️ Cloud Database Setup (For Friends to Share)

To let your friends use the app together, set up a cloud PostgreSQL database. Here are free options:

### Option 1: **Railway** (Recommended - Easiest) 🚂

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Provision PostgreSQL"
4. Copy the **DATABASE_URL** from the Variables tab
5. Create a `.env` file in your project:

```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
DATABASE_SSL=true
```

6. Restart your server: `npm start`

---

### Option 2: **Neon** (Free Forever Tier) ✨

1. Go to [neon.tech](https://neon.tech)
2. Sign up and create a project
3. Copy the connection string
4. Add to `.env`:

```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_SSL=true
```

---

### Option 3: **Render** 🎨

1. Go to [render.com](https://render.com)
2. Create a new PostgreSQL database
3. Copy the Internal Database URL
4. Add to `.env`:

```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@dpg-xxx.render.com/dbname
DATABASE_SSL=true
```

---

### Option 4: **Supabase** (Free Tier) 🔥

1. Go to [supabase.com](https://supabase.com)
2. Create a project
3. Go to Settings → Database
4. Copy the Connection String (URI format)
5. Add to `.env`:

```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
DATABASE_SSL=true
```

---

## 🔧 Setup Steps

1. **Install dependencies** (includes PostgreSQL driver):
   ```bash
   npm install
   ```

2. **Create `.env` file** in the project root:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** with your database URL:
   ```env
   DATABASE_TYPE=postgres
   DATABASE_URL=your_connection_string_here
   DATABASE_SSL=true
   ```

4. **Restart the server**:
   ```bash
   npm start
   ```

5. **Verify connection**: You should see:
   ```
   ✅ PostgreSQL database initialized
   🚀 Goals Tracker running on http://localhost:3000
   📊 Using POSTGRES database
   ```

---

## 🔄 Switching Between Databases

- **Local SQLite**: Set `DATABASE_TYPE=sqlite` or remove the `.env` file
- **Cloud PostgreSQL**: Set `DATABASE_TYPE=postgres` with a valid `DATABASE_URL`

**Note**: Data doesn't transfer automatically between databases. If you switch, you'll need to recreate your accounts and goals.

---

## 🌐 Deploying So Friends Can Access

Once you have a cloud database, you can:

1. **Deploy to a hosting service**:
   - [Railway](https://railway.app) - Easy deployment
   - [Render](https://render.com) - Free tier
   - [Heroku](https://heroku.com) - Popular option
   - [Fly.io](https://fly.io) - Global distribution

2. **Share the URL** with your friends (e.g., `https://your-app.railway.app`)

3. **Friends create accounts** - all data is saved in the shared cloud database!

---

## ✅ Verification

After setup, test that everything works:

1. Create a test account
2. Add a goal
3. Log completion
4. Check the leaderboard

If you see data persisting and can create multiple accounts, the cloud database is working! 🎉

---

## 🆘 Troubleshooting

**"Database connection failed"**
- Check your `DATABASE_URL` is correct
- Ensure `DATABASE_SSL=true` for cloud databases
- Verify your database is running

**"Table doesn't exist"**
- The app auto-creates tables on startup
- Check the console for initialization errors

**"Friends can't connect"**
- Make sure your server is deployed publicly
- Check firewall settings allow database connections
- Verify the database allows connections from your server IP

---

Need help? Check your database provider's documentation or reach out!
