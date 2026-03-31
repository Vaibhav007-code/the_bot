const { saveTimetable, getTimetable, clearTimetable, getChatId } = require('../utils/db');
const { extractTimetableInfo, normalizeDay } = require('../utils/intent');

// Handle timetable update - supports both direct format and multi-step menu flow
async function handleTimetableUpdate(client, message, phone, conversationState) {
    let textToParse = message.body;
    
    // If user sent just "1" from menu, ask for timetable data
    if (textToParse.trim() === '1' || textToParse.toLowerCase().trim() === 'timetable' || textToParse.toLowerCase().trim() === 'set timetable') {
        return {
            action: 'await_timetable_data',
            reply: '📚 Please send your timetable in one of these formats (Venues/Rooms are optional):\n\n' +
                   '*Format 1 (Text):*\n' +
                   'Mon: Math 09:00-10:00 Room 302, Physics 11:00-12:00\n\n' +
                   '*Format 2 (JSON):*\n' +
                   '{\n' +
                   '  "Mon": [\n' +
                   '    {"subject": "Math", "start": "09:00", "end": "10:00", "venue": "Room 302"}\n' +
                   '  ]\n' +
                   '}\n\n' +
                   '*Format 3 (Time with AM/PM):*\n' +
                   'Mon: Math 9am-10am Lab 2\n\n' +
                   'Send "cancel" to go back to menu.'
        };
    }
    
    const timetableData = extractTimetableInfo(textToParse);
    
    if (timetableData.length === 0) {
        await message.reply(
            '❌ I couldn\'t parse your timetable. Please check the format.\n\n' +
            '📝 *Example formats:*\n' +
            'Mon: Math 09:00-10:00 Room 302\n\n' +
            'Or JSON:\n' +
            '{"Mon": [{"subject": "Math", "start": "09:00", "end": "10:00", "venue": "Room 302"}]}\n\n' +
            'Required: day, subject, start time, end time. (Venue is optional)'
        );
        return null;
    }
    
    // Clear existing timetable for these days and save new
    const uniqueDays = [...new Set(timetableData.map(item => item.day))];
    let clearedDays = 0;
    
    const clearAndSave = () => {
        if (clearedDays < uniqueDays.length) {
            const day = uniqueDays[clearedDays];
            clearTimetable(phone, day, (err) => {
                if (err) {
                    console.error(`Error clearing timetable for ${day}:`, err);
                }
                clearedDays++;
                clearAndSave();
            });
        } else {
            // Save new timetable entries
            let savedEntries = 0;
            
            timetableData.forEach((entry) => {
                saveTimetable(phone, entry.day, entry.subject, entry.start_time, entry.end_time, entry.venue, (err) => {
                    if (err) {
                        console.error('Error saving timetable entry:', err);
                    }
                    savedEntries++;
                    
                    if (savedEntries === timetableData.length) {
                        let response = '✅ Timetable updated successfully!\n\n';
                        
                        // Group by day for cleaner display
                        const grouped = {};
                        for (const e of timetableData) {
                            if (!grouped[e.day]) grouped[e.day] = [];
                            grouped[e.day].push(e);
                        }
                        
                        for (const [day, entries] of Object.entries(grouped)) {
                            response += `📅 *${day}:*\n`;
                            // Sort entries by start time
                            entries.sort((a, b) => a.start_time.localeCompare(b.start_time));
                            for (const e of entries) {
                                const v = e.venue ? ` (📍 ${e.venue})` : '';
                                response += `   ${e.start_time}-${e.end_time}: *${e.subject}*${v}\n`;
                            }
                            response += '\n';
                        }
                        
                        response += '🔔 I\'ll remind you 5 minutes before each class!';
                        message.reply(response);
                    }
                });
            });
        }
    };
    
    clearAndSave();
    return null;
}

