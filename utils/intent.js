// Intent detection based on keywords (no external AI APIs)

function detectIntent(message) {
    const msg = message.toLowerCase().trim();
    
    // Start/stop commands
    if (msg === 'start') return 'start';
    if (msg === 'stop') return 'stop';
    
    // Number-based menu responses
    if (msg === '1') return 'update_timetable';
    if (msg === '2') return 'add_expense';
    if (msg === '3') return 'add_task';
    if (msg === '4') return 'add_deadline';
    if (msg === '5') return 'add_resource';
    if (msg === '6') return 'bunk_class';
    if (msg === '7') return 'view_tasks';
    if (msg === '8') return 'view_expenses';
    if (msg === '9') return 'view_deadlines';
    if (msg === '10') return 'view_resources';
    if (msg === '11') return 'set_planning_time';
    if (msg === '12') return 'set_morning_time';
    if (msg === '13') return 'plan_tomorrow';
    if (msg === '14') return 'help';
    
    // Menu command (separate from help)
    if (msg === 'menu') return 'menu';
    
    // Feature Menu numbers
    if (msg === '15') return 'view_attendance';
    if (msg === '16') return 'add_note';
    
    // ---- VIEW intents must come BEFORE add intents ----
    
    // View timetable (specific day or all)
    if (msg.includes('view timetable') || msg.includes('show timetable') || msg.includes('my timetable') || 
        (msg.includes('timetable') && (msg.includes('for') || /(mon|tue|wed|thu|fri|sat|sun)/i.test(msg)))) {
        return 'view_timetable';
    }
    
    // Live class status
    if (msg.includes('class status') || msg.includes('current class') || msg.includes('next class') || msg.includes('class now')) {
        return 'class_status';
    }
    
    // Attendance
    if (msg.includes('attendance') || msg.includes('my attendance')) {
        return 'view_attendance';
    }
    
    if (msg.includes('mark present') || msg.includes('present in class')) {
        return 'mark_present';
    }
    
    // View notes
    if (msg.includes('view note') || msg.includes('show note') || msg.includes('my note') || msg.includes('list note')) {
        return 'view_notes';
    }
    
    // View weekly summary
    if (msg.includes('weekly summary') || msg.includes('this week')) {
        return 'weekly_summary';
    }
    
    // View resources
    if (msg.includes('view resource') || msg.includes('show resource') || msg.includes('my resource') || msg.includes('list resource')) {
        return 'view_resources';
    }
    
    // View expenses
    if (msg.includes('view expense') || msg.includes('show expense') || msg.includes('my expense') || msg.includes('list expense')) {
        return 'view_expenses';
    }
    
    // View deadlines
    if (msg.includes('view deadline') || msg.includes('show deadline') || msg.includes('my deadline') || msg.includes('list deadline')) {
        return 'view_deadlines';
    }
    
    // View tasks
    if (msg.includes('view task') || msg.includes('my tasks') || msg.includes('today tasks') || msg.includes('show task') || msg.includes('list task')) {
        return 'view_tasks';
    }
    
    // Plan tomorrow
    if (msg.includes('plan tomorrow') || msg.includes('tomorrow plan')) {
        return 'plan_tomorrow';
    }
    
    // Time settings
    if (msg.includes('set planning time') || msg.includes('change planning time')) {
        return 'set_planning_time';
    }
    if (msg.includes('set morning time') || msg.includes('change morning time')) {
        return 'set_morning_time';
    }
    
    // Timetable related (Update/Set)
    if (/(?:update|add|set)(?:\s+timetable|\s+schedule|\s+class)?\s+/i.test(msg) && /(mon|tue|wed|thu|fri|sat|sun)/i.test(msg) && /\d/.test(msg) && /to|-|till/i.test(msg)) {
        return 'update_single_class';
    }
    if (msg.includes('set timetable') || msg.includes('update timetable') || msg === 'timetable') {
        return 'update_timetable';
    }
    
    // Bunk related
    if (msg.includes('bunk') || msg.includes('skip class')) {
        return 'bunk_class';
    }
    
    // Splitter related
    if (msg.includes('split') || msg.includes('divide')) {
        return 'split_expense';
    }
    
    // Summarizer related
    if (msg.includes('summarize') || msg.includes('summary')) {
        return 'summarize';
    }
    
    // Add note
    if (msg.startsWith('note') || msg.includes('add note') || msg.includes('note:')) {
        return 'add_note';
    }
    
    // Add resource
    if (msg.includes('add resource') || msg.includes('add material') || msg.includes('add notes') || msg.includes('resource:')) {
        return 'add_resource';
    }
    
    // Add expense
    if (msg.includes('expense') || msg.includes('spent') || msg.includes('paid')) {
        return 'add_expense';
    }
    
    // Add deadline
    if (msg.includes('deadline') || msg.includes('due') || msg.includes('submit')) {
        return 'add_deadline';
    }
    
    // Add task
    if (msg.includes('add task') || msg.includes('task:') || msg.includes('new task')) {
        return 'add_task';
    }
    
    // Complete task
    if (msg.includes('complete task') || msg.includes('done task') || msg.includes('finish task')) {
        return 'complete_task';
    }
    
    // Help
    if (msg.includes('help') || msg.includes('commands')) {
        return 'help';
    }
    
    // Greeting - use word boundary to avoid matching "physics", "this", etc.
    if (/\b(hi|hello|hey)\b/.test(msg)) {
        return 'greeting';
    }
    
    return 'unknown';
}

