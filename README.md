# 🎯 Goals Tracker - Premium

A sleek, black-themed daily goals tracking web application with competitive features. Track your daily, weekly, and monthly goals, monitor progress, and compete with friends!

## ✨ Features

- **Premium Black UI** - Modern, elegant dark interface
- **Interactive Calendar** - Visual overview of your goals and completions
- **Multi-tier Goals** - Create daily, weekly, and monthly goals
- **Progress Tracking** - Automatic aggregation of daily completions into weekly/monthly progress
- **Leaderboard** - Compete with friends and see who's crushing their goals
- **Time Tracking** - Monitor total time spent on goals
- **User Accounts** - Secure login and registration system

## 🚀 Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## 📖 How to Use

### 1. Create an Account

- Click on the "Register" tab
- Enter a username and password
- Click "Create Account"

### 2. Create Your First Goal

- Click the "+ New Goal" button in the sidebar
- Fill in the goal details:
  - **Title**: Name of your goal (e.g., "Reading")
  - **Description**: Optional details
  - **Duration**: Time in minutes (e.g., 15 for daily reading)
  - **Type**: Choose Daily, Weekly, or Monthly
  - **Start Date**: When to begin tracking
- Click "Create Goal"

### 3. Track Your Progress

#### Using the Calendar View:
- Click on any date to see goals for that day
- View total time required and completed
- Mark goals as complete by clicking "Complete Today"

#### Using the Goals View:
- See all your goals at once
- Filter by type (All, Daily, Weekly, Monthly)
- View progress bars showing completion percentage
- Delete goals you no longer need

### 4. Compete with Friends

- Invite friends to create accounts
- Check the Leaderboard to see rankings
- Filter by Today, This Week, or This Month
- Watch as daily completions count toward weekly/monthly goals!

## 🎯 Goal Types Explained

### Daily Goals
Example: "Read for 15 minutes"
- Set a daily target
- Complete it each day
- Progress resets daily

### Weekly Goals
Example: "Read for 2 hours (120 minutes)"
- Set a weekly target
- Each daily completion adds to the weekly total
- If you read 15 minutes/day, you'll see: 15min/120min, 30min/120min, etc.
- Progress resets each Monday

### Monthly Goals
Example: "Read for 8 hours (480 minutes)"
- Set a monthly target
- All completions within the month add up
- Progress resets on the 1st of each month

## 🔧 Technical Details

### Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcryptjs for password hashing
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Styling**: Custom CSS with modern animations

### Project Structure

```
Goals Tracker/
├── server.js           # Express server and API routes
├── package.json        # Dependencies and scripts
├── goals.db           # SQLite database (created automatically)
└── public/
    ├── index.html     # Main HTML file
    ├── style.css      # Premium black UI styles
    └── app.js         # Frontend application logic
```

### API Endpoints

- `POST /api/register` - Create new user
- `POST /api/login` - Authenticate user
- `GET /api/users` - Get all users
- `POST /api/goals` - Create new goal
- `GET /api/goals/:userId` - Get user's goals
- `POST /api/goals/:goalId/complete` - Mark goal completion
- `GET /api/goals/:goalId/completions` - Get goal completions
- `DELETE /api/goals/:goalId` - Delete goal
- `GET /api/leaderboard` - Get leaderboard data

## 🎨 UI Features

- Responsive design for mobile and desktop
- Smooth animations and transitions
- Color-coded progress indicators
- Visual calendar with completion dots
- Real-time progress bars
- Premium gradient accents

## 🏆 Leaderboard System

The leaderboard ranks users based on:
1. Number of goals completed
2. Total time spent (tiebreaker)

Top 3 positions get special medal colors:
- 🥇 Gold
- 🥈 Silver
- 🥉 Bronze

## 💡 Tips

1. **Start Small**: Begin with achievable daily goals
2. **Be Consistent**: Complete daily goals to build weekly/monthly progress
3. **Compete Friendly**: Use the leaderboard as motivation, not pressure
4. **Review Progress**: Check your calendar weekly to see patterns
5. **Adjust Goals**: Delete or modify goals that aren't working for you

## 🔒 Security

- Passwords are hashed using bcryptjs
- User sessions managed via localStorage
- SQL injection protection through prepared statements

## 🐛 Troubleshooting

**Server won't start:**
- Ensure port 3000 is not in use
- Check that all dependencies are installed (`npm install`)

**Can't create account:**
- Username must be unique
- Check that the database has write permissions

**Goals not showing:**
- Ensure you're logged in
- Check the date range of your goals
- Try refreshing the page

## 📝 Future Enhancements

- Goal categories and tags
- Habit streaks visualization
- Export data to CSV
- Email reminders
- Mobile app version
- Social features (comments, reactions)
- Goal templates library

## 👥 Multi-User Competition

To set up friendly competition:

1. Share the application URL with friends
2. Each person creates their own account
3. Everyone creates and tracks their goals
4. Check the Leaderboard daily/weekly to see rankings
5. Motivate each other to stay consistent!

---

Built with ⚡ by the Goals Tracker Team

**Stay focused. Stay consistent. Achieve excellence.**
