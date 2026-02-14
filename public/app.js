// API Base URL
const API_URL = window.location.origin;

// State
let currentUser = null;
let currentView = 'calendar';
let currentMonth = new Date();
let selectedDate = null;
let contextDate = null; // The date selected in calendar that acts as "today" for other views
let allGoals = [];
let currentFilter = 'all';
let selectedFriendId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    
    // Check for pending invitations periodically
    setInterval(() => {
        if (currentUser) {
            checkPendingInvitations();
        }
    }, 30000); // Check every 30 seconds
    
    // Default goal date is set when opening the modal (based on selected calendar date)
});

// Auth Functions
function checkAuth() {
    const user = localStorage.getItem('user');
    if (user) {
        currentUser = JSON.parse(user);
        showApp();
    } else {
        showAuth();
    }
}

function showAuth() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

function showApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('username-display').textContent = currentUser.username;
    startClock();
    checkMidnightAutoFail();
    
    // Set both period selectors to "today" by default
    const goalsPeriod = document.getElementById('goals-period');
    const statisticsPeriod = document.getElementById('statistics-period');
    if (goalsPeriod && !goalsPeriod.value) goalsPeriod.value = 'today';
    if (statisticsPeriod && !statisticsPeriod.value) statisticsPeriod.value = 'today';
    
    loadGoals();
    
    // Set today as selected by default
    const today = new Date();
    selectedDate = today;
    contextDate = today;
    
    renderCalendar();
    loadLeaderboard();
}

// Event Listeners
function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tabName}-form`).classList.add('active');
        });
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = { id: data.userId, username: data.username, email: data.email };
                localStorage.setItem('user', JSON.stringify(currentUser));
                showApp();
            } else {
                showError('login-error', data.error);
            }
        } catch (error) {
            showError('login-error', 'Connection error. Please try again.');
        }
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value.trim();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        
        // Basic client-side validation
        if (!email || !username || !password) {
            showError('register-error', 'Please fill in all fields');
            return;
        }
        
        if (password.length < 6) {
            showError('register-error', 'Password must be at least 6 characters');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = { id: data.userId, username, email };
                localStorage.setItem('user', JSON.stringify(currentUser));
                showApp();
            } else {
                showError('register-error', data.error);
            }
        } catch (error) {
            showError('register-error', 'Connection error. Please try again.');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        currentUser = null;
        showAuth();
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // Friends
    document.getElementById('add-friend-btn')?.addEventListener('click', async () => {
        await sendFriendRequestFromUI();
    });
    document.getElementById('add-friend-username')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            await sendFriendRequestFromUI();
        }
    });

    // Calendar controls
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('close-details').addEventListener('click', () => {
        document.getElementById('day-details').style.display = 'none';
        // Keep the selected date highlighted; just hide the details panel.
    });

    // Goal modal
    document.getElementById('new-goal-btn').addEventListener('click', () => {
        openGoalModal();
    });

    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-goal').addEventListener('click', closeModal);

    document.getElementById('goal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createGoal();
    });

    // Time unit toggles
    document.querySelectorAll('.time-unit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.time-unit-toggle');
            group.querySelectorAll('.time-unit-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Complete modal
    document.getElementById('close-complete-modal').addEventListener('click', closeCompleteModal);
    document.getElementById('cancel-complete').addEventListener('click', closeCompleteModal);
    
    document.getElementById('complete-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitCompletion();
    });

    // Complete modal time unit toggles - convert value when switching units
    // Use global variable to store base value in minutes
    if (typeof window.baseMinutes === 'undefined') {
        window.baseMinutes = 0;
    }
    
    document.querySelectorAll('#complete-modal .time-unit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const group = e.target.closest('.time-unit-toggle');
            const durationInput = document.getElementById('complete-duration');
            const currentValue = parseFloat(durationInput.value);
            
            // Get the currently active unit BEFORE we change it
            const currentlyActive = group.querySelector('.time-unit-btn.active');
            const currentUnit = currentlyActive ? currentlyActive.dataset.unit : null;
            const newUnit = e.target.dataset.unit;
            
            console.log('Unit button clicked:', {
                currentUnit: currentUnit,
                newUnit: newUnit,
                currentValue: currentValue,
                baseMinutes: window.baseMinutes
            });
            
            // Update baseMinutes from current value if we're switching units and have a value
            // This handles cases where user edited the value
            if (!isNaN(currentValue) && currentValue > 0 && currentUnit && currentUnit !== newUnit) {
                if (currentUnit === 'hours') {
                    // Current value is in hours, convert to minutes and update base
                    window.baseMinutes = Math.round(currentValue * 60);
                    console.log(`Updated baseMinutes: ${currentValue} hours = ${window.baseMinutes} minutes`);
                } else if (currentUnit === 'minutes') {
                    // Current value is already in minutes, update base
                    window.baseMinutes = Math.round(currentValue);
                    console.log(`Updated baseMinutes: ${currentValue} minutes`);
                }
            }
            
            // Update active state
            group.querySelectorAll('.time-unit-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Convert base minutes to the new unit - always use baseMinutes if available
            if (window.baseMinutes > 0) {
                if (newUnit === 'hours') {
                    durationInput.value = (window.baseMinutes / 60).toFixed(2);
                    console.log(`Displaying ${window.baseMinutes} minutes as ${(window.baseMinutes / 60).toFixed(2)} hours`);
                } else {
                    durationInput.value = window.baseMinutes;
                    console.log(`Displaying ${window.baseMinutes} minutes`);
                }
            } else if (!isNaN(currentValue) && currentValue > 0) {
                // Fallback: if no baseMinutes but we have a value, convert directly
                if (currentUnit === 'hours' && newUnit === 'minutes') {
                    const converted = Math.round(currentValue * 60);
                    durationInput.value = converted;
                    window.baseMinutes = converted; // Store for future conversions
                    console.log(`Fallback: ${currentValue} hours = ${converted} minutes`);
                } else if (currentUnit === 'minutes' && newUnit === 'hours') {
                    const converted = (currentValue / 60).toFixed(2);
                    durationInput.value = converted;
                    window.baseMinutes = Math.round(currentValue); // Store for future conversions
                    console.log(`Fallback: ${currentValue} minutes = ${converted} hours`);
                }
            }
        });
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentFilter = tab.dataset.filter;
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderGoalsList();
        });
    });

    // Leaderboard period
    document.getElementById('leaderboard-period').addEventListener('change', loadLeaderboard);

    // Statistics period - sync with goals period
    document.getElementById('statistics-period').addEventListener('change', (e) => {
        const period = e.target.value;
        // Sync goals period to match
        document.getElementById('goals-period').value = period;
        loadStatistics();
        renderGoalsList();
    });

    // Goals period - sync with statistics period
    document.getElementById('goals-period').addEventListener('change', (e) => {
        const period = e.target.value;
        // Sync statistics period to match
        document.getElementById('statistics-period').value = period;
        renderGoalsList();
        loadStatistics();
    });

    // Competition buttons
    const createCompetitionBtn = document.getElementById('create-competition-btn');
    const competitionModal = document.getElementById('competition-modal');
    const closeCompetitionModal = document.getElementById('close-competition-modal');
    const cancelCompetition = document.getElementById('cancel-competition');
    const competitionForm = document.getElementById('competition-form');
    
    document.addEventListener('click', (e) => {
        if (e.target.closest('#create-competition-btn')) {
            e.preventDefault();
            const modal = document.getElementById('competition-modal');
            if (modal) modal.classList.add('active');
        }
    });
    if (closeCompetitionModal) {
        closeCompetitionModal.addEventListener('click', () => {
            if (competitionModal) competitionModal.classList.remove('active');
        });
    }
    if (cancelCompetition) {
        cancelCompetition.addEventListener('click', () => {
            if (competitionModal) competitionModal.classList.remove('active');
        });
    }
    if (competitionForm) {
        competitionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createCompetition();
        });
    }

    const editCompetitionModal = document.getElementById('edit-competition-modal');
    const closeEditCompetitionModal = document.getElementById('close-edit-competition-modal');
    const cancelEditCompetition = document.getElementById('cancel-edit-competition');
    document.getElementById('edit-competition-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveEditCompetition();
    });
    if (closeEditCompetitionModal) closeEditCompetitionModal.addEventListener('click', () => editCompetitionModal?.classList.remove('active'));
    if (cancelEditCompetition) cancelEditCompetition.addEventListener('click', () => editCompetitionModal?.classList.remove('active'));

    // Leave/Delete competition
    document.getElementById('leave-competition-btn')?.addEventListener('click', leaveCompetition);
    document.getElementById('delete-competition-btn')?.addEventListener('click', deleteCompetition);
    // Invite to competition
    document.getElementById('invite-competition-btn')?.addEventListener('click', () => {
        if (!currentCompetition) {
            showErrorModal('No Competition', 'No active competition found.');
            return;
        }
        document.getElementById('invite-competition-modal').classList.add('active');
        document.getElementById('invite-username').value = '';
        document.getElementById('invite-username').focus();
    });
    document.getElementById('close-invite-modal')?.addEventListener('click', () => {
        document.getElementById('invite-competition-modal').classList.remove('active');
    });
    document.getElementById('cancel-invite')?.addEventListener('click', () => {
        document.getElementById('invite-competition-modal').classList.remove('active');
    });
    document.getElementById('invite-competition-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendCompetitionInvite();
    });
    
    document.getElementById('add-competition-time-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('log-competition-modal');
        modal.classList.add('active');
        modal.dataset.mode = 'add';
        modal.querySelector('h2').textContent = 'Add Competition Time';
        modal.querySelector('button[type="submit"]').textContent = 'Add Time';
    });
    
    document.getElementById('remove-competition-time-btn')?.addEventListener('click', () => {
        console.log('Remove time button clicked');
        const modal = document.getElementById('log-competition-modal');
        if (!modal) {
            console.error('Modal not found!');
            return;
        }
        modal.classList.add('active');
        modal.dataset.mode = 'remove';
        const title = modal.querySelector('h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (title) title.textContent = 'Remove Competition Time';
        if (submitBtn) submitBtn.textContent = 'Remove Time';
        console.log('Modal opened in remove mode');
    });
    document.getElementById('join-competition-btn')?.addEventListener('click', async () => {
        await joinCompetition();
    });
    document.getElementById('close-log-competition-modal')?.addEventListener('click', () => {
        document.getElementById('log-competition-modal').classList.remove('active');
    });
    document.getElementById('cancel-log-competition')?.addEventListener('click', () => {
        document.getElementById('log-competition-modal').classList.remove('active');
    });
    document.getElementById('log-competition-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await logCompetitionTime();
    });
    document.querySelectorAll('#log-competition-modal .time-unit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.time-unit-toggle');
            group.querySelectorAll('.time-unit-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
    
    // Participant details modal
    const closeParticipantModal = document.getElementById('close-participant-modal');
    if (closeParticipantModal) {
        closeParticipantModal.addEventListener('click', () => {
            document.getElementById('participant-details-modal').classList.remove('active');
        });
    }
}

async function leaveCompetition() {
    try {
        if (!currentCompetition?.id) return;
        if (!currentUser?.id) return;
        if (!confirm('Leave this competition? Your competition time logs will be removed from this competition.')) return;

        const response = await fetch(`${API_URL}/api/competition/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, competitionId: currentCompetition.id })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            showErrorModal('Unable to Leave', data.error || 'Failed to leave competition.');
            return;
        }
        showSuccessModal('Left Competition', 'You have left the competition successfully.');
        currentCompetition = null;
        await loadCompetitionsList();
        document.getElementById('competition-detail').style.display = 'none';
    } catch (e) {
        console.error('leaveCompetition error', e);
        showErrorModal('Error', 'Failed to leave competition.');
    }
}