// Handle viewing timetable
async function handleViewTimetable(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // Check if user specified a particular day
    const dayMatch = msg.match(/(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)/i);
    
    if (dayMatch) {
        // View specific day
        const matchedDay = normalizeDay(dayMatch[1]);
        
        getTimetable(phone, matchedDay, (err, timetable) => {
            if (err) {
                console.error(`Error getting timetable for ${matchedDay}:`, err);
                message.reply('Sorry, I had trouble retrieving your timetable.');
                return;
            }
            
            if (!timetable || timetable.length === 0) {
                message.reply(`📚 You don't have any classes scheduled for *${matchedDay}*.`);
                return;
            }
            
            // Sort by start time
            timetable.sort((a, b) => a.start_time.localeCompare(b.start_time));
            
            let response = `📅 *Timetable for ${matchedDay}:*\n\n`;
            timetable.forEach(cls => {
                const venueStr = cls.venue ? ` 📍 ${cls.venue}` : '';
                response += `⏰ ${cls.start_time} - ${cls.end_time} : *${cls.subject}*${venueStr}\n`;
            });
            
            message.reply(response);
        });
    } else {
        // View all days
        getTimetable(phone, null, (err, allTimetable) => {
            if (err) {
                console.error('Error getting full timetable:', err);
                message.reply('Sorry, I had trouble retrieving your timetable.');
                return;
            }
            
            if (!allTimetable || allTimetable.length === 0) {
                message.reply(
                    '📚 Your timetable is empty!\n\n' +
                    'Set it up using option 1 or type "set timetable".'
                );
                return;
            }
            
            const daysOrder = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
            
            // Group and sort
            const grouped = {};
            daysOrder.forEach(d => grouped[d] = []);
            
            allTimetable.forEach(cls => {
                if (grouped[cls.day]) {
                    grouped[cls.day].push(cls);
                } else {
                    grouped[cls.day] = [cls];
                }
            });
            
            let response = '📚 *Your Full Timetable:*\n\n';
            let hasClasses = false;
            
            for (const day of daysOrder) {
                const classes = grouped[day];
                if (classes && classes.length > 0) {
                    hasClasses = true;
                    response += `📅 *${day}:*\n`;
                    // Sort by time
                    classes.sort((a, b) => a.start_time.localeCompare(b.start_time));
                    
                    classes.forEach(cls => {
                        const venueStr = cls.venue ? ` (📍 ${cls.venue})` : '';
                        response += `  ⏰ ${cls.start_time}-${cls.end_time}: ${cls.subject}${venueStr}\n`;
                    });
                    response += '\n';
                }
            }
            
            if (!hasClasses) {
                response = '📚 Your timetable is empty!';
            }
            
            message.reply(response.trim());
        });
    }
}

// Handle updating a single class entry
async function handleUpdateSingleClass(client, message, phone) {
    const { extractSingleClassUpdate } = require('../utils/intent');
    const updateData = extractSingleClassUpdate(message.body);
    
    if (!updateData) {
        await message.reply(
            '❌ I couldn\'t understand that update.\n\n' +
            '*Example format:*\n' +
            '"update monday dbms 325 to 420"\n' +
            '"update tue math 10:00 to 11:00"'
        );
        return;
    }
    
    const { day, subject, start_time, end_time, venue } = updateData;
    
    getTimetable(phone, day, (err, currentTimetable) => {
        if (err) {
            message.reply('Sorry, I had trouble retrieving your timetable to update it.');
            return;
        }
        
        let newTimetable = currentTimetable || [];
        
        // Remove any existing class with the SAME subject OR same exact start_time (to prevent overlaps)
        newTimetable = newTimetable.filter(cls => 
            cls.subject.toLowerCase() !== subject.toLowerCase() && 
            cls.start_time !== start_time
        );
        
        // Add the new class
        newTimetable.push({ day, subject, start_time, end_time, venue: venue || '' });
        
        // Sort chronologically
        newTimetable.sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        // Now rewrite the entire day back into DB
        clearTimetable(phone, day, (err) => {
            if (err) {
                message.reply('Sorry, I had trouble updating your timetable.');
                return;
            }
            
            let savedCount = 0;
            newTimetable.forEach(cls => {
                saveTimetable(phone, day, cls.subject, cls.start_time, cls.end_time, cls.venue, (err) => {
                    savedCount++;
                    if (savedCount === newTimetable.length) {
                        message.reply(
                            `✅ *Timetable Updated*\n\n` +
                            `📅 *${day}:*\n` +
                            newTimetable.map(c => `⏰ ${c.start_time}-${c.end_time}: *${c.subject}*${c.venue ? ` (📍 ${c.venue})` : ''}`).join('\n')
                        );
                    }
                });
            });
        });
    });
}

