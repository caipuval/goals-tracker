# Deploy Goals Tracker to Render.com (FREE)

## Quick Steps to Make Your App Public

### 1. Create a Render Account
1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your email if needed

### 2. Connect Your GitHub Repository
1. In Render dashboard, click "New +" → "Web Service"
2. Connect your GitHub account if not already connected
3. Select your repository (the one with this Goals Tracker code)
4. Choose the branch (usually `main` or `master`)

### 3. Configure the Web Service
- **Name:** `goals-tracker` (or any name you like)
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** Select **Free** (or paid if you want)

### 4. Set Environment Variables
Click "Advanced" → "Add Environment Variable" and add:

```
DATABASE_TYPE = postgres
DATABASE_SSL = true
DATABASE_URL = [Your Supabase Connection Pooling URL]
```

**To get your Supabase Connection URL:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to "Settings" → "Database"
4. Scroll to "Connection Pooling"
5. Copy the "Connection string" (it should look like: `postgresql://postgres.xxx:5432/postgres?pgbouncer=true`)
6. Replace `[YOUR-PASSWORD]` with your actual database password
7. Paste it as the `DATABASE_URL` value in Render

### 5. Deploy
1. Click "Create Web Service"
2. Render will automatically build and deploy your app
3. Wait 2-5 minutes for the build to complete
4. Your app will be live at: `https://your-app-name.onrender.com`

### 6. Share Your App
- Share the URL with your friends: `https://your-app-name.onrender.com`
- Everyone can create accounts and use the app
- All data is saved in your Supabase database forever

## Important Notes

- **Free tier limitations:** Render free tier spins down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds to wake up.
- **Database:** Your Supabase database is already set up and will work immediately
- **Custom Domain:** You can add a custom domain later in Render settings (optional)

## Troubleshooting

- **Build fails:** Check the build logs in Render dashboard
- **Database connection error:** Verify your `DATABASE_URL` is correct and uses the connection pooling URL
- **App not loading:** Check the service logs in Render dashboard

## Alternative: Deploy to Fly.io (Also Free)

If Render doesn't work, you can use Fly.io:
1. Install Fly CLI: `npm install -g @fly/cli`
2. Run: `fly launch`
3. Follow the prompts
4. Set environment variables: `fly secrets set DATABASE_TYPE=postgres DATABASE_SSL=true DATABASE_URL=your-supabase-url`