async function deleteCompetition() {
    try {
        if (!currentCompetition?.id) return;
        if (!currentUser?.id) return;
        if (!confirm('Delete this competition? This cannot be undone.')) return;

        const response = await fetch(`${API_URL}/api/competition/${currentCompetition.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            showErrorModal('Unable to Delete', data.error || 'Failed to delete competition.');
            return;
        }
        showSuccessModal('Competition Deleted', 'The competition has been deleted.');
        currentCompetition = null;
        await loadCompetitionsList();
        document.getElementById('competition-detail').style.display = 'none';
    } catch (e) {
        console.error('deleteCompetition error', e);
        showErrorModal('Error', 'Failed to delete competition.');
    }
}

function getEffectiveSelectedDate() {
    // Prefer the explicitly selected calendar date; fall back to "context" date; then real today.
    const base = selectedDate || contextDate || new Date();
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    return d;
}

function openGoalModal() {
    // Default the goal date to the selected calendar day (supports future dates).
    const goalDate = getEffectiveSelectedDate();
    const goalStartInput = document.getElementById('goal-start-date');
    if (goalStartInput) {
        goalStartInput.value = formatDate(goalDate);
    }
    document.getElementById('goal-modal').classList.add('active');
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('show');
    setTimeout(() => errorElement.classList.remove('show'), 5000);
}

function switchView(view) {
    currentView = view;
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    document.getElementById(`${view}-view`).classList.add('active');
    
    // Load data if needed
    if (view === 'leaderboard') {
        loadLeaderboard();
    } else if (view === 'goals') {
        renderGoalsList();
    } else if (view === 'statistics') {
        loadStatistics();
    } else if (view === 'competition') {
        loadCompetitionsList();
    } else if (view === 'friends') {
        loadFriendsData();
    }
}

// Calendar Functions
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Update month display
    document.getElementById('current-month').textContent = 
        currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Day headers
    // Europe-friendly week: Monday → Sunday
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendar.appendChild(header);
    });
    
    // Get first day of month
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    // JS getDay(): Sun=0..Sat=6. Convert so Mon=0..Sun=6.
    const startDay = (firstDay.getDay() + 6) % 7;
    
    // Previous month days
    const prevMonthLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, day);
        calendar.appendChild(createDayElement(date, true));
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        calendar.appendChild(createDayElement(date, false));
    }
    
    // Next month days
    const remainingDays = 42 - (startDay + lastDay.getDate());
    for (let day = 1; day <= remainingDays; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day);
        calendar.appendChild(createDayElement(date, true));
    }
}

function createDayElement(date, otherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (otherMonth) {
        dayElement.classList.add('other-month');
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);
    
    if (dateNormalized.getTime() === today.getTime()) {
        dayElement.classList.add('today');
        // If no date is selected yet, select today
        if (!selectedDate) {
            selectedDate = date;
            contextDate = date;
        }
    }
    
    if (selectedDate) {
        const selectedNormalized = new Date(selectedDate);
        selectedNormalized.setHours(0, 0, 0, 0);
        if (dateNormalized.getTime() === selectedNormalized.getTime()) {
            dayElement.classList.add('selected');
        }
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = date.getDate();
    dayElement.appendChild(dayNumber);
    
    // Add indicator for goals (checkmark for completed, X for failed)
    const dateStr = formatDate(date);
    const dayGoals = getGoalsForDate(dateStr);
    
    if (dayGoals.length > 0) {
        const indicator = document.createElement('div');
        indicator.className = 'calendar-day-indicator';
        
        const completedCount = dayGoals.filter(g => g.completed).length;
        const failedCount = dayGoals.filter(g => g.failed && !g.completed).length; // Only count failed if NOT completed
        const totalCount = dayGoals.length;
        
        // If all goals are completed, show checkmark
        if (completedCount === totalCount && totalCount > 0) {
            indicator.innerHTML = '✓';
            indicator.classList.add('calendar-checkmark');
            dayElement.appendChild(indicator);
        } 
        // If any goals failed (past date with no completion), show X
        // Only show X if there are actually failed goals that are NOT completed
        else if (failedCount > 0) {
            indicator.innerHTML = '✗';
            indicator.classList.add('calendar-x');
            dayElement.appendChild(indicator);
        }
        // If there are goals but none completed and none failed (future dates or incomplete but not failed), show nothing
    }
    
    dayElement.addEventListener('click', () => {
        selectedDate = date;
        contextDate = date; // Set context date for other views
        renderCalendar();
        showDayDetails(date);
        // If we're on goals view, refresh it with new context
        if (currentView === 'goals') {
            renderGoalsList();
        }
    });
    
    return dayElement;
}

function getGoalsForDate(dateStr) {
    const checkDate = parseYMDToLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!checkDate) return [];
    checkDate.setHours(0, 0, 0, 0);
    
    return allGoals.filter(goal => {
        const goalStart = parseYMDToLocalDate(goal.start_date);
        if (!goalStart) return false;
        goalStart.setHours(0, 0, 0, 0);
        const goalEnd = goal.end_date ? parseYMDToLocalDate(goal.end_date) : null;
        if (goalEnd) goalEnd.setHours(0, 0, 0, 0);
        
        // Check if this date falls within the goal's date range
        if (checkDate < goalStart) return false;
        if (goalEnd && checkDate > goalEnd) return false;
        
        // For daily goals, check if this specific day should have the goal
        if (goal.type === 'daily') {
            // Daily goals are active every day from start_date to end_date
            return true;
        }
        
        // For one-time goals, only active on the start_date
        if (goal.type === 'one-time') {
            return checkDate.getTime() === goalStart.getTime();
        }
        
        // For weekly/monthly, check if date falls within the period
        // This is already handled by the date range check above
        return true;
    }).map(goal => {
        // Check for completion - try exact match first, then try date comparison
        let completion = goal.completions?.find(c => c.completion_date === dateStr);
        
        // If no exact match, try comparing dates (in case of format differences)
        if (!completion && goal.completions) {
            const checkDateObj = parseYMDToLocalDate(dateStr);
            if (checkDateObj) {
                checkDateObj.setHours(0, 0, 0, 0);
                completion = goal.completions.find(c => {
                    const compDate = parseYMDToLocalDate(c.completion_date);
                    if (!compDate) return false;
                    compDate.setHours(0, 0, 0, 0);
                    return compDate.getTime() === checkDateObj.getTime();
                });
            }
        }
        
        const isCompleted = !!completion;
        
        // Determine if goal failed (should have been completed but wasn't)
        // IMPORTANT: If goal IS completed, it can NEVER be failed
        let isFailed = false;
        if (!isCompleted && checkDate < today) {
            if (goal.type === 'daily') {
                // Daily goal: failed if it was active on this past date and not completed
                isFailed = true;
            } else if (goal.type === 'one-time') {
                // One-time goal: only failed if this IS the goal's date and it's past
                const goalStart = parseYMDToLocalDate(goal.start_date);
                if (goalStart) {
                    goalStart.setHours(0, 0, 0, 0);
                    if (checkDate.getTime() === goalStart.getTime()) {
                        isFailed = true; // One-time goal failed if not completed on its exact date
                    }
                }
            }
            // Weekly/monthly goals: don't mark as failed for individual days
            // They're evaluated over the entire period
        }
        
        return {
            ...goal,
            completed: isCompleted,
            failed: isFailed,
            completedMinutes: completion?.duration_minutes || 0
        };
    });
}

async function showDayDetails(date) {
    const dateStr = formatDate(date);
    const dayGoals = getGoalsForDate(dateStr);
    
    document.getElementById('selected-date').textContent = 
        date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const goalsList = document.getElementById('day-goals-list');
    goalsList.innerHTML = '';
    
    if (dayGoals.length === 0) {
        goalsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>No goals for this day</h3>
                <p>Create a new goal to get started!</p>
            </div>
        `;
    } else {
        const totalMinutes = dayGoals.reduce((sum, g) => sum + (g.duration_minutes || 0), 0);
        const completedMinutes = dayGoals.reduce((sum, g) => sum + (g.completedMinutes || 0), 0);
        const goalsWithTime = dayGoals.filter(g => g.duration_minutes);
        
        goalsList.innerHTML = `
            ${goalsWithTime.length > 0 ? `
            <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Total Time</div>
                <div style="font-size: 24px; font-weight: 700;">
                    ${formatTime(completedMinutes)} / ${formatTime(totalMinutes)}
                </div>
            </div>
            ` : ''}
        `;
        
        dayGoals.forEach(goal => {
            const card = createGoalCard(goal, dateStr);
            goalsList.appendChild(card);
        });
    }
    
    document.getElementById('day-details').style.display = 'block';
}

function createGoalCard(goal, dateStr = null) {
    const card = document.createElement('div');
    card.className = 'goal-card';
    
    // Ensure completions is always an array
    if (!goal.completions || !Array.isArray(goal.completions)) {
        goal.completions = [];
    }
    
    const progress = calculateGoalProgress(goal);
    const hasDuration = goal.duration_minutes !== null && goal.duration_minutes !== undefined;
    const hasLoggedTime = progress.hasLoggedTime || false;
    const completion = goal.completions?.find(c => c.completion_date === dateStr);
    const isCompleted = !!completion;
    
    // For My Goals view (when dateStr is null), use context date or actual today
    const effectiveDate = contextDate || new Date();
    const effectiveDateStr = dateStr || formatDate(effectiveDate);
    const effectiveCompletion = goal.completions?.find(c => c.completion_date === effectiveDateStr);
    const isCompletedToday = !!effectiveCompletion;
    
    // Format duration display
    let durationDisplay = '';
    if (hasDuration) {
        if (goal.duration_minutes >= 60) {
            const hours = Math.floor(goal.duration_minutes / 60);
            const mins = goal.duration_minutes % 60;
            durationDisplay = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        } else {
            durationDisplay = `${goal.duration_minutes}m`;
        }
    }
    
    // Show progress if goal has duration OR has logged time
    // For daily goals without duration, always show progress if there are any completions
    const shouldShowProgress = hasDuration || hasLoggedTime || (goal.type === 'daily' && goal.completions && goal.completions.length > 0);
    
    // Format dates (parse as local YYYY-MM-DD to avoid timezone shift)
    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        const s = (dateStr + '').trim().slice(0, 10);
        const [y, m, d] = s.split('-').map(Number);
        if (!y || !m || !d) return '';
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    
    const goalStartStr = (goal.start_date || '').toString().trim().slice(0, 10);
    const goalEndStr = (goal.end_date || goal.start_date || '').toString().trim().slice(0, 10);
    const dueLabel = goalStartStr === goalEndStr || !goalEndStr
        ? (goalStartStr ? `Due: ${formatDateDisplay(goalStartStr)}` : '')
        : `Due: ${formatDateDisplay(goalStartStr)} – ${formatDateDisplay(goalEndStr)}`;
    
    // Get latest completion date
    let completedDate = '';
    if (goal.completions && goal.completions.length > 0) {
        const latestCompletion = goal.completions.reduce((latest, c) => {
            return new Date(c.completion_date) > new Date(latest.completion_date) ? c : latest;
        }, goal.completions[0]);
        completedDate = formatDateDisplay(latestCompletion.completion_date);
    }
    
    card.innerHTML = `
        <div class="goal-card-header">
            <div>
                <div class="goal-card-title">${goal.title}</div>
                ${goal.description ? `<div class="goal-card-description">${goal.description}</div>` : ''}
                <div class="goal-card-dates">
                    ${dueLabel ? `<span class="goal-date-info">${dueLabel}</span>` : ''}
                    ${completedDate ? `<span class="goal-date-info">Completed: ${completedDate}</span>` : ''}
                </div>
            </div>
            <span class="goal-card-type">${goal.type === 'one-time' ? 'ONE-TIME' : goal.type.toUpperCase()}</span>
        </div>
        
        ${shouldShowProgress ? `
        <div class="goal-progress">
            <div class="goal-progress-bar">
                <div class="goal-progress-fill" style="width: ${hasDuration ? Math.min(progress.percentage, 100) : 100}%"></div>
            </div>
            <div class="goal-progress-text">
                ${hasDuration ? 
                    `<span>${formatTime(progress.completed)} / ${formatTime(progress.total)}</span>
                     <span>${Math.round(progress.percentage)}%</span>` :
                    `<span>Logged: ${formatTime(progress.completed)}</span>`
                }
            </div>
        </div>
        ` : ''}
        
        <div class="goal-actions">
            ${dateStr ? 
                `<button class="btn-complete ${isCompleted ? 'completed' : ''}" onclick="openCompleteModal(${goal.id}, '${dateStr}', ${goal.duration_minutes || 'null'}, ${completion ? completion.duration_minutes : 'null'})">
                    ${isCompleted ? `✓ Logged ${formatTime(completion.duration_minutes)}` : hasDuration ? `Log Time (Target: ${durationDisplay})` : 'Log Time'}
                </button>` : 
                `<button class="btn-complete ${isCompletedToday ? 'completed' : ''}" onclick="openCompleteModal(${goal.id}, '${effectiveDateStr}', ${goal.duration_minutes || 'null'}, ${effectiveCompletion ? effectiveCompletion.duration_minutes : 'null'})">
                    ${isCompletedToday ? `✓ Done - ${formatTime(effectiveCompletion.duration_minutes)}` : hasDuration ? `✓ Done (Target: ${durationDisplay})` : '✓ Done'}
                </button>`
            }
            <button class="btn-delete" onclick="deleteGoal(${goal.id})">Delete</button>
        </div>
    `;
    
    return card;
}

function formatTime(minutes) {
    // Convert to number if it's a string
    const mins = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
    if (!mins || isNaN(mins)) return '0m';
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
    return `${mins}m`;
}

// Clock Functions
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow - now;
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);
    
    const clockElement = document.getElementById('live-clock');
    if (clockElement) {
        const hoursStr = String(hoursLeft).padStart(2, '0');
        const minutesStr = String(minutesLeft).padStart(2, '0');
        const secondsStr = String(secondsLeft).padStart(2, '0');
        clockElement.innerHTML = `
            <span class="clock-label">Time Left:</span>
            <span class="clock-time">${hoursStr}:${minutesStr}:${secondsStr}</span>
        `;
    }
    
    // Check if it's midnight
    if (hoursLeft === 0 && minutesLeft === 0 && secondsLeft === 0) {
        checkMidnightAutoFail();
    }
}