// Extract specific information from messages
function extractTimetableInfo(message) {
    const msg = message.trim();
    const timetableData = [];
    
    // Check if it's JSON format first
    try {
        // Try stripping markdown fences first
        let jsonStr = msg.replace(/.*?```(?:json)?\s*/i, '').replace(/\s*```.*/i, '');
        let jsonData = null;
        
        // Find arrays or objects
        const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        
        if (arrMatch) {
            try { jsonData = JSON.parse(arrMatch[0]); } catch(e){}
        }
        if (!jsonData && objMatch) {
            try { jsonData = JSON.parse(objMatch[0]); } catch(e){}
        }
        
        // Fallback to original raw message
        if (!jsonData) {
            const rawObj = msg.match(/\{[\s\S]*\}/);
            if (rawObj) {
                try { jsonData = JSON.parse(rawObj[0]); } catch(e){}
            }
        }
        
        if (jsonData) {
            if (Array.isArray(jsonData)) {
                for (const classInfo of jsonData) {
                    const subject = classInfo.subject || classInfo.name || classInfo.course;
                    const start = classInfo.start || classInfo.startTime || classInfo.start_time;
                    const end = classInfo.end || classInfo.endTime || classInfo.end_time;
                    const venue = classInfo.venue || classInfo.room || classInfo.location || classInfo.loc || '';
                    
                    if (classInfo.day && subject && start && end) {
                        timetableData.push({
                            day: normalizeDay(classInfo.day),
                            subject: subject,
                            start_time: normalizeTime(start),
                            end_time: normalizeTime(end),
                            venue: String(venue)
                        });
                    }
                }
            } else {
                for (const [day, classes] of Object.entries(jsonData)) {
                    if (!/mon|tue|wed|thu|fri|sat|sun/i.test(day)) continue;
                    
                    const normalizedDay = normalizeDay(day);
                    
                    if (Array.isArray(classes)) {
                        for (const classInfo of classes) {
                            const subject = classInfo.subject || classInfo.name || classInfo.course;
                            const start = classInfo.start || classInfo.startTime || classInfo.start_time;
                            const end = classInfo.end || classInfo.endTime || classInfo.end_time;
                            const venue = classInfo.venue || classInfo.room || classInfo.location || classInfo.loc || '';
                            
                            if (subject && start && end) {
                                timetableData.push({
                                    day: normalizedDay,
                                    subject: subject,
                                    start_time: normalizeTime(start),
                                    end_time: normalizeTime(end),
                                    venue: String(venue)
                                });
                            }
                        }
                    }
                }
            }
            
            const validEntries = timetableData.filter(d => d.subject && d.start_time && d.end_time);
            if (validEntries.length > 0) return validEntries;
            
            // Clean out array if JSON matched but schema failed
            timetableData.length = 0;
        }
    } catch (error) {
        // Not valid JSON, continue to raw text heuristic parsing
    }
    
    // Remove prefix keywords
    let cleanMsg = msg.replace(/^(timetable|schedule|set timetable|1)\s*/i, '').trim();
    
    // Parse text formats:
    // "Mon: Math 09:00-10:00, Physics 11:00-12:00 | Tue: DBMS 10:00-11:00"
    // "Monday Math 9am-10am, Physics 11am-12pm"
    
    const dayBlocks = cleanMsg.split('|');
    
    for (const block of dayBlocks) {
        // Use regex to split on first colon that follows a day name, NOT time colons
        const dayMatch = block.trim().match(/^(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*:?\s*(.*)/i);
        
        if (dayMatch) {
            const day = normalizeDay(dayMatch[1].trim());
            const classesStr = dayMatch[2].trim();
            
            // Split classes by comma
            const classes = classesStr.split(',');
            
            for (const classStr of classes) {
                const classInfo = parseClassTime(classStr.trim());
                if (classInfo) {
                    timetableData.push({
                        day,
                        subject: classInfo.subject,
                        start_time: classInfo.startTime,
                        end_time: classInfo.endTime,
                        venue: classInfo.venue
                    });
                }
            }
        }
    }
    
    return timetableData;
}

// Normalize day names - always returns uppercase 3-letter format
function normalizeDay(dayStr) {
    const dayMap = {
        'mon': 'MON', 'monday': 'MON',
        'tue': 'TUE', 'tuesday': 'TUE',
        'wed': 'WED', 'wednesday': 'WED',
        'thu': 'THU', 'thursday': 'THU',
        'fri': 'FRI', 'friday': 'FRI',
        'sat': 'SAT', 'saturday': 'SAT',
        'sun': 'SUN', 'sunday': 'SUN'
    };
    
    const normalized = dayStr.toLowerCase().trim();
    return dayMap[normalized] || dayStr.toUpperCase().substring(0, 3);
}

// Parse class time from various formats
function parseClassTime(classStr) {
    // Match: Subject TimeStart-TimeEnd
    // e.g. "Math 09:00-10:00" or "Physics 11am-12pm" or "Math 9:00 AM - 10:00 AM"
    
    // Try regex approach: find the subject (non-time words) and time range
    const timeRangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
    const match = classStr.match(timeRangeRegex);
    
    if (!match) return null;
    
    const timeRangeStart = match.index;
    const subject = classStr.substring(0, timeRangeStart).trim();
    
    if (!subject) return null;
    
    let venue = classStr.substring(match.index + match[0].length).trim();
    venue = venue.replace(/^(venue|room|at|in|on)\s*[>:-]?\s*/i, '').trim();
    
    const startTime = normalizeTime(match[1]);
    const endTime = normalizeTime(match[2]);
    
    if (!startTime || !endTime) return null;
    
    return {
        subject: subject.trim(),
        startTime,
        endTime,
        venue
    };
}

// Normalize time to 24-hour format
function normalizeTime(timeStr) {
    if (!timeStr) return null;
    
    // Remove extra spaces
    timeStr = timeStr.replace(/\s+/g, ' ').trim();
    
    // Check for AM/PM
    const isPM = /pm/i.test(timeStr);
    const isAM = /am/i.test(timeStr);
    
    // Remove AM/PM for parsing
    timeStr = timeStr.replace(/[ap]m/gi, '').trim();
    
    // Parse hours and minutes
    let hours, minutes = 0;
    
    if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':');
        hours = parseInt(h);
        minutes = parseInt(m || 0);
    } else {
        hours = parseInt(timeStr);
    }
    
    if (isNaN(hours)) return null;
    
    // Convert to 24-hour format
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    
    // Validate
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function extractTimeSetting(message) {
    const msg = message.toLowerCase();
    
    // Extract time from messages like "set planning time 10:30 PM" or "set morning time 8 AM"
    const timePattern = /(\d{1,2}:\d{2}\s*(am|pm)|\d{1,2}\s*(am|pm))/i;
    const match = msg.match(timePattern);
    
    if (match) {
        return normalizeTime(match[1]);
    }
    
    return null;
}

