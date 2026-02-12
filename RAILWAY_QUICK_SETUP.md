# 🚂 Railway Database Setup (Easiest Option!)

## Step-by-Step (5 minutes)

### 1. Sign Up
- Go to [railway.app](https://railway.app)
- Click **"Start a New Project"**
- Sign up with **GitHub** (easiest - one click)

### 2. Create PostgreSQL Database
- Click **"New Project"**
- Click **"Provision PostgreSQL"** (it's a template/button)
- Wait 30 seconds - Railway creates your database automatically!

### 3. Get Your Connection String
- Click on your PostgreSQL database
- Go to the **"Variables"** tab
- Find **`DATABASE_URL`** - this is your connection string!
- Click the **copy icon** 📋 to copy it

It looks like:
```
postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
```

### 4. Create `.env` File
In your project folder, create a file named `.env` (no extension!) with:

```env
DATABASE_TYPE=postgres
DATABASE_URL=paste_your_connection_string_here
DATABASE_SSL=true
```

**Example:**
```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://postgres:abc123@containers-us-west-123.railway.app:5432/railway
DATABASE_SSL=true
```

### 5. Install & Start
```bash
npm install
npm start
```

### 6. Verify It Works! ✅
You should see:
```
✅ PostgreSQL database initialized
🚀 Goals Tracker running on http://localhost:3000
📊 Using POSTGRES database
```

**Done!** Your friends can now use the app and all data is saved in the cloud! 🎉

---

## 🎁 Free Tier
- **512 MB RAM** - plenty for your app
- **$5 free credit/month** - enough for small projects
- **No credit card required** initially

---

## 💡 Tips
- The database URL has your password in it - keep `.env` secret!
- Railway databases persist even if you stop the project
- You can view your data in Railway's dashboard

---

## 🆘 Troubleshooting

**"Can't connect" error?**
- Check your `.env` file has all 3 lines
- Make sure `DATABASE_SSL=true`
- Copy the ENTIRE connection string

**"Table doesn't exist"?**
- The app creates tables automatically on first start
- Check console for errors

---

That's it! Railway is the easiest because it does everything for you! 🚀