async function checkMidnightAutoFail() {
    const today = formatDate(new Date());
    
    // Get all goals for the user
    try {
        const response = await fetch(`${API_URL}/api/goals/${currentUser.id}`);
        const goals = await response.json();

        // Normalize date fields (Postgres may return ISO timestamps)
        goals.forEach(g => {
            g.start_date = normalizeToLocalYMD(g.start_date);
            g.end_date = g.end_date ? normalizeToLocalYMD(g.end_date) : null;
        });
        
        for (let goal of goals) {
            // Check if goal should be completed today based on its type
            const shouldBeCompletedToday = shouldGoalBeCompletedToday(goal, today);
            
            if (shouldBeCompletedToday) {
                // Check if goal was completed today
                const completionsResponse = await fetch(`${API_URL}/api/goals/${goal.id}/completions`);
                const completions = await completionsResponse.json();
                completions.forEach(c => {
                    c.completion_date = normalizeToLocalYMD(c.completion_date);
                });
                const todayCompletion = completions.find(c => c.completion_date === today);
                
                if (!todayCompletion && goal.type !== 'one-time') {
                    // Goal was not completed - mark as failed (you can add a failed status in the database later)
                    console.log(`Goal "${goal.title}" failed - not completed by midnight`);
                    // Optionally: Update goal status or show notification
                }
            }
        }
        
        // Reload goals to refresh UI
        await loadGoals();
    } catch (error) {
        console.error('Error checking midnight auto-fail:', error);
    }
}

function shouldGoalBeCompletedToday(goal, today) {
    if (goal.type === 'one-time') {
        return goal.start_date === today;
    } else if (goal.type === 'daily') {
        return true; // Daily goals should be completed every day
    } else if (goal.type === 'weekly') {
        const todayDate = parseYMDToLocalDate(today);
        const startDate = parseYMDToLocalDate(goal.start_date);
        if (!todayDate || !startDate) return false;
        const daysDiff = Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff % 7 === 6; // End of week
    } else if (goal.type === 'monthly') {
        const todayDate = parseYMDToLocalDate(today);
        const startDate = parseYMDToLocalDate(goal.start_date);
        if (!todayDate || !startDate) return false;
        return todayDate.getDate() === startDate.getDate() && 
               todayDate.getMonth() !== startDate.getMonth();
    }
    return false;
}

// Activity Chart Function
function renderActivityChart(activities) {
    const canvas = document.getElementById('activity-chart');
    if (!canvas || activities.length === 0) {
        // Clear canvas if exists but no data
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width || 600, canvas.height || 350);
        }
        return;
    }
    
    // Wait a bit for canvas to be rendered properly
    setTimeout(() => {
        const ctx = canvas.getContext('2d');
        const containerWidth = canvas.parentElement ? canvas.parentElement.offsetWidth : 400;
        const chartSize = Math.min(containerWidth > 0 ? containerWidth : 400, 400);
        const width = canvas.width = chartSize;
        const height = canvas.height = chartSize;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const total = activities.reduce((sum, [_, minutes]) => {
        const mins = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
        return sum + mins;
    }, 0);
    if (total === 0) return;
    let currentAngle = -Math.PI / 2; // Start from top
    
    // Different purple shades for each segment
    const purpleShades = [
        '#a855f7', // Main accent purple
        '#9333ea', // Darker purple
        '#c084fc', // Lighter purple
        '#7c3aed', // Deep purple
        '#d8b4fe', // Very light purple
        '#8b5cf6', // Medium purple
        '#a78bfa', // Soft purple
        '#9d4edd', // Vibrant purple
        '#e9d5ff', // Pale purple
        '#6d28d9'  // Rich purple
    ];
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 50;
    const donutRadius = radius * 0.55; // Inner radius for donut chart
    
    // Draw donut chart with different purple shades
    activities.forEach(([activity, minutes], index) => {
        const minutesNum = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
        const sliceAngle = (minutesNum / total) * 2 * Math.PI;
        const baseColor = purpleShades[index % purpleShades.length];
        
        // Create gradient for each slice with different purple shade
        const gradient = ctx.createLinearGradient(
            centerX + Math.cos(currentAngle) * radius,
            centerY + Math.sin(currentAngle) * radius,
            centerX + Math.cos(currentAngle + sliceAngle) * radius,
            centerY + Math.sin(currentAngle + sliceAngle) * radius
        );
        
        // Use the base color with slight variation for gradient
        const lighterShade = purpleShades[index % purpleShades.length];
        const darkerShade = purpleShades[(index + 1) % purpleShades.length];
        gradient.addColorStop(0, lighterShade + 'CC'); // Slightly transparent
        gradient.addColorStop(0.5, baseColor);
        gradient.addColorStop(1, darkerShade + 'DD');
        
        // Draw outer arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.lineTo(
            centerX + Math.cos(currentAngle + sliceAngle) * donutRadius,
            centerY + Math.sin(currentAngle + sliceAngle) * donutRadius
        );
        ctx.arc(centerX, centerY, donutRadius, currentAngle + sliceAngle, currentAngle, true);
        ctx.closePath();
        
        // Add shadow
        ctx.shadowColor = baseColor + '80';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Draw white border between slices
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Only draw labels for larger slices (more than 10% of chart)
        if (sliceAngle > 0.2) {
            const labelAngle = currentAngle + sliceAngle / 2;
            const labelRadius = radius + 30; // Position labels outside the chart
            const labelX = centerX + Math.cos(labelAngle) * labelRadius;
            const labelY = centerY + Math.sin(labelAngle) * labelRadius;
            
            // Draw connecting line from slice to label
            const lineStartX = centerX + Math.cos(labelAngle) * radius;
            const lineStartY = centerY + Math.sin(labelAngle) * radius;
            ctx.strokeStyle = baseColor + '60';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(labelX, labelY);
            ctx.stroke();
            
            // Text with white stroke for visibility (no black background)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            
            // Activity name
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeText(activity, labelX, labelY - 8);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(activity, labelX, labelY - 8);
            
            // Time
            ctx.font = '11px sans-serif';
            ctx.strokeText(formatTime(minutesNum), labelX, labelY + 8);
            ctx.fillStyle = baseColor;
            ctx.fillText(formatTime(minutesNum), labelX, labelY + 8);
        }
        
        currentAngle += sliceAngle;
    });
    
    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, donutRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#141414';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw total time in center
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Total', centerX, centerY - 6);
    ctx.fillStyle = '#a855f7';
    ctx.font = '18px sans-serif';
    ctx.fillText(formatTime(total), centerX, centerY + 14);
    }, 100);
    
    // Create HTML legend below chart
    const container = canvas.parentElement;
    if (container) {
        // Remove existing legend if any
        const existingLegend = container.querySelector('.activity-chart-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Create new legend
        const legend = document.createElement('div');
        legend.className = 'activity-chart-legend';
        
        activities.forEach(([activity, minutes], index) => {
            const minutesNum = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
            const color = purpleColors[index % purpleColors.length];
            
            const legendItem = document.createElement('div');
            legendItem.className = 'activity-legend-item';
            legendItem.innerHTML = `
                <div class="activity-legend-color" style="background: ${color}"></div>
                <div class="activity-legend-text">
                    <span class="activity-legend-name">${activity}</span>
                    <span class="activity-legend-time">${formatTime(minutesNum)}</span>
                </div>
            `;
            legend.appendChild(legendItem);
        });
        
        container.appendChild(legend);
    }
}

function calculateGoalProgress(goal) {
    let totalMinutes = goal.duration_minutes || 0;
    let completedMinutes = 0;
    
    // Calculate total logged time from all completions
    // Always sum all completions regardless of goal type
    if (goal.completions && goal.completions.length > 0) {
        completedMinutes = goal.completions.reduce((sum, c) => {
            const mins = c.duration_minutes || 0;
            return sum + (typeof mins === 'number' ? mins : parseInt(mins, 10) || 0);
        }, 0);
    }
    
    // If goal has no initial duration but has logged time, use logged time as total
    if (!goal.duration_minutes && completedMinutes > 0) {
        totalMinutes = completedMinutes; // Show total logged time
    }
    
    // Allow percentage to go over 100%
    const percentage = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;
    
    return {
        total: totalMinutes,
        completed: completedMinutes,
        percentage: percentage, // Can be over 100%
        hasLoggedTime: completedMinutes > 0 // Track if time has been logged
    };
}

// Goals Functions
async function loadGoals() {
    try {
        console.log('=== LOADING GOALS ===');
        const response = await fetch(`${API_URL}/api/goals/${currentUser.id}`);
        const goals = await response.json();
        console.log('Loaded goals:', goals);

        // Normalize goal date fields coming from the API (Postgres may return ISO timestamps)
        goals.forEach(g => {
            g.start_date = normalizeToLocalYMD(g.start_date);
            g.end_date = g.end_date ? normalizeToLocalYMD(g.end_date) : null;
        });
        
        // Load completions for each goal
        for (let goal of goals) {
            try {
                console.log(`Loading completions for goal ${goal.id} (${goal.title})...`);
                const completionsResponse = await fetch(`${API_URL}/api/goals/${goal.id}/completions`);
                const completions = await completionsResponse.json();
                goal.completions = Array.isArray(completions) ? completions : [];
                // Normalize completion dates too
                goal.completions.forEach(c => {
                    c.completion_date = normalizeToLocalYMD(c.completion_date);
                });
                console.log(`  Goal "${goal.title}" completions:`, goal.completions);
            } catch (error) {
                console.error(`Error loading completions for goal ${goal.id}:`, error);
                goal.completions = [];
            }
        }
        
        allGoals = goals;
        console.log('All goals with completions:', allGoals);
        console.log('=== GOALS LOADED ===\n');
        
        renderGoalsList();
        renderCalendar(); // Update calendar to show checkmarks/X marks
    } catch (error) {
        console.error('Error loading goals:', error);
    }
}