function extractTaskInfo(message) {
    const msg = message.toLowerCase().trim();
    
    // Extract date (today/tomorrow/custom)
    let date = new Date().toISOString().split('T')[0]; // Default to today
    
    if (msg.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
    }
    
    // Extract task text
    let task = message;
    
    // Remove common prefixes
    task = task.replace(/add task\s*/i, '');
    task = task.replace(/task:\s*/i, '');
    task = task.replace(/new task\s*/i, '');
    task = task.replace(/\s+(today|tomorrow)\s*/i, '');
    
    return { task: task.trim(), date };
}

function extractExpenseInfo(message) {
    const msg = message.toLowerCase();
    
    // Extract amount
    const amountMatch = msg.match(/(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    // Extract category
    let category = 'General';
    const categoryMap = {
        'food': 'Food', 'lunch': 'Food', 'dinner': 'Food', 'breakfast': 'Food',
        'snack': 'Food', 'tea': 'Food', 'coffee': 'Food', 'meal': 'Food',
        'transport': 'Transport', 'auto': 'Transport', 'cab': 'Transport',
        'bus': 'Transport', 'uber': 'Transport', 'ola': 'Transport', 'metro': 'Transport',
        'books': 'Books', 'stationery': 'Stationery', 'pen': 'Stationery',
        'entertainment': 'Entertainment', 'movie': 'Entertainment', 'game': 'Entertainment',
        'shopping': 'Shopping', 'clothes': 'Shopping',
        'recharge': 'Recharge', 'bill': 'Bills', 'rent': 'Bills',
        'medical': 'Medical', 'gym': 'Health', 'health': 'Health'
    };
    
    for (const [keyword, cat] of Object.entries(categoryMap)) {
        if (msg.includes(keyword)) {
            category = cat;
            break;
        }
    }
    
    // Extract description
    let description = message;
    description = description.replace(/expense|spent|paid|add expense/gi, '').trim();
    description = description.replace(/\d+(?:\.\d{1,2})?/g, '').trim();
    description = description.replace(/^(on|for|in)\s+/i, '').trim();
    
    return { amount, category, description };
}

function extractSingleClassUpdate(message) {
    const msg = message.toLowerCase().trim();
    
    // Strip "update ", "update timetable ", "add class " etc to find the day cleanly
    const cleanMsg = msg.replace(/^(?:update|add|set)\s+(?:timetable\s+|schedule\s+|class\s+)?/i, '').trim();
    
    // Find day at the start
    const dayMatch = cleanMsg.match(/^(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s+/i);
    if (!dayMatch) return null;
    
    const day = normalizeDay(dayMatch[1]);
    
    // Find time range
    const timeMatch = cleanMsg.match(/(\d{1,4}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|till)\s*(\d{1,4}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!timeMatch) return null;
    
    const startTimeStr = timeMatch[1];
    const endTimeStr = timeMatch[2];
    
    // Venue is whatever follows the time range
    let venue = cleanMsg.substring(timeMatch.index + timeMatch[0].length).trim();
    venue = venue.replace(/^(venue|room|at|in|on)\s*[>:-]?\s*/i, '').trim();
    
    // Subject is between day and time range
    const subjectRaw = cleanMsg.substring(dayMatch[0].length, timeMatch.index).trim();
    if (!subjectRaw) return null;
    
    // Title case the subject
    const subject = subjectRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Smart parse time that handles basic numbers like "325"
    const smartParseTime = (t) => {
        let clean = t.replace(/\s+/g, '').toLowerCase();
        const isPM = clean.includes('pm') || clean.includes('p.m');
        const isAM = clean.includes('am') || clean.includes('a.m');
        clean = clean.replace(/[ap]\.?m\.?/g, '');
        
        let h = 0, m = 0;
        if (clean.includes(':')) {
            const parts = clean.split(':');
            h = parseInt(parts[0]);
            m = parseInt(parts[1] || 0);
        } else {
            const num = parseInt(clean);
            if (num >= 100) {
                h = Math.floor(num / 100);
                m = num % 100;
            } else {
                h = num;
            }
        }
        
        if (isNaN(h)) return null;
        
        if (isPM && h !== 12) h += 12;
        if (isAM && h === 12) h = 0;
        
        // Smart inference for PM classes
        if (!isAM && !isPM && h >= 1 && h <= 7) {
            h += 12; // PM assumption
        }
        
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    const start_time = smartParseTime(startTimeStr);
    const end_time = smartParseTime(endTimeStr);
    
    if (!start_time || !end_time) return null;
    
    return { day, subject, start_time, end_time, venue };
}

module.exports = {
    detectIntent,
    extractTimetableInfo,
    extractTimeSetting,
    extractTaskInfo,
    extractExpenseInfo,
    extractSingleClassUpdate,
    normalizeDay
};
