const { getTimetable, getChatId, getAllUsers } = require('../utils/db');

// Track which classes have been notified (to avoid duplicate notifs)
// Key: `${phone}_${day}_${subject}_${type}` -> timestamp
const classNotifications = new Map();

// Get today's day in uppercase format
function getTodayDay() {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[new Date().getDay()];
}

// Check if we already sent this notification today
function alreadyNotified(phone, subject, type) {
    const key = `${phone}_${getTodayDay()}_${subject}_${type}`;
    const lastSent = classNotifications.get(key);
    if (!lastSent) return false;
    
    // Check if it was sent today
    const today = new Date().toDateString();
    return new Date(lastSent).toDateString() === today;
}

// Mark notification as sent
function markNotified(phone, subject, type) {
    const key = `${phone}_${getTodayDay()}_${subject}_${type}`;
    classNotifications.set(key, Date.now());
}

/**
 * Class Live Tracker - runs every minute via cron
 * 
 * Sends 3 types of notifications:
 * 1. 🟢 "Class Started" — exactly at class start time
 * 2. 📍 "Class LIVE" — (optional, only if class > 30 mins, sent at midpoint)
 * 3. 🔴 "Class Ended" — exactly at class end time
 */
async function trackClassLive(client, activeUsers) {
    const now = new Date();
    const currentDay = getTodayDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    getAllUsers((err, users) => {
        if (err) {
            console.error('Error getting users for class tracking:', err);
            return;
        }
        
        users.forEach(user => {
            getTimetable(user.phone, currentDay, (err, timetable) => {
                if (err || !timetable || timetable.length === 0) return;
                
                timetable.forEach(cls => {
                    const [startH, startM] = cls.start_time.split(':').map(Number);
                    const [endH, endM] = cls.end_time.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;
                    const duration = endMinutes - startMinutes;
                    const midpoint = startMinutes + Math.floor(duration / 2);
                    
                    const chatId = getChatId(user.phone);
                    
                    // 🟢 CLASS STARTED - at start time
                    if (currentMinutes === startMinutes && !alreadyNotified(user.phone, cls.subject, 'start')) {
                        markNotified(user.phone, cls.subject, 'start');
                        const v = cls.venue ? `\n📍 Venue: *${cls.venue}*` : '';
                        client.sendMessage(chatId,
                            `🟢 *CLASS STARTED*\n\n` +
                            `📚 *${cls.subject}*${v}\n` +
                            `⏰ ${cls.start_time} → ${cls.end_time}\n` +
                            `⏱️ Duration: ${duration} minutes\n\n` +
                            `Focus mode ON! 📖`
                        ).catch(err => console.error(`Error sending class start to ${user.phone}:`, err));
                    }
                    
                    // 📍 CLASS LIVE - at midpoint (only for classes > 30 mins)
                    if (duration > 30 && currentMinutes === midpoint && !alreadyNotified(user.phone, cls.subject, 'live')) {
                        markNotified(user.phone, cls.subject, 'live');
                        const remainingMins = endMinutes - currentMinutes;
                        client.sendMessage(chatId,
                            `📍 *${cls.subject} — LIVE*\n\n` +
                            `⏱️ ${remainingMins} minutes remaining\n` +
                            `📝 Stay focused! Half-way through.`
                        ).catch(err => console.error(`Error sending class live to ${user.phone}:`, err));
                    }
                    
                    // 🔴 CLASS ENDED - at end time
                    if (currentMinutes === endMinutes && !alreadyNotified(user.phone, cls.subject, 'end')) {
                        markNotified(user.phone, cls.subject, 'end');
                        
                        // Find next class
                        const nextClass = timetable.find(c => {
                            const [nH, nM] = c.start_time.split(':').map(Number);
                            return (nH * 60 + nM) > endMinutes;
                        });
                        
                        let nextInfo = '';
                        if (nextClass) {
                            const [nH, nM] = nextClass.start_time.split(':').map(Number);
                            const gap = (nH * 60 + nM) - endMinutes;
                            const nextV = nextClass.venue ? ` (📍 ${nextClass.venue})` : '';
                            nextInfo = `\n\n⏭️ Next: *${nextClass.subject}* at ${nextClass.start_time}${nextV} (${gap} min break)`;
                        } else {
                            nextInfo = '\n\n🎉 No more classes today!';
                        }
                        
                        client.sendMessage(chatId,
                            `🔴 *CLASS ENDED*\n\n` +
                            `📚 *${cls.subject}* is over!` +
                            nextInfo
                        ).catch(err => console.error(`Error sending class end to ${user.phone}:`, err));
                    }
                });
            });
        });
    });
}

/**
 * Get current class status for a user (for "class status" command)
 */
function getClassStatus(phone, callback) {
    const now = new Date();
    const currentDay = getTodayDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    getTimetable(phone, currentDay, (err, timetable) => {
        if (err) return callback(err, null);
        if (!timetable || timetable.length === 0) {
            return callback(null, { status: 'no_classes', message: 'No classes today!' });
        }
        
        // Find current class
        const currentClass = timetable.find(cls => {
            const [sH, sM] = cls.start_time.split(':').map(Number);
            const [eH, eM] = cls.end_time.split(':').map(Number);
            return currentMinutes >= (sH * 60 + sM) && currentMinutes < (eH * 60 + eM);
        });
        
        if (currentClass) {
            const [eH, eM] = currentClass.end_time.split(':').map(Number);
            const remaining = (eH * 60 + eM) - currentMinutes;
            
            // Find next class
            const [endH, endM] = currentClass.end_time.split(':').map(Number);
            const endMinutes = endH * 60 + endM;
            const nextClass = timetable.find(c => {
                const [nH, nM] = c.start_time.split(':').map(Number);
                return (nH * 60 + nM) > endMinutes;
            });
            
            return callback(null, {
                status: 'live',
                currentClass,
                remaining,
                nextClass,
                allClasses: timetable
            });
        }
        
        // Find next upcoming class
        const nextClass = timetable.find(cls => {
            const [sH, sM] = cls.start_time.split(':').map(Number);
            return (sH * 60 + sM) > currentMinutes;
        });
        
        if (nextClass) {
            const [sH, sM] = nextClass.start_time.split(':').map(Number);
            const minsUntil = (sH * 60 + sM) - currentMinutes;
            return callback(null, {
                status: 'break',
                nextClass,
                minsUntil,
                allClasses: timetable
            });
        }
        
        return callback(null, {
            status: 'done',
            message: 'All classes are done for today!',
            allClasses: timetable
        });
    });
}

module.exports = {
    trackClassLive,
    getClassStatus
};