function renderGoalsList() {
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    
    // Get the context date (selected calendar date or actual today)
    const effectiveDate = contextDate || new Date();
    const effectiveDateStr = formatDate(effectiveDate);
    
    let filteredGoals = allGoals;
    if (currentFilter !== 'all') {
        if (currentFilter === 'daily') {
            filteredGoals = allGoals.filter(g => g.type === 'daily' || g.type === 'one-time');
        } else {
            filteredGoals = allGoals.filter(g => g.type === currentFilter);
        }
    }
    
    // Filter by time period: show goals whose *goal date* (start_date–end_date) overlaps the period
    const period = document.getElementById('goals-period')?.value || 'today';
    if (period !== 'all') {
        const { startDate, endDate } = getStatisticsDates(period, effectiveDate);
        filteredGoals = filteredGoals.filter(goal => {
            const goalStart = (goal.start_date || '').toString().trim().slice(0, 10);
            const goalEnd = (goal.end_date || goal.start_date || '').toString().trim().slice(0, 10);
            if (!goalStart) return false;
            // Goal is in period if its date range overlaps [startDate, endDate]
            const goalInPeriod = goalStart <= endDate && goalEnd >= startDate;
            return goalInPeriod;
        });
    }
    
    // Calculate total time logged for self-improvement counter
    // Use the SAME logic as calculateGoalProgress - just sum completions from filtered goals
    // This ensures consistency with what the goal cards display
    let totalTimeLogged = 0;
    
    // Ensure allGoals exists and is an array
    if (!allGoals || !Array.isArray(allGoals)) {
        console.warn('Self Improvement: allGoals is not loaded yet');
    } else {
        // For the selected period, sum completions from goals that are shown in the filtered list
        // Use the same filteredGoals that are displayed, so the counter matches what's visible
        filteredGoals.forEach(goal => {
            // Use calculateGoalProgress to get the total - this is what the goal cards use
            const progress = calculateGoalProgress(goal);
            totalTimeLogged += progress.completed || 0;
        });
        
        console.log('Self Improvement: Calculated', totalTimeLogged, 'minutes from', filteredGoals.length, 'goals');
    }
    
    // Create self-improvement counter
    const periodText = period !== 'all' ? document.getElementById('goals-period').selectedOptions[0].text : 'All Time';
    const counterHTML = `
        <div class="self-improvement-counter">
            <div class="counter-icon" aria-hidden="true">
                <img
                    class="counter-icon-img"
                    src="/Images/GT_Logo_2.png?v=1"
                    alt="Goals Tracker logo"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                />
                <span class="counter-icon-fallback" style="display:none">⚡</span>
            </div>
            <div class="counter-content">
                <div class="counter-label">Self Improvement</div>
                <div class="counter-time">${formatTime(totalTimeLogged)}</div>
                <div class="counter-period">${periodText}</div>
            </div>
        </div>
    `;
    
    if (filteredGoals.length === 0) {
        goalsList.innerHTML = counterHTML + `
            <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <h3>No goals for ${periodText.toLowerCase()} yet</h3>
                <p>Create your first goal to start tracking!</p>
            </div>
        `;
    } else {
        goalsList.innerHTML = counterHTML;
        filteredGoals.forEach(goal => {
            const card = createGoalCard(goal);
            goalsList.appendChild(card);
        });
    }
}

async function createGoal() {
    const title = document.getElementById('goal-title').value;
    const description = document.getElementById('goal-description').value;
    const type = document.getElementById('goal-type').value;
    // Use the exact date from the Goal Date picker (YYYY-MM-DD) so the goal is saved on the selected day
    const rawGoalDate = document.getElementById('goal-start-date').value;
    const startDate = (rawGoalDate && rawGoalDate.trim())
        ? rawGoalDate.trim().slice(0, 10)  // ensure we only send YYYY-MM-DD, no time/timezone
        : formatDate(getEffectiveSelectedDate());
    
    // Get duration - convert hours to minutes if needed
    const durationValue = document.getElementById('goal-duration').value;
    let durationMinutes = null;
    
    if (durationValue && durationValue.trim() !== '') {
        const duration = parseFloat(durationValue);
        const unitBtn = document.querySelector('#goal-modal .time-unit-btn.active');
        const unit = unitBtn ? unitBtn.dataset.unit : 'minutes';
        
        if (unit === 'hours') {
            durationMinutes = Math.round(duration * 60);
        } else {
            durationMinutes = Math.round(duration);
        }
    }
    
    try {
        const response = await fetch(`${API_URL}/api/goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                title,
                description,
                durationMinutes,
                type,
                startDate
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal();
            await loadGoals();
            renderCalendar();
        }
    } catch (error) {
        console.error('Error creating goal:', error);
    }
}

let currentCompletionGoal = null;
let currentCompletionDate = null;

function openCompleteModal(goalId, date, targetDuration, existingDuration) {
    currentCompletionGoal = goalId;
    currentCompletionDate = date;
    
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) {
        console.error('Goal not found:', goalId);
        return;
    }
    
    console.log('=== OPEN COMPLETE MODAL DEBUG ===');
    console.log('Goal:', goal.title, 'ID:', goalId);
    console.log('Date passed:', date, 'Type:', typeof date);
    console.log('Existing duration passed:', existingDuration, 'Type:', typeof existingDuration);
    console.log('Goal completions:', goal.completions);
    
    // Find the completion for this date - handle date format variations
    let actualCompletion = null;
    let actualDuration = 0;
    
    if (goal.completions && Array.isArray(goal.completions) && goal.completions.length > 0) {
        // Normalize the target date
        const targetDateStr = typeof date === 'string' 
            ? date.split('T')[0] 
            : formatDate(date);
        
        console.log('Looking for completion with date:', targetDateStr);
        
        // Try to find completion by matching date
        actualCompletion = goal.completions.find(c => {
            if (!c.completion_date) return false;
            
            const completionDate = c.completion_date;
            const completionDateStr = typeof completionDate === 'string' 
                ? completionDate.split('T')[0] 
                : formatDate(completionDate);
            
            console.log('  Comparing:', completionDateStr, 'with', targetDateStr, 'Match:', completionDateStr === targetDateStr);
            return completionDateStr === targetDateStr;
        });
        
        // If no exact match and it's a one-time goal, use the first (and likely only) completion
        if (!actualCompletion && goal.type === 'one-time' && goal.completions.length === 1) {
            console.log('One-time goal with single completion, using it');
            actualCompletion = goal.completions[0];
        }
        
        // If still no match, use the most recent completion
        if (!actualCompletion && goal.completions.length > 0) {
            console.log('No date match, using most recent completion');
            actualCompletion = goal.completions.reduce((latest, c) => {
                if (!latest) return c;
                const latestDate = new Date(latest.completion_date);
                const currentDate = new Date(c.completion_date);
                return currentDate > latestDate ? c : latest;
            });
        }
    }
    
    if (actualCompletion) {
        actualDuration = Number(actualCompletion.duration_minutes) || 0;
        console.log('Found completion:', actualCompletion, 'Duration:', actualDuration);
    } else {
        // Fall back to passed existingDuration
        if (existingDuration && existingDuration !== 'null' && existingDuration !== null) {
            actualDuration = Number(existingDuration) || 0;
            console.log('Using passed existingDuration:', actualDuration);
        }
    }
    
    console.log('Final actualDuration:', actualDuration);
    console.log('=== END DEBUG ===');
    
    document.getElementById('complete-goal-title').textContent = goal.title;
    
    const timeSpentGroup = document.getElementById('time-spent-group');
    const timeHint = document.getElementById('time-hint');
    const submitBtn = document.getElementById('complete-submit-btn');
    
    let infoText = '';
    if (targetDuration) {
        infoText = `Target: ${formatTime(targetDuration)}`;
        if (timeHint) timeHint.textContent = 'Leave empty and click "Done" to complete without logging time';
        if (submitBtn) submitBtn.textContent = 'Log Time';
    } else {
        infoText = 'No time target - optionally log your time or just click Done';
        if (timeHint) timeHint.textContent = 'Leave empty and click "Done" to complete without logging time';
        if (submitBtn) submitBtn.textContent = 'Done';
    }
    if (actualDuration > 0) {
        infoText += ` | Currently logged: ${formatTime(actualDuration)}`;
    }
    document.getElementById('complete-goal-info').textContent = infoText;
    
    // Set default value if editing - use actualDuration
    // Store base value in minutes for conversion
    if (typeof window.baseMinutes === 'undefined') {
        window.baseMinutes = 0;
    }
    window.baseMinutes = actualDuration > 0 ? Math.round(actualDuration) : 0;
    
    if (actualDuration > 0) {
        // Clear all active states first
        document.querySelectorAll('#complete-modal .time-unit-btn').forEach(b => b.classList.remove('active'));
        
        const durationInput = document.getElementById('complete-duration');
        
        if (actualDuration >= 60) {
            // Default to HOURS view for >= 60 minutes
            const hoursBtn = document.getElementById('complete-unit-hours');
            if (hoursBtn) {
                hoursBtn.classList.add('active');
                durationInput.value = (actualDuration / 60).toFixed(2);
                console.log('Initial: Set to hours, value:', (actualDuration / 60).toFixed(2), 'baseMinutes:', window.baseMinutes);
            }
        } else {
            // Default to MINUTES view for < 60 minutes
            const minutesBtn = document.getElementById('complete-unit-minutes');
            if (minutesBtn) {
                minutesBtn.classList.add('active');
                durationInput.value = Math.round(actualDuration);
                console.log('Initial: Set to minutes, value:', Math.round(actualDuration), 'baseMinutes:', window.baseMinutes);
            }
        }
    } else {
        window.baseMinutes = 0;
        document.getElementById('complete-duration').value = '';
        document.querySelectorAll('#complete-modal .time-unit-btn').forEach(b => b.classList.remove('active'));
        const minutesBtn = document.getElementById('complete-unit-minutes');
        if (minutesBtn) minutesBtn.classList.add('active');
    }
    
    document.getElementById('complete-modal').classList.add('active');
}

function closeCompleteModal() {
    document.getElementById('complete-modal').classList.remove('active');
    currentCompletionGoal = null;
    currentCompletionDate = null;
}

async function submitCompletion() {
    if (!currentCompletionGoal || !currentCompletionDate) return;
    
    const durationValue = document.getElementById('complete-duration').value;
    let durationMinutes = 0;
    
    // Allow completion without time (durationMinutes = 0)
    if (durationValue && durationValue.trim() !== '') {
        const duration = parseFloat(durationValue);
        if (isNaN(duration) || duration <= 0) {
            showErrorModal('Invalid Duration', 'Please enter a valid duration or leave empty to complete without logging time.');
            return;
        }
        
        const unitBtn = document.querySelector('#complete-modal .time-unit-btn.active');
        const unit = unitBtn ? unitBtn.dataset.unit : 'minutes';
        
        if (unit === 'hours') {
            durationMinutes = Math.round(duration * 60);
        } else {
            durationMinutes = Math.round(duration);
        }
    }
    
    try {
        const response = await fetch(`${API_URL}/api/goals/${currentCompletionGoal}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: currentCompletionDate, durationMinutes })
        });
        
        if (response.ok) {
            closeCompleteModal();
            await loadGoals();
            renderCalendar();
            loadStatistics();
            if (selectedDate) {
                showDayDetails(selectedDate);
            }
            await loadCompetition();
        }
    } catch (error) {
        console.error('Error completing goal:', error);
        showErrorModal('Error Logging Time', 'An error occurred while logging time. Please try again.');
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/goals/${goalId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadGoals();
            renderCalendar();
            if (selectedDate) {
                showDayDetails(selectedDate);
            }
        }
    } catch (error) {
        console.error('Error deleting goal:', error);
    }
}

