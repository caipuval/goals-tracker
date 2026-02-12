# 🎯 Next Steps After Clicking "Database" on Railway

## Step 1: Click "Database" ✅
- On Railway's "New project" page, click the **"Database"** option
- Railway will ask which database - choose **PostgreSQL**

## Step 2: Wait for Railway to Create It
- Takes about 30 seconds
- You'll see a progress indicator

## Step 3: Get Your Connection String
Once the database is created:

1. **Click on the PostgreSQL service** in your project
2. Go to the **"Variables"** tab (or "Data" tab)
3. Find the variable called **`DATABASE_URL`**
4. **Click the copy icon** 📋 next to it

The connection string looks like:
```
postgresql://postgres:yourpassword@containers-us-west-123.railway.app:5432/railway
```

## Step 4: Create `.env` File in Your Project
Back in your project folder, create a file named `.env` (exactly that name, no extension!)

Paste this (replace with YOUR connection string):
```env
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
DATABASE_SSL=true
```

**Important:** Replace the entire `DATABASE_URL` line with the one you copied from Railway!

## Step 5: Install Dependencies & Start
```bash
npm install
npm start
```

## Step 6: Verify It Works! ✅
Look for this in your terminal:
```
✅ PostgreSQL database initialized
🚀 Goals Tracker running on http://localhost:3000
📊 Using POSTGRES database
```

---

## 🆘 Can't Find `DATABASE_URL`?

If you don't see it in Variables:
1. Click on the database service
2. Look for a tab called **"Connect"** or **"Connection Info"**
3. Or look in the **"Settings"** tab
4. Railway should show the connection string somewhere!

---

## 💡 Quick Tip
Once you paste the connection string into `.env`, your friends' data will all be saved in the same cloud database! 🎉
