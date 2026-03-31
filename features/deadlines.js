const { addDeadline, getDeadlines, deleteDeadline } = require('../utils/db');

// Handle adding deadline - supports multi-step flow
async function handleAddDeadline(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If user just sent "4" from menu
    if (msg === '4') {
        return {
            action: 'await_deadline_data',
            reply: '⏰ What\'s the deadline?\n\n' +
                   '*Examples:*\n' +
                   '• "submit math assignment by 25/12/2024"\n' +
                   '• "physics project tomorrow"\n' +
                   '• "chemistry lab report today"\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    // Try to extract date
    let deadlineDate = null;
    const datePatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})/,  // DD/MM/YYYY
        /(\d{1,2}-\d{1,2}-\d{4})/,    // DD-MM-YYYY
        /(\d{4}-\d{1,2}-\d{1,2})/     // YYYY-MM-DD
    ];
    
    for (const pattern of datePatterns) {
        const match = msg.match(pattern);
        if (match) {
            deadlineDate = match[1];
            // Try to normalize DD/MM/YYYY to YYYY-MM-DD
            if (deadlineDate.includes('/')) {
                const parts = deadlineDate.split('/');
                if (parts.length === 3 && parts[2].length === 4) {
                    deadlineDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            } else if (deadlineDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
                const parts = deadlineDate.split('-');
                deadlineDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            break;
        }
    }
    
    // Check for relative dates
    if (!deadlineDate) {
        if (msg.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            deadlineDate = tomorrow.toISOString().split('T')[0];
        } else if (msg.includes('today')) {
            deadlineDate = new Date().toISOString().split('T')[0];
        } else if (msg.match(/in\s+(\d+)\s+days?/)) {
            const daysFromNow = parseInt(msg.match(/in\s+(\d+)\s+days?/)[1]);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysFromNow);
            deadlineDate = futureDate.toISOString().split('T')[0];
        } else if (msg.includes('next week')) {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            deadlineDate = nextWeek.toISOString().split('T')[0];
        }
    }
    
    // Extract task/description
    let task = message.body;
    task = task.replace(/deadline|due|submit/gi, '').trim();
    
    // Remove date parts from task description
    task = task.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '');
    task = task.replace(/\d{1,2}-\d{1,2}-\d{4}/g, '');
    task = task.replace(/\d{4}-\d{1,2}-\d{1,2}/g, '');
    task = task.replace(/(today|tomorrow|next week|in\s+\d+\s+days?)/gi, '');
    task = task.replace(/(by|on|before)\s*/gi, '').trim();
    
    // Clean up extra spaces
    task = task.replace(/\s+/g, ' ').trim();
    
    if (!task || task.length < 3) {
        await message.reply(
            '❌ Please provide the task details.\n\n' +
            '*Examples:*\n' +
            '• "deadline submit math assignment by 25/12/2024"\n' +
            '• "due physics project tomorrow"\n' +
            '• "submit chemistry lab report today"'
        );
        return null;
    }
    
    if (!deadlineDate) {
        await message.reply(
            `📝 Got the task: "${task}"\n\n` +
            '❓ When is the deadline? Please specify the date.\n\n' +
            '*Examples:*\n' +
            '• "25/12/2024"\n' +
            '• "tomorrow"\n' +
            '• "in 3 days"\n' +
            '• "next week"'
        );
        return null;
    }
    
    addDeadline(phone, task, deadlineDate, (err) => {
        if (err) {
            console.error('Error adding deadline:', err);
            message.reply('Sorry, I had trouble adding that deadline. Please try again.');
            return;
        }
        
        // Calculate days until deadline
        const daysLeft = Math.ceil((new Date(deadlineDate) - new Date()) / (1000 * 60 * 60 * 24));
        const urgency = daysLeft <= 1 ? '🔴' : daysLeft <= 3 ? '🟡' : '🟢';
        
        message.reply(
            `✅ *Deadline Added*\n\n` +
            `${urgency} Task: ${task}\n` +
            `📅 Due: ${deadlineDate}\n` +
            `⏳ ${daysLeft} day(s) remaining`
        );
    });
    
    return null;
}

// Handle viewing deadlines
async function handleViewDeadlines(client, message, phone) {
    getDeadlines(phone, (err, deadlines) => {
        if (err) {
            console.error('Error getting deadlines:', err);
            message.reply('Sorry, I had trouble retrieving your deadlines. Please try again.');
            return;
        }
        
        if (deadlines.length === 0) {
            message.reply('📝 No deadlines found!\n\nAdd one with: "deadline [task] by [date]"');
            return;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const overdue = deadlines.filter(d => new Date(d.deadline_date) < today);
        const upcoming = deadlines.filter(d => new Date(d.deadline_date) >= today);
        
        let response = '⏰ *Your Deadlines:*\n\n';
        
        if (overdue.length > 0) {
            response += '🔴 *OVERDUE:*\n';
            overdue.forEach((deadline, index) => {
                const daysOverdue = Math.ceil((today - new Date(deadline.deadline_date)) / (1000 * 60 * 60 * 24));
                response += `  ${index + 1}. ${deadline.task}\n`;
                response += `     Due: ${deadline.deadline_date} (${daysOverdue} days overdue!)\n`;
            });
            response += '\n';
        }
        
        if (upcoming.length > 0) {
            response += '📋 *Upcoming:*\n';
            upcoming.forEach((deadline, index) => {
                const daysLeft = Math.ceil((new Date(deadline.deadline_date) - today) / (1000 * 60 * 60 * 24));
                const urgency = daysLeft <= 1 ? '🔴' : daysLeft <= 3 ? '🟡' : '🟢';
                
                response += `  ${index + 1}. ${urgency} ${deadline.task}\n`;
                response += `     Due: ${deadline.deadline_date} (${daysLeft} day${daysLeft !== 1 ? 's' : ''})\n`;
            });
        }
        
        if (upcoming.length === 0 && overdue.length === 0) {
            response += '🎉 All clear! No upcoming deadlines.';
        }
        
        message.reply(response.trim());
    });
}

module.exports = {
    handleAddDeadline,
    handleViewDeadlines
};