// Leaderboard Functions
async function loadLeaderboard() {
    const period = document.getElementById('leaderboard-period').value;
    const { startDate, endDate } = getLeaderboardDates(period);
    
    try {
        const response = await fetch(`${API_URL}/api/leaderboard?startDate=${startDate}&endDate=${endDate}`);
        const leaderboard = await response.json();
        
        renderLeaderboard(leaderboard);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

function getLeaderboardDates(period) {
    const today = new Date();
    let startDate, endDate;
    
    if (period === 'today') {
        startDate = endDate = formatDate(today);
    } else if (period === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        startDate = endDate = formatDate(yesterday);
    } else if (period === 'week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today);
        monday.setDate(diff);
        startDate = formatDate(monday);
        endDate = formatDate(today);
    } else if (period === 'month') {
        startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = formatDate(today);
    } else if (period === '3months') {
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        startDate = formatDate(threeMonthsAgo);
        endDate = formatDate(today);
    } else if (period === 'year') {
        startDate = `${today.getFullYear()}-01-01`;
        endDate = formatDate(today);
    }
    
    return { startDate, endDate };
}

function renderLeaderboard(leaderboard) {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    
    if (leaderboard.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏆</div>
                <h3>No activity yet</h3>
                <p>Complete some goals to appear on the leaderboard!</p>
            </div>
        `;
        return;
    }
    
    leaderboard.forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        const isCurrentUser = user.id === currentUser.id;
        if (isCurrentUser) {
            item.style.borderColor = 'var(--accent)';
        }
        
        item.innerHTML = `
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">
                    ${user.username}${isCurrentUser ? ' (You)' : ''}
                </div>
                <div class="leaderboard-stats">
                    ${user.goals_completed} goals completed · ${user.total_minutes} minutes
                </div>
            </div>
            <div class="leaderboard-score">${user.total_minutes}m</div>
        `;
        
        list.appendChild(item);
    });
}

// Helper Functions
function closeModal() {
    document.getElementById('goal-modal').classList.remove('active');
    document.getElementById('goal-form').reset();
    // Goal start date is set when opening the modal.
}

function isYMDString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseYMDToLocalDate(ymd) {
    if (!ymd) return null;
    const s = String(ymd).trim().slice(0, 10);
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function normalizeToLocalYMD(value) {
    // Goals/completions may come back from Postgres as ISO timestamps (e.g. 2026-02-14T22:00:00.000Z).
    // Normalize them to a local YYYY-MM-DD string so date-based filtering works for future dates.
    if (!value) return '';
    if (isYMDString(value)) return value;

    // If it's an ISO string or Date-like, parse and format in LOCAL time.
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
        // Fallback: best-effort slice
        return String(value).trim().slice(0, 10);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
    if (isYMDString(date)) return date;
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Statistics Functions
async function loadStatistics() {
    const period = document.getElementById('statistics-period').value;
    // Use context date (selected calendar date) or actual today
    const effectiveDate = contextDate || new Date();
    const { startDate, endDate } = getStatisticsDates(period, effectiveDate);
    
    try {
        // Get all goals and completions for the period
        const response = await fetch(`${API_URL}/api/progress/${currentUser.id}?startDate=${startDate}&endDate=${endDate}`);
        const progress = await response.json();
        
        // Calculate statistics
        let totalMinutes = 0;
        let goalsCompleted = 0;
        const activityStats = {};
        
        progress.forEach(goal => {
            const completed = typeof goal.completed_minutes === 'number' ? goal.completed_minutes : Number(goal.completed_minutes) || 0;
            totalMinutes += completed;
            
            if (completed > 0) {
                goalsCompleted++;
            }
            
            // Group by activity (goal title)
            if (!activityStats[goal.title]) {
                activityStats[goal.title] = 0;
            }
            activityStats[goal.title] += completed;
        });
        
        // Update overview stats
        document.getElementById('total-time-stat').textContent = formatTime(totalMinutes);
        document.getElementById('goals-completed-stat').textContent = goalsCompleted;
        document.getElementById('active-goals-stat').textContent = progress.length;
        
        // Render activity breakdown
        renderActivityStats(activityStats);
        
        // Render chart
        await renderTimeChart(period, startDate, endDate);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function getStatisticsDates(period, referenceDate = null) {
    const today = referenceDate || new Date();
    let startDate, endDate;
    
    if (period === 'today') {
        startDate = endDate = formatDate(today);
    } else if (period === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        startDate = endDate = formatDate(tomorrow);
    } else if (period === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        startDate = endDate = formatDate(yesterday);
    } else if (period === 'week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today);
        monday.setDate(diff);
        startDate = formatDate(monday);
        endDate = formatDate(today);
    } else if (period === 'month') {
        startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = formatDate(today);
    } else if (period === '3months') {
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        startDate = formatDate(threeMonthsAgo);
        endDate = formatDate(today);
    } else if (period === 'year') {
        startDate = `${today.getFullYear()}-01-01`;
        endDate = formatDate(today);
    }
    
    return { startDate, endDate };
}

function renderActivityStats(activityStats) {
    const container = document.getElementById('activity-stats');
    container.innerHTML = '';
    
    const totalMinutes = Object.values(activityStats).reduce((a, b) => {
        const aNum = typeof a === 'number' ? a : Number(a) || 0;
        const bNum = typeof b === 'number' ? b : Number(b) || 0;
        return aNum + bNum;
    }, 0);
    
    const activities = Object.entries(activityStats)
        .filter(([_, minutes]) => {
            const minsNum = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
            return minsNum > 0;
        });
    
    if (activities.length === 0) {
        container.classList.add('is-empty');
        container.innerHTML = `
            <div class="time-by-activity-empty">
                <span class="time-by-activity-empty__icon" aria-hidden="true">📈</span>
                <p class="time-by-activity-empty__title">No activity yet</p>
                <p class="time-by-activity-empty__subtitle">Complete some goals to see your statistics!</p>
            </div>
        `;
        // Clear chart and legend
        const canvas = document.getElementById('activity-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width || 400, canvas.height || 400);
        }
        const chartContainer = document.querySelector('.activity-chart-container');
        if (chartContainer) {
            const legend = chartContainer.querySelector('.activity-chart-legend');
            if (legend) legend.remove();
        }
        return;
    }
    
    // Find maximum time for scaling
    const maxMinutes = Math.max(...activities.map(([_, minutes]) => {
        return typeof minutes === 'number' ? minutes : Number(minutes) || 0;
    }));
    
    // Sort so highest is at the top (descending order)
    activities.sort((a, b) => {
        const aNum = typeof a[1] === 'number' ? a[1] : Number(a[1]) || 0;
        const bNum = typeof b[1] === 'number' ? b[1] : Number(b[1]) || 0;
        return bNum - aNum; // Highest first, lowest last
    });
    
    container.classList.remove('is-empty');
    activities.forEach(([activity, minutes]) => {
        const minutesNum = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
        const card = document.createElement('div');
        card.className = 'activity-stat-card';
        
        // Scale based on maximum value (highest = 100%)
        const percentage = maxMinutes > 0 ? (minutesNum / maxMinutes) * 100 : 0;
        
        card.innerHTML = `
            <div class="activity-stat-header">
                <span class="activity-name">${activity}</span>
                <span class="activity-time">${formatTime(minutesNum)}</span>
            </div>
            <div class="activity-stat-bar">
                <div class="activity-stat-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Render activity chart
    renderActivityChart(activities);
}

async function renderTimeChart(period, startDate, endDate) {
    try {
        const canvas = document.getElementById('time-chart');
        if (!canvas) {
            console.error('Time chart canvas not found');
            return;
        }
        
        // Load completions for all goals in the period
        const chartData = {};
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        
        // Fetch all goals
        const allGoalsResponse = await fetch(`${API_URL}/api/goals/${currentUser.id}`);
        const allGoals = await allGoalsResponse.json();
        
        // Fetch completions for each goal
        for (let goal of allGoals) {
            try {
                const completionsResponse = await fetch(`${API_URL}/api/goals/${goal.id}/completions`);
                const completions = await completionsResponse.json();
                
                if (Array.isArray(completions)) {
                    completions.forEach(completion => {
                        const completionDateStr = completion.completion_date;
                        if (!completionDateStr) return;
                        
                        const completionDate = new Date(completionDateStr + 'T00:00:00');
                        if (isNaN(completionDate.getTime())) return;
                        
                        if (completionDate >= start && completionDate <= end) {
                            const dateStr = formatDate(completionDate);
                            if (!chartData[dateStr]) {
                                chartData[dateStr] = 0;
                            }
                            chartData[dateStr] += Number(completion.duration_minutes) || 0;
                        }
                    });
                }
            } catch (err) {
                console.warn(`Error fetching completions for goal ${goal.id}:`, err);
            }
        }
        
        console.log('Chart data:', chartData);
        
        // Sort dates
        const sortedDates = Object.keys(chartData).sort();
        console.log('Sorted dates:', sortedDates);
        
        if (sortedDates.length === 0) {
            // No data - show message
            const ctx = canvas.getContext('2d');
            const width = canvas.width = canvas.offsetWidth || 400;
            const height = canvas.height = 300;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data available for this period', width / 2, height / 2);
            return;
        }
        
        const labels = sortedDates.map(d => {
            const date = new Date(d + 'T00:00:00');
            if (period === 'today') {
                return date.toLocaleDateString('en-US', { hour: 'numeric', minute: '2-digit' });
            } else if (period === 'week') {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            } else if (period === 'month' || period === '3months') {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (period === 'yesterday') {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                return date.toLocaleDateString('en-US', { month: 'short' });
            }
        });
        const values = sortedDates.map(d => chartData[d]);
        
        console.log('Labels:', labels, 'Values:', values);
        
        // Draw chart
        drawChart(labels, values);
    } catch (error) {
        console.error('Error loading chart data:', error);
        // Show error message on canvas
        const canvas = document.getElementById('time-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const width = canvas.width = canvas.offsetWidth || 400;
            const height = canvas.height = 300;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Error loading chart data', width / 2, height / 2);
        }
    }
}

function drawChart(labels, values) {
    const canvas = document.getElementById('time-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 300;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Get colors from CSS variables
    const textSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const textPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accentDarkColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-dark').trim();
    
    if (values.length === 0) {
        ctx.fillStyle = textSecondaryColor;
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for this period', width / 2, height / 2);
        return;
    }
    
    // Calculate dimensions
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxValue = Math.max(...values, 1);
    const stepX = chartWidth / Math.max(labels.length - 1, 1);
    const stepY = chartHeight / maxValue;
    
    // Draw grid lines
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }
    
    // Draw line chart (like stock chart)
    if (values.length === 1) {
        // Single data point - just draw a dot
        const x = padding.left;
        const y = padding.top + chartHeight - (values[0] * stepY);
        
        // Draw dot
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.strokeStyle = accentDarkColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw value label
        ctx.fillStyle = textPrimaryColor;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(values[0]), x, y - 15);
    } else {
        // Multiple data points - draw connected line
        const points = values.map((value, index) => ({
            x: padding.left + stepX * index,
            y: padding.top + chartHeight - (value * stepY)
        }));
        
        // Draw area under line (gradient fill)
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartHeight);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
        ctx.closePath();
        
        const areaGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        areaGradient.addColorStop(0, accentColor + '40');
        areaGradient.addColorStop(1, accentColor + '00');
        ctx.fillStyle = areaGradient;
        ctx.fill();
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach((point, index) => {
            if (index > 0) {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw points
        points.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = accentColor;
            ctx.fill();
            ctx.strokeStyle = accentDarkColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw value label above point
            ctx.fillStyle = textPrimaryColor;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(formatTime(values[index]), point.x, point.y - 12);
        });
    }
    
    // Draw labels
    ctx.fillStyle = textSecondaryColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding.left + stepX * index;
        ctx.fillText(label, x, height - padding.bottom + 20);
    });
    
    // Draw axis labels
    ctx.fillStyle = textSecondaryColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time (minutes)', width / 2, height - 10);
}

// Competition Functions
let currentCompetition = null;

function showCompetitionEmptyState() {
    const contentEl = document.getElementById('competition-content');
    const noEl = document.getElementById('no-competition');
    const listEl = document.getElementById('competition-list');
    const detailEl = document.getElementById('competition-detail');
    if (contentEl) contentEl.classList.add('competition-empty');
    if (noEl) noEl.style.display = 'block';
    if (listEl) listEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'none';
    currentCompetition = null;
}

async function loadCompetitionsList() {
    const noEl = document.getElementById('no-competition');
    const listEl = document.getElementById('competition-list');
    const detailEl = document.getElementById('competition-detail');
    try {
        if (!currentUser || !currentUser.id) {
            showCompetitionEmptyState();
            return;
        }
        const response = await fetch(`${API_URL}/api/competitions?userId=${currentUser.id}&_=${Date.now()}`);
        const data = await response.json();
        const list = data.competitions || [];
        document.getElementById('competition-content')?.classList.remove('competition-empty');
        noEl.style.display = 'none';
        listEl.style.display = 'none';
        detailEl.style.display = 'none';
        if (list.length === 0) {
            showCompetitionEmptyState();
            return;
        }
        listEl.style.display = 'grid';
        listEl.innerHTML = list.map(c => `
            <div class="competition-box-wrap" data-competition-id="${c.id}">
                <button type="button" class="competition-box" aria-label="Open ${escapeHtml(c.title)}">
                    <span class="competition-box__title">${escapeHtml(c.title)}</span>
                    ${c.description ? `<span class="competition-box__desc">${escapeHtml(c.description)}</span>` : ''}
                    <span class="competition-box__meta">${c.participantCount} participant${c.participantCount !== 1 ? 's' : ''} · ${formatTime(c.totalTime)} total</span>
                    ${c.isCreator ? '<span class="competition-box__badge">Owner</span>' : ''}
                </button>
                ${c.isCreator ? `<button type="button" class="competition-box-edit" aria-label="Edit competition" title="Edit">✎</button>` : ''}
            </div>
        `).join('');
        listEl.querySelectorAll('.competition-box-wrap').forEach(wrap => {
            const id = parseInt(wrap.dataset.competitionId);
            wrap.querySelector('.competition-box')?.addEventListener('click', () => selectCompetition(id));
            wrap.querySelector('.competition-box-edit')?.addEventListener('click', (e) => { e.stopPropagation(); openEditCompetitionModal(id); });
        });
        checkPendingInvitations();
    } catch (error) {
        console.error('Error loading competitions list:', error);
        showCompetitionEmptyState();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function selectCompetition(id) {
    currentCompetition = { id };
    loadCompetitionById(id);
}

async function loadCompetitionById(competitionId) {
    try {
        const response = await fetch(`${API_URL}/api/competition/${competitionId}?userId=${currentUser.id}&_=${Date.now()}`);
        const data = await response.json();
        if (!data.competition) {
            document.getElementById('competition-detail').style.display = 'none';
            currentCompetition = null;
            return;
        }
        currentCompetition = data.competition;
        const detailEl = document.getElementById('competition-detail');
        detailEl.style.display = 'block';
        document.getElementById('competition-title').textContent = data.competition.title;
        document.getElementById('competition-description').textContent = data.competition.description || '';
        const userTotalMins = Number(data.userStats?.totalMinutes || 0);
        document.getElementById('my-competition-time').textContent = formatTime(userTotalMins);
        document.getElementById('my-competition-rank').textContent = data.userStats?.rank || '-';
        document.getElementById('competition-total-time').textContent = formatTime(data.totalTime || 0);
        const joinBtn = document.getElementById('join-competition-btn');
        const addBtn = document.getElementById('add-competition-time-btn');
        const removeBtn = document.getElementById('remove-competition-time-btn');
        const leaveBtn = document.getElementById('leave-competition-btn');
        const deleteBtn = document.getElementById('delete-competition-btn');
        const isCreator = Number(data.competition?.creator_id) === Number(currentUser?.id);
        if (data.userStats?.hasJoined) {
            if (joinBtn) joinBtn.style.display = 'none';
            if (addBtn) addBtn.style.display = 'block';
            if (removeBtn) removeBtn.style.display = 'block';
        } else {
            if (joinBtn) joinBtn.style.display = 'block';
            if (addBtn) addBtn.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'none';
        }
        if (leaveBtn) leaveBtn.style.display = (!isCreator && data.userStats?.hasJoined) ? 'block' : 'none';
        if (deleteBtn) deleteBtn.style.display = isCreator ? 'block' : 'none';
        if (data.leaderboard) {
            const idx = data.leaderboard.findIndex(u => u.id === currentUser.id);
            if (idx !== -1) data.leaderboard[idx].total_minutes = userTotalMins;
        }
        renderCompetitionLeaderboard(data.leaderboard, userTotalMins);
    } catch (error) {
        console.error('Error loading competition detail:', error);
    }
}

async function loadCompetition() {
    await loadCompetitionsList();
    if (currentCompetition && currentCompetition.id) await loadCompetitionById(currentCompetition.id);
}

function renderCompetitionTimeBreakdown(userStats) {
    // Create or get the breakdown container
    let breakdownContainer = document.getElementById('competition-time-breakdown');
    if (!breakdownContainer) {
        breakdownContainer = document.createElement('div');
        breakdownContainer.id = 'competition-time-breakdown';
        breakdownContainer.className = 'competition-time-breakdown';
        breakdownContainer.style.cssText = 'margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px;';
        
        const competitionActions = document.querySelector('.competition-actions');
        if (competitionActions) {
            competitionActions.parentNode.insertBefore(breakdownContainer, competitionActions.nextSibling);
        }
    }
    
    const goalMinutes = userStats.goalCompletionMinutes || 0;
    const manualLogs = userStats.manualLogs || [];
    const goalCompletions = userStats.goalCompletions || [];
    
    // Debug logging
    console.log('Rendering time breakdown:', {
        goalMinutes,
        manualLogs,
        goalCompletions,
        userStats
    });
    
    let html = '<div style="margin-bottom: 12px;"><strong style="color: var(--text-primary);">Time Breakdown:</strong></div>';
    
    // Show goal completions (auto-synced) with remove buttons
    if (goalCompletions.length > 0) {
        html += `<div style="margin-bottom: 12px;">
            <div style="margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                <strong>📊 Auto-synced from goals:</strong>
            </div>`;
        
        goalCompletions.forEach(gc => {
            const date = new Date(gc.completion_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 6px;">
                <div>
                    <span style="color: var(--text-primary);">${formatTime(gc.duration_minutes)}</span>
                    <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${date}</span>
                </div>
                <button class="btn-delete" onclick="deleteGoalCompletionFromCompetition(${gc.id}, '${gc.completion_date}')" style="padding: 4px 12px; font-size: 12px;">Remove</button>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Show manual logs
    if (manualLogs.length > 0) {
        html += `<div style="margin-top: 12px;">
            <div style="margin-bottom: 8px; color: var(--text-secondary); font-size: 14px;">
                <strong>Manual Logs:</strong>
            </div>`;
        
        manualLogs.forEach(log => {
            const date = new Date(log.logged_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 6px;">
                <div>
                    <span style="color: var(--text-primary);">${formatTime(log.duration_minutes)}</span>
                    <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">${date}</span>
                </div>
                <button class="btn-delete" onclick="deleteCompetitionLog(${log.id})" style="padding: 4px 12px; font-size: 12px;">Remove</button>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // If no entries but there's time showing, show a message about where it might be coming from
    if (goalCompletions.length === 0 && manualLogs.length === 0) {
        const totalMins = userStats.totalMinutes || 0;
        if (totalMins > 0) {
            // There's time but no breakdown entries - might be from old data
            html += `<div style="color: var(--text-warning, #fbbf24); font-size: 14px; padding: 12px; background: rgba(251, 191, 36, 0.1); border-radius: 8px; margin-top: 12px;">
                <strong>⚠️ Time detected but no entries found</strong><br>
                <span style="font-size: 12px;">You have ${formatTime(totalMins)} logged. This might be from an old entry. Please refresh or contact support.</span>
            </div>`;
        } else {
            html += `<div style="color: var(--text-secondary); font-size: 14px; font-style: italic;">
                No time logged yet. Complete your goal "${currentCompetition.title}" or log time manually.
            </div>`;
        }
    }
    
    breakdownContainer.innerHTML = html;
}

async function deleteGoalCompletionFromCompetition(goalId, completionDate) {
    if (!confirm('Are you sure you want to remove this time? This will remove it from both the competition and your goal completions.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/competition/goal-completion/${goalId}/${completionDate}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCompetition();
            await loadGoals(); // Reload goals to reflect the sync
        } else {
            showErrorModal('Error Removing Time', data.error || 'Failed to remove time entry.');
        }
    } catch (error) {
        console.error('Error deleting goal completion:', error);
        showErrorModal('Error Removing Time', 'An error occurred while removing the time entry.');
    }
}

async function deleteCompetitionLog(logId) {
    if (!confirm('Are you sure you want to remove this time entry? This will also remove it from your goal completions if the goal title matches the competition.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/competition/log/${logId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: currentUser.id,
                competitionId: currentCompetition.id
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadCompetition();
            await loadGoals(); // Reload goals to reflect the sync
        } else {
            showErrorModal('Error Removing Time', data.error || 'Failed to remove time entry.');
        }
    } catch (error) {
        console.error('Error deleting competition log:', error);
        showErrorModal('Error Removing Time', 'An error occurred while removing the time entry.');
    }
}

function renderCompetitionLeaderboard(leaderboard, userTotalMinutes) {
    const list = document.getElementById('competition-leaderboard-list');
    list.innerHTML = '';
    
    if (!leaderboard || leaderboard.length === 0) {
        list.innerHTML = '<p class="empty-text">No participants yet. Be the first to log time!</p>';
        return;
    }
    
    // Use the passed userTotalMinutes - this comes directly from the API
    const yourTimeMinutes = userTotalMinutes !== undefined ? userTotalMinutes : 0;
    
    console.log('Rendering leaderboard with userTotalMinutes:', yourTimeMinutes);
    
    leaderboard.forEach((participant, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        if (participant.id === currentUser.id) {
            item.classList.add('current-user');
        }
        
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        // CRITICAL: For current user, ALWAYS use the passed userTotalMinutes value
        const displayTime = (participant.id === currentUser.id) ? yourTimeMinutes : participant.total_minutes;
        
        console.log(`Participant ${participant.username} (id=${participant.id}, isCurrentUser=${participant.id === currentUser.id}): API=${participant.total_minutes}, Display=${displayTime}`);
        
        item.innerHTML = `
            <div class="leaderboard-rank">${medal}</div>
            <div class="leaderboard-user">
                <div class="leaderboard-username">${participant.username}${participant.id === currentUser.id ? ' (You)' : ''}</div>
            </div>
            <div class="leaderboard-time">${formatTime(displayTime)}</div>
        `;
        
        // Make item clickable to show details
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            showParticipantDetails(participant.id, participant.username);
        });
        
        list.appendChild(item);
    });
}

async function createCompetition() {
    try {
        const titleInput = document.getElementById('competition-title-input');
        const descriptionInput = document.getElementById('competition-description-input');
        
        if (!titleInput || !descriptionInput) {
            console.error('Competition form inputs not found');
            showErrorModal('Form Error', 'Form elements not found. Please refresh the page.');
            return;
        }
        
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        
        if (!title) {
            showErrorModal('Missing Title', 'Please enter a competition title.');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            showErrorModal('Authentication Required', 'You must be logged in to create a competition.');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/competition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                title,
                description
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            const errorMsg = data.error || `Server error (${response.status})`;
            console.error('Competition creation error:', errorMsg, data);
            showErrorModal('Error Creating Competition', errorMsg);
            return;
        }
        
        showSuccessModal('Competition Created', 'Your competition has been created successfully!');
        document.getElementById('competition-modal').classList.remove('active');
        document.getElementById('competition-form').reset();
        await loadCompetitionsList();
        if (data.competitionId) selectCompetition(data.competitionId);
    } catch (error) {
        console.error('Error creating competition:', error);
        showErrorModal('Error Creating Competition', 'An error occurred while creating the competition. Please try again.');
    }
}

async function openEditCompetitionModal(competitionId) {
    try {
        const res = await fetch(`${API_URL}/api/competition/${competitionId}?userId=${currentUser?.id}&_=${Date.now()}`);
        const data = await res.json();
        if (!data.competition) {
            showErrorModal('Error', 'Competition not found.');
            return;
        }
        if (Number(data.competition.creator_id) !== Number(currentUser?.id)) {
            showErrorModal('Not Allowed', 'Only the creator can edit this competition.');
            return;
        }
        document.getElementById('edit-competition-id').value = competitionId;
        document.getElementById('edit-competition-title').value = data.competition.title || '';
        document.getElementById('edit-competition-description').value = data.competition.description || '';
        document.getElementById('edit-competition-modal').classList.add('active');
    } catch (err) {
        console.error('Error opening edit competition:', err);
        showErrorModal('Error', 'Could not load competition.');
    }
}

async function saveEditCompetition() {
    try {
        const id = document.getElementById('edit-competition-id').value;
        const title = document.getElementById('edit-competition-title').value.trim();
        const description = document.getElementById('edit-competition-description').value.trim();
        if (!id || !title) {
            showErrorModal('Invalid', 'Title is required.');
            return;
        }
        if (!currentUser?.id) {
            showErrorModal('Error', 'You must be logged in to edit a competition.');
            return;
        }
        const response = await fetch(`${API_URL}/api/competition/${id}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, title, description })
        });
        let data;
        try {
            data = await response.json();
        } catch (_) {
            showErrorModal('Error', 'Server returned an invalid response. Please try again.');
            return;
        }
        if (!response.ok || !data.success) {
            showErrorModal('Error', data.error || 'Failed to update competition.');
            return;
        }
        showSuccessModal('Competition Updated', 'Your competition has been updated.');
        document.getElementById('edit-competition-modal').classList.remove('active');
        await loadCompetitionsList();
        if (currentCompetition && Number(currentCompetition.id) === Number(id)) await loadCompetitionById(Number(id));
    } catch (err) {
        console.error('Error saving competition:', err);
        showErrorModal('Error', err.message || 'Could not update competition.');
    }
}

async function joinCompetition() {
    try {
        if (!currentCompetition) {
            showErrorModal('No Competition', 'No active competition found.');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            showErrorModal('Authentication Required', 'You must be logged in to join a competition.');
            return;
        }
        
        // Join by logging 0 time (this adds the user to the competition)
        const response = await fetch(`${API_URL}/api/competition/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                competitionId: currentCompetition.id,
                durationMinutes: 0
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessModal('Joined Competition', 'You have successfully joined the competition!');
            await loadCompetition();
        } else {
            showErrorModal('Error Joining Competition', data.error || 'Failed to join the competition.');
        }
    } catch (error) {
        console.error('Error joining competition:', error);
        showErrorModal('Error Joining Competition', 'An error occurred while joining the competition. Please try again.');
    }
}

async function logCompetitionTime() {
    try {
        if (!currentCompetition) {
            showErrorModal('No Competition', 'No active competition found.');
            return;
        }
        
        const modal = document.getElementById('log-competition-modal');
        const mode = modal?.dataset.mode || 'add';
        
        const durationValue = document.getElementById('competition-duration').value;
        if (!durationValue || durationValue <= 0) {
            showErrorModal('Invalid Time', 'Please enter a valid time amount.');
            return;
        }
        
        const duration = parseFloat(durationValue);
        const unitBtn = document.querySelector('#log-competition-modal .time-unit-btn.active');
        const unit = unitBtn ? unitBtn.dataset.unit : 'minutes';
        
        let durationMinutes = unit === 'hours' ? Math.round(duration * 60) : Math.round(duration);
        
        // Use different endpoint for remove
        const endpoint = mode === 'remove' ? '/api/competition/remove' : '/api/competition/log';
        const url = `${API_URL}${endpoint}`;
        
        console.log('Making request to:', url);
        console.log('Body:', {
            userId: currentUser.id,
            competitionId: currentCompetition.id,
            durationMinutes
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                competitionId: currentCompetition.id,
                durationMinutes
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response received:', text.substring(0, 200));
            throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            modal.classList.remove('active');
            document.getElementById('log-competition-form').reset();
            // Small delay then reload
            setTimeout(async () => {
                await loadCompetition();
            }, 300);
        } else {
            showErrorModal('Error ' + (mode === 'add' ? 'Adding' : 'Removing') + ' Time', data.error || 'Failed to ' + (mode === 'add' ? 'add' : 'remove') + ' time.');
        }
    } catch (error) {
        console.error('Error:', error);
        showErrorModal('Error', 'An error occurred. Please try again.');
    }
}

async function showParticipantDetails(userId, username) {
    try {
        if (!currentCompetition) {
            showErrorModal('No Competition', 'No active competition found.');
            return;
        }
        
        // Fetch participant details
        const response = await fetch(`${API_URL}/api/competition/${currentCompetition.id}/participant/${userId}`);
        
        if (!response.ok) {
            showParticipantErrorModal(username);
            return;
        }
        
        const data = await response.json();
        
        if (!data) {
            showParticipantErrorModal(username);
            return;
        }
        
        // Update modal title and stats
        document.getElementById('participant-details-name').textContent = `${username}'s Activity`;
        const totalMins = data.totalMinutes || 0;
        const daysActive = data.daysActive || 0;
        document.getElementById('participant-total-time').textContent = formatTime(totalMins);
        document.getElementById('participant-days-active').textContent = daysActive;
        
        // Render daily breakdown
        const dailyList = document.getElementById('participant-daily-list');
        dailyList.innerHTML = '';
        
        if (!data || !data.dailyLogs || data.dailyLogs.length === 0) {
            dailyList.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center;">
                    <p style="color: var(--text-secondary); font-size: 14px;">No daily activity logged yet.</p>
                </div>
            `;
        } else {
            data.dailyLogs.forEach(log => {
                const item = document.createElement('div');
                item.className = 'participant-daily-item';
                
                let date;
                if (typeof log.logged_date === 'string') {
                    date = new Date(log.logged_date);
                } else {
                    date = log.logged_date;
                }
                
                const dateStr = date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                });
                
                const minutesNum = typeof log.total_minutes === 'number' ? log.total_minutes : Number(log.total_minutes) || 0;
                
                item.innerHTML = `
                    <div class="participant-daily-date">${dateStr}</div>
                    <div class="participant-daily-time">${formatTime(minutesNum)}</div>
                `;
                
                dailyList.appendChild(item);
            });
        }
        
        // Render time breakdown (goals + manual logs) - only for current user
        if (userId === currentUser.id) {
            // Fetch current user's stats to get breakdown
            const compResponse = await fetch(`${API_URL}/api/competition?userId=${currentUser.id}`);
            const compData = await compResponse.json();
            
            if (compData && compData.userStats) {
                renderParticipantTimeBreakdown(compData.userStats, userId === currentUser.id);
            } else {
                document.getElementById('participant-time-breakdown-content').innerHTML = '<p style="color: var(--text-secondary);">No breakdown available.</p>';
            }
        } else {
            // For other users, show a message
            document.getElementById('participant-time-breakdown-content').innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">Time breakdown is only available for your own activity.</p>';
        }
        
        // Show modal
        document.getElementById('participant-details-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading participant details:', error);
        showParticipantErrorModal(username);
    }
}

function renderParticipantTimeBreakdown(userStats, isCurrentUser) {
    const container = document.getElementById('participant-time-breakdown-content');
    if (!container) return;
    
    const goalMinutes = userStats.goalCompletionMinutes || 0;
    const manualLogs = userStats.manualLogs || [];
    const goalCompletions = userStats.goalCompletions || [];
    
    let html = '';
    
    // Show goal completions (auto-synced)
    if (goalCompletions.length > 0) {
        html += `<div style="margin-bottom: 20px;">
            <div style="margin-bottom: 12px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
                📊 Auto-synced from goals
            </div>`;
        
        goalCompletions.forEach(gc => {
            const date = new Date(gc.completion_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            html += `<div class="breakdown-item">
                <div class="breakdown-item-content">
                    <span class="breakdown-time">${formatTime(gc.duration_minutes)}</span>
                    <span class="breakdown-date">${date}</span>
                </div>
                ${isCurrentUser ? `<button class="btn-delete-small" onclick="deleteGoalCompletionFromCompetition(${gc.id}, '${gc.completion_date}')">Remove</button>` : ''}
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Show manual logs
    if (manualLogs.length > 0) {
        html += `<div style="margin-top: 20px;">
            <div style="margin-bottom: 12px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
                Manual Logs
            </div>`;
        
        manualLogs.forEach(log => {
            const date = new Date(log.logged_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            html += `<div class="breakdown-item">
                <div class="breakdown-item-content">
                    <span class="breakdown-time">${formatTime(log.duration_minutes)}</span>
                    <span class="breakdown-date">${date}</span>
                </div>
                ${isCurrentUser ? `<button class="btn-delete-small" onclick="deleteCompetitionLog(${log.id})">Remove</button>` : ''}
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // If no entries
    if (goalCompletions.length === 0 && manualLogs.length === 0) {
        const totalMins = userStats.totalMinutes || 0;
        if (totalMins > 0) {
            html += `<div style="color: var(--text-secondary); font-size: 14px; padding: 16px; background: var(--bg-secondary); border-radius: 12px; text-align: center;">
                Time detected but no breakdown entries found.
            </div>`;
        } else {
            html += `<div style="color: var(--text-secondary); font-size: 14px; padding: 16px; text-align: center; font-style: italic;">
                No time logged yet.
            </div>`;
        }
    }
    
    container.innerHTML = html;
}

function showParticipantErrorModal(username) {
    // Create a custom error modal matching app theme
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2>No Data Available</h2>
                <button class="btn-icon" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div style="padding: 32px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📊</div>
                <h3 style="color: var(--text-primary); margin-bottom: 8px; font-size: 18px;">No Activity Data</h3>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">
                    ${username} hasn't logged any time for this competition yet, or there's no data available.
                </p>
                <button class="btn-primary" onclick="this.closest('.modal').remove()">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Custom error modal function - replaces all alert() calls
function showErrorModal(title, message, icon = '⚠️') {
    // Remove any existing error modals first
    const existingError = document.getElementById('custom-error-modal');
    if (existingError) {
        existingError.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'custom-error-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content premium-feedback premium-feedback--error" role="dialog" aria-modal="true">
            <div class="modal-header">
                <h2>${title || 'Error'}</h2>
                <button class="btn-icon" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="premium-feedback-body">
                <div class="premium-feedback-icon" aria-hidden="true">
                    ${renderFeedbackIcon(icon)}
                </div>
                <p class="premium-feedback-message">${message}</p>
                <div class="premium-feedback-actions">
                    <button class="btn-primary premium-feedback-ok" onclick="this.closest('.modal').remove()">OK</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Auto-close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function escapeHtmlAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderFeedbackIcon(icon) {
    const iconStr = String(icon ?? '').trim();
    const looksLikeImage =
        iconStr.includes('/Images/') ||
        /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(iconStr) ||
        /^https?:\/\//i.test(iconStr);

    if (looksLikeImage) {
        return `<img class="premium-feedback-icon__img" src="${escapeHtmlAttr(iconStr)}" alt="" />`;
    }

    return `<span class="premium-feedback-icon__glyph">${escapeHtmlAttr(iconStr || '✅')}</span>`;
}

// Custom success modal function
function showSuccessModal(title, message, icon = '/Images/Checkmark.png?v=1') {
    const existingSuccess = document.getElementById('custom-success-modal');
    if (existingSuccess) {
        existingSuccess.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'custom-success-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content premium-feedback premium-feedback--success" role="dialog" aria-modal="true">
            <div class="modal-header">
                <h2>${title || 'Success'}</h2>
                <button class="btn-icon" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="premium-feedback-body">
                <div class="premium-feedback-icon" aria-hidden="true">
                    ${renderFeedbackIcon(icon)}
                </div>
                <p class="premium-feedback-message">${message}</p>
                <div class="premium-feedback-actions">
                    <button class="btn-primary premium-feedback-ok" onclick="this.closest('.modal').remove()">OK</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Auto-close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function sendCompetitionInvite() {
    try {
        const username = document.getElementById('invite-username').value.trim();
        
        if (!username) {
            showErrorModal('Missing Username', 'Please enter a username to invite.');
            return;
        }
        
        if (!currentCompetition) {
            showErrorModal('No Competition', 'No active competition found.');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/competition/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competitionId: currentCompetition.id,
                inviterId: currentUser.id,
                inviteeUsername: username
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessModal('Invitation Sent', data.message || `Invitation sent to ${username} successfully!`);
            document.getElementById('invite-competition-modal').classList.remove('active');
            document.getElementById('invite-competition-form').reset();
        } else {
            showErrorModal('Invitation Failed', data.error || 'Failed to send invitation. Please try again.');
        }
    } catch (error) {
        console.error('Error sending invitation:', error);
        showErrorModal('Error', 'An error occurred while sending the invitation. Please try again.');
    }
}

// Friends View
async function loadFriendsData() {
    try {
        if (!currentUser?.id) return;
        const [friendsRes, requestsRes, invitesRes] = await Promise.all([
            fetch(`${API_URL}/api/friends?userId=${currentUser.id}`),
            fetch(`${API_URL}/api/friends/requests?userId=${currentUser.id}`),
            fetch(`${API_URL}/api/competition/invitations?userId=${currentUser.id}`)
        ]);

        const friendsData = await friendsRes.json();
        const requestsData = await requestsRes.json();
        const invitesData = await invitesRes.json();

        renderFriendsList(Array.isArray(friendsData.friends) ? friendsData.friends : []);
        renderFriendRequests(Array.isArray(requestsData.requests) ? requestsData.requests : []);
        renderCompetitionInvites(Array.isArray(invitesData.invitations) ? invitesData.invitations : []);
    } catch (err) {
        console.error('Error loading friends data:', err);
    }
}

function renderFriendsList(friends) {
    const el = document.getElementById('friends-list');
    if (!el) return;
    const countEl = document.getElementById('friends-count');
    if (countEl) {
        countEl.textContent = friends.length;
        countEl.style.display = friends.length ? 'inline-flex' : 'none';
    }
    if (!friends.length) {
        el.innerHTML = `<div class="friend-item"><div class="friend-item__left"><div class="friend-item__meta">No friends yet.</div></div></div>`;
        return;
    }
    el.innerHTML = friends.map(f => `
        <div class="friend-item" role="button" data-friend-id="${f.id}">
            <div class="friend-item__left">
                <div class="friend-item__name">${escapeHtml(f.username || '')}</div>
                <div class="friend-item__meta">View profile</div>
            </div>
        </div>
    `).join('');
    el.querySelectorAll('.friend-item[role="button"]').forEach(item => {
        item.addEventListener('click', () => openFriendProfile(parseInt(item.dataset.friendId)));
    });
}

function renderFriendRequests(requests) {
    const el = document.getElementById('friend-requests-list');
    if (!el) return;
    const countEl = document.getElementById('friend-requests-count');
    if (countEl) {
        countEl.textContent = requests.length;
        countEl.style.display = requests.length ? 'inline-flex' : 'none';
    }
    if (!requests.length) {
        el.innerHTML = `<div class="friend-item"><div class="friend-item__left"><div class="friend-item__meta">No pending requests.</div></div></div>`;
        return;
    }
    el.innerHTML = requests.map(r => `
        <div class="friend-item">
            <div class="friend-item__left">
                <div class="friend-item__name">${escapeHtml(r.requester_username || '')}</div>
                <div class="friend-item__meta">Wants to be friends</div>
            </div>
            <div class="friend-item__actions">
                <button class="btn-small btn-small-primary" data-action="accept" data-request-id="${r.id}">Accept</button>
                <button class="btn-small btn-small-danger" data-action="decline" data-request-id="${r.id}">Decline</button>
            </div>
        </div>
    `).join('');
    el.querySelectorAll('button[data-action="accept"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await acceptFriendRequest(parseInt(btn.dataset.requestId));
        });
    });
    el.querySelectorAll('button[data-action="decline"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await declineFriendRequest(parseInt(btn.dataset.requestId));
        });
    });
}

function renderCompetitionInvites(invitations) {
    const el = document.getElementById('competition-invites-list');
    if (!el) return;
    const countEl = document.getElementById('competition-invites-count');
    if (countEl) {
        countEl.textContent = invitations.length;
        countEl.style.display = invitations.length ? 'inline-flex' : 'none';
    }
    if (!invitations.length) {
        el.innerHTML = `<div class="friend-item"><div class="friend-item__left"><div class="friend-item__meta">No invites right now.</div></div></div>`;
        return;
    }
    el.innerHTML = invitations.map(inv => `
        <div class="friend-item">
            <div class="friend-item__left">
                <div class="friend-item__name">${escapeHtml(inv.competition_title || '')}</div>
                <div class="friend-item__meta">Invited by ${escapeHtml(inv.inviter_username || '')}</div>
            </div>
            <div class="friend-item__actions">
                <button class="btn-small btn-small-primary" data-invite-id="${inv.id}">Accept</button>
            </div>
        </div>
    `).join('');
    el.querySelectorAll('button[data-invite-id]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await acceptCompetitionInvite(parseInt(btn.dataset.inviteId));
        });
    });
}

async function sendFriendRequestFromUI() {
    try {
        if (!currentUser?.id) return;
        const input = document.getElementById('add-friend-username');
        const username = (input?.value || '').trim();
        if (!username) {
            showErrorModal('Missing Username', 'Enter a username to add.');
            return;
        }
        const res = await fetch(`${API_URL}/api/friends/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, friendUsername: username })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showErrorModal('Could Not Add Friend', data.error || 'Please try again.');
            return;
        }
        showSuccessModal('Friend Request', data.message || 'Request sent.');
        if (input) input.value = '';
        await loadFriendsData();
    } catch (err) {
        console.error('Error sending friend request:', err);
        showErrorModal('Error', 'Could not send friend request.');
    }
}

async function acceptFriendRequest(requestId) {
    try {
        const res = await fetch(`${API_URL}/api/friends/requests/${requestId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showErrorModal('Error', data.error || 'Could not accept request.');
            return;
        }
        showSuccessModal('Friend Added', 'You are now friends.');
        await loadFriendsData();
    } catch (err) {
        console.error('Error accepting request:', err);
        showErrorModal('Error', 'Could not accept request.');
    }
}

async function declineFriendRequest(requestId) {
    try {
        const res = await fetch(`${API_URL}/api/friends/requests/${requestId}/decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showErrorModal('Error', data.error || 'Could not decline request.');
            return;
        }
        await loadFriendsData();
    } catch (err) {
        console.error('Error declining request:', err);
        showErrorModal('Error', 'Could not decline request.');
    }
}

async function acceptCompetitionInvite(inviteId) {
    try {
        const response = await fetch(`${API_URL}/api/competition/invitations/${inviteId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            showErrorModal('Error', data.error || 'Failed to accept invite.');
            return;
        }
        showSuccessModal('Invite Accepted', 'You joined the competition.');
        await loadFriendsData();
        await loadCompetitionsList();
        if (data.competitionId) selectCompetition(data.competitionId);
    } catch (err) {
        console.error('Error accepting invite:', err);
        showErrorModal('Error', 'Failed to accept invite.');
    }
}

async function openFriendProfile(friendId) {
    try {
        selectedFriendId = friendId;
        const res = await fetch(`${API_URL}/api/users/${friendId}/summary?viewerId=${currentUser.id}&_=${Date.now()}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
            showErrorModal('Error', data.error || 'Could not load friend profile.');
            return;
        }

        document.getElementById('friend-empty').style.display = 'none';
        document.getElementById('friend-detail').style.display = 'block';
        document.getElementById('friend-detail-name').textContent = data.user.username;
        document.getElementById('friend-detail-subtitle').textContent = `Last 7 days: ${formatTime(Number(data.stats?.last7DaysMinutes || 0))}`;
        document.getElementById('friend-total-time').textContent = formatTime(Number(data.stats?.totalMinutes || 0));
        document.getElementById('friend-total-goals').textContent = String(Number(data.stats?.totalGoals || 0));
        document.getElementById('friend-active-goals').textContent = String(Number(data.stats?.activeGoals || 0));

        const topEl = document.getElementById('friend-top-goals');
        const top = Array.isArray(data.topGoals) ? data.topGoals : [];
        topEl.innerHTML = top.length
            ? top.map(g => `
                <div class="friends-top-goal">
                    <div class="friends-top-goal__title">${escapeHtml(g.title || '')}</div>
                    <div class="friends-top-goal__time">${formatTime(Number(g.totalMinutes || 0))}</div>
                </div>
            `).join('')
            : `<div class="friend-item"><div class="friend-item__left"><div class="friend-item__meta">No goal activity yet.</div></div></div>`;
    } catch (err) {
        console.error('Error opening friend profile:', err);
        showErrorModal('Error', 'Could not load friend profile.');
    }
}

async function checkPendingInvitations() {
    try {
        if (!currentUser) return;
        
        const response = await fetch(`${API_URL}/api/competition/invitations?userId=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success && data.invitations && data.invitations.length > 0) {
            showInvitationNotification(data.invitations);
        }
    } catch (error) {
        console.error('Error checking invitations:', error);
    }
}

function showInvitationNotification(invitations) {
    // Create or get notification container
    let notificationContainer = document.getElementById('invitation-notifications');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'invitation-notifications';
        notificationContainer.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; max-width: 400px;';
        document.body.appendChild(notificationContainer);
    }
    
    notificationContainer.innerHTML = '';
    
    invitations.forEach(invite => {
        const notification = document.createElement('div');
        notification.className = 'invitation-notification';
        notification.style.cssText = `
            background: var(--bg-secondary);
            border: 2px solid var(--accent);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 12px;">
                <strong style="color: var(--text-primary);">${invite.inviter_username}</strong> 
                <span style="color: var(--text-secondary);">invited you to</span>
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; color: var(--accent); margin-bottom: 4px;">${invite.competition_title}</div>
                ${invite.competition_description ? `<div style="font-size: 13px; color: var(--text-secondary);">${invite.competition_description}</div>` : ''}
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-primary" onclick="acceptInvitation(${invite.id})" style="flex: 1; padding: 10px;">Accept</button>
                <button class="btn-secondary" onclick="declineInvitation(${invite.id})" style="flex: 1; padding: 10px;">Decline</button>
            </div>
        `;
        
        notificationContainer.appendChild(notification);
    });
}

// Make functions globally accessible
window.openCompleteModal = openCompleteModal;
window.deleteGoal = deleteGoal;
window.deleteCompetitionLog = deleteCompetitionLog;
window.deleteGoalCompletionFromCompetition = deleteGoalCompletionFromCompetition;
window.acceptInvitation = async function(inviteId) {
    try {
        const response = await fetch(`${API_URL}/api/competition/invitations/${inviteId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessModal('Invitation Accepted', 'You have successfully joined the competition!');
            // Remove notification
            const notification = event.target.closest('.invitation-notification');
            if (notification) notification.remove();
            // Reload competition
            await loadCompetition();
        } else {
            showErrorModal('Error Accepting Invitation', data.error || 'Failed to accept the invitation.');
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        showErrorModal('Error', 'An error occurred while accepting the invitation. Please try again.');
    }
};

window.declineInvitation = function(inviteId) {
    // For now, just remove the notification
    const notification = event.target.closest('.invitation-notification');
    if (notification) notification.remove();
};
