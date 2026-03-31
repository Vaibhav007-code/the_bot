const { getExpenses, getTasks, getAllUsers, getUser, getUserSettings, getChatId } = require('../utils/db');

/**
 * Generate and send a weekly summary report
 * Called by cron on Sunday night, or manually via "weekly summary"
 */
async function handleWeeklySummary(client, message, phone) {
    generateWeeklySummary(phone, (err, summary) => {
        if (err) {
            console.error('Error generating weekly summary:', err);
            message.reply('Sorry, I had trouble generating your weekly summary.');
            return;
        }
        message.reply(summary);
    });
}

/**
 * Generate weekly summary text for a user
 */
function generateWeeklySummary(phone, callback) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    
    // Get this week's expenses
    getExpenses(phone, null, (err, allExpenses) => {
        if (err) return callback(err, null);
        
        const weekExpenses = allExpenses.filter(e => e.date >= weekStartStr && e.date <= todayStr);
        const totalSpent = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        // Category breakdown
        const byCategory = {};
        weekExpenses.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
        });
        
        // Get all tasks (completed and pending)
        const { readData } = require('../utils/db');
        
        getTasks(phone, null, (err, pendingTasks) => {
            if (err) return callback(err, null);
            
            // Count tasks completed this week (approximate)
            // Since completed tasks are marked with completed=1, we need raw data
            const fs = require('fs');
            const path = require('path');
            const dbPath = path.join(__dirname, '..', 'data', 'buddy.json');
            
            let completedThisWeek = 0;
            let totalTasksThisWeek = 0;
            
            try {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const allTasks = data.daily_tasks[phone] || [];
                
                allTasks.forEach(t => {
                    if (t.task_date >= weekStartStr && t.task_date <= todayStr) {
                        totalTasksThisWeek++;
                        if (t.completed === 1) completedThisWeek++;
                    }
                });
            } catch (e) {
                // Ignore read errors
            }
            
            // Get bunk count this week
            let bunksThisWeek = 0;
            try {
                const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                const bunkHistory = (data.bunk_history && data.bunk_history[phone]) || [];
                bunksThisWeek = bunkHistory.filter(b => b.date >= weekStartStr && b.date <= todayStr).length;
            } catch (e) {
                // Ignore
            }
            
            // Build summary
            let summary = '📈 *WEEKLY SUMMARY*\n';
            summary += `📅 ${weekStartStr} → ${todayStr}\n\n`;
            
            // Expenses section
            summary += '💰 *Expenses:*\n';
            if (weekExpenses.length > 0) {
                summary += `   Total: ₹${totalSpent.toFixed(2)} (${weekExpenses.length} transactions)\n`;
                
                // Top categories
                const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
                sortedCats.slice(0, 3).forEach(([cat, amount]) => {
                    const pct = ((amount / totalSpent) * 100).toFixed(0);
                    summary += `   • ${cat}: ₹${amount.toFixed(2)} (${pct}%)\n`;
                });
                
                // Daily average
                const dailyAvg = (totalSpent / 7).toFixed(2);
                summary += `   📊 Daily avg: ₹${dailyAvg}\n`;
            } else {
                summary += '   No expenses recorded this week\n';
            }
            summary += '\n';
            
            // Tasks section
            summary += '📝 *Tasks:*\n';
            summary += `   Total: ${totalTasksThisWeek} tasks\n`;
            summary += `   ✅ Completed: ${completedThisWeek}\n`;
            summary += `   ⏳ Pending: ${pendingTasks.length}\n`;
            if (totalTasksThisWeek > 0) {
                const completionRate = ((completedThisWeek / totalTasksThisWeek) * 100).toFixed(0);
                summary += `   📊 Completion rate: ${completionRate}%\n`;
            }
            summary += '\n';
            
            // Attendance section
            summary += '📚 *Attendance:*\n';
            summary += `   Classes bunked: ${bunksThisWeek}\n`;
            if (bunksThisWeek === 0) {
                summary += '   🌟 Perfect attendance this week!\n';
            } else if (bunksThisWeek <= 2) {
                summary += '   👍 Not bad, try to attend more!\n';
            } else {
                summary += '   ⚠️ Too many bunks! Watch your attendance.\n';
            }
            summary += '\n';
            
            // Motivational ending
            const tips = [
                '💡 *Tip:* Set small, achievable goals each day.',
                '💡 *Tip:* Take breaks every 45 mins while studying.',
                '💡 *Tip:* Review today\'s notes before sleeping.',
                '💡 *Tip:* Track every expense, no matter how small.',
                '💡 *Tip:* Plan tomorrow before going to bed.',
                '💡 *Tip:* Drink water and stay hydrated!'
            ];
            summary += tips[Math.floor(Math.random() * tips.length)];
            
            callback(null, summary);
        });
    });
}

/**
 * Auto-send weekly summary to all active users (Sunday cron)
 */
async function sendWeeklySummaryToAll(client, activeUsers) {
    getAllUsers((err, users) => {
        if (err) return;
        
        users.forEach(user => {
            const state = activeUsers ? activeUsers.get(user.phone) : null;
            if (!state || !state.started) return;
            
            getUser(user.phone, (err, userInfo) => {
                if (err || !userInfo) return;
                
                generateWeeklySummary(user.phone, (err, summary) => {
                    if (err) return;
                    
                    const chatId = getChatId(user.phone);
                    const header = `Hey ${userInfo.name}! Here's your week in review 📊\n\n`;
                    client.sendMessage(chatId, header + summary).catch(err => {
                        console.error(`Error sending weekly summary to ${user.phone}:`, err);
                    });
                });
            });
        });
    });
}

module.exports = {
    handleWeeklySummary,
    sendWeeklySummaryToAll
};