// Handle deleting a single class entry
async function handleDeleteSingleClass(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    const cleanMsg = msg.replace(/^(?:delete|remove|cancel)\s+(?:timetable\s+|schedule\s+|class\s+)?/i, '').trim();
    
    // Find day at the start
    const dayMatch = cleanMsg.match(/^(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s+/i);
    
    if (!dayMatch) {
         await message.reply('❌ Could not understand the class to delete. Format: "delete wed math"');
         return;
    }
    const day = normalizeDay(dayMatch[1]);
    const subject = cleanMsg.substring(dayMatch[0].length).trim();
    
    if (!subject) {
        await message.reply('❌ Please specify the subject to delete. Format: "delete wed math"');
        return;
    }

    getTimetable(phone, day, (err, currentTimetable) => {
        if (err) return message.reply('Sorry, error getting timetable.');
        
        const originalCount = (currentTimetable || []).length;
        const newTimetable = (currentTimetable || []).filter(cls => 
            !cls.subject.toLowerCase().includes(subject.toLowerCase())
        );
        
        if (originalCount === newTimetable.length) {
            return message.reply(`ℹ️ Couldn't find a class matching "${subject}" on ${day}.`);
        }
        
        clearTimetable(phone, day, (err) => {
            if (newTimetable.length === 0) {
                 return message.reply(`✅ Deleted "${subject}". ${day} is now completely empty!`);
            }
            let savedCount = 0;
            newTimetable.forEach(cls => {
                saveTimetable(phone, day, cls.subject, cls.start_time, cls.end_time, cls.venue, (err) => {
                    savedCount++;
                    if (savedCount === newTimetable.length) {
                        message.reply(`✅ Deleted "${subject}". Updated ${day}:\n\n` + newTimetable.map(c => `⏰ ${c.start_time}-${c.end_time}: *${c.subject}*${c.venue ? ` 📍 ${c.venue}` : ''}`).join('\n'));
                    }
                });
            });
        });
    });
}

// Send class reminders
async function sendClassReminders(client, activeUsers) {
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = days[now.getDay()];
    
    // Get all users
    const { getAllUsers } = require('../utils/db');
    
    getAllUsers((err, users) => {
        if (err) {
            console.error('Error getting users for class reminders:', err);
            return;
        }
        
        users.forEach(user => {
            getTimetable(user.phone, currentDay, (err, timetable) => {
                if (err) {
                    console.error(`Error getting timetable for ${user.phone}:`, err);
                    return;
                }
                
                timetable.forEach(cls => {
                    // Check if class starts in 5 minutes
                    const [classHour, classMin] = cls.start_time.split(':');
                    const classTime = new Date();
                    classTime.setHours(parseInt(classHour), parseInt(classMin), 0, 0);
                    
                    const reminderTime = new Date(classTime);
                    reminderTime.setMinutes(reminderTime.getMinutes() - 5);
                    
                    // Check if current time matches reminder time (within 1 minute window)
                    const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
                    if (timeDiff < 60000) { // Within 1 minute
                        const chatId = getChatId(user.phone);
                        const v = cls.venue ? `\n📍 Venue: *${cls.venue}*` : '';
                        client.sendMessage(chatId,
                            `🔔 *${cls.subject}* starts at ${cls.start_time} (ends at ${cls.end_time}) in 5 minutes!${v}`
                        ).catch(err => {
                            console.error(`Error sending reminder to ${user.phone}:`, err);
                        });
                    }
                });
            });
        });
    });
}

module.exports = {
    handleTimetableUpdate,
    handleViewTimetable,
    handleUpdateSingleClass,
    handleDeleteSingleClass,
    sendClassReminders
};
