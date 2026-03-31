const { getTimetable, addBunkRecord, getBunkCount } = require('../utils/db');

// In-memory attendance tracking per session (persisted in DB via bunk records)
// For "present" tracking, we assume present unless bunked

/**
 * Handle "attendance" or "my attendance" command
 * Shows attendance percentage per subject based on timetable + bunk history
 */
async function handleViewAttendance(client, message, phone) {
    // Get full timetable (all days)
    getTimetable(phone, null, (err, fullTimetable) => {
        if (err) {
            console.error('Error getting timetable:', err);
            message.reply('Sorry, I had trouble retrieving your attendance.');
            return;
        }
        
        if (!fullTimetable || fullTimetable.length === 0) {
            message.reply(
                '📊 No timetable set yet!\n\n' +
                'Set your timetable first (option 1) to track attendance.'
            );
            return;
        }
        
        // Get unique subjects
        const subjects = [...new Set(fullTimetable.map(c => c.subject))];
        
        // Count classes per week per subject
        const classesPerWeek = {};
        fullTimetable.forEach(cls => {
            if (!classesPerWeek[cls.subject]) classesPerWeek[cls.subject] = 0;
            classesPerWeek[cls.subject]++;
        });
        
        // Get bunk count for each subject
        let processed = 0;
        const attendanceData = [];
        
        subjects.forEach(subject => {
            getBunkCount(phone, subject, (err, bunkCount) => {
                // Estimate total classes: assume semester is ~16 weeks
                // Weekly classes × weeks elapsed (estimate from user creation)
                const weeklyClasses = classesPerWeek[subject] || 1;
                
                // For now, estimate 4 weeks of data
                const estimatedWeeks = 4;
                const totalEstimated = weeklyClasses * estimatedWeeks;
                const present = Math.max(0, totalEstimated - bunkCount);
                const percentage = totalEstimated > 0 ? ((present / totalEstimated) * 100).toFixed(1) : 100;
                
                let emoji = '🟢';
                if (percentage < 75) emoji = '🔴';
                else if (percentage < 85) emoji = '🟡';
                
                attendanceData.push({
                    subject,
                    bunkCount,
                    weeklyClasses,
                    totalEstimated,
                    present,
                    percentage: parseFloat(percentage),
                    emoji
                });
                
                processed++;
                
                if (processed === subjects.length) {
                    // Sort by percentage ascending (worst first)
                    attendanceData.sort((a, b) => a.percentage - b.percentage);
                    
                    const overallPresent = attendanceData.reduce((s, a) => s + a.present, 0);
                    const overallTotal = attendanceData.reduce((s, a) => s + a.totalEstimated, 0);
                    const overallPercent = overallTotal > 0 ? ((overallPresent / overallTotal) * 100).toFixed(1) : 100;
                    
                    let response = '📊 *Attendance Report*\n\n';
                    
                    attendanceData.forEach(a => {
                        const bar = generateProgressBar(a.percentage);
                        response += `${a.emoji} *${a.subject}*\n`;
                        response += `   ${bar} ${a.percentage}%\n`;
                        response += `   ${a.present}/${a.totalEstimated} classes | ${a.bunkCount} bunked\n\n`;
                    });
                    
                    const overallEmoji = overallPercent < 75 ? '🔴' : overallPercent < 85 ? '🟡' : '🟢';
                    response += `━━━━━━━━━━━━━━━\n`;
                    response += `${overallEmoji} *Overall: ${overallPercent}%*\n\n`;
                    
                    if (overallPercent < 75) {
                        response += '⚠️ *WARNING:* Your attendance is below 75%!\nYou might face attendance shortage issues.';
                    } else if (overallPercent < 85) {
                        response += '💡 Your attendance is okay but could be better.\nTry to attend more classes!';
                    } else {
                        response += '🌟 Great attendance! Keep it up!';
                    }
                    
                    message.reply(response);
                }
            });
        });
    });
}

/**
 * Mark attendance as present for current class
 */
async function handleMarkPresent(client, message, phone) {
    await message.reply(
        '✅ *Attendance Noted!*\n\n' +
        'Your attendance is automatically tracked:\n' +
        '• Classes you bunk are recorded\n' +
        '• Everything else counts as present\n\n' +
        'View with: "my attendance" or option 15'
    );
}

/**
 * Generate a simple text progress bar
 */
function generateProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}

module.exports = {
    handleViewAttendance,
    handleMarkPresent
};
