const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Import utilities
const { initDB, createUser, getUser, isOnboarded, getUserSettings, normalizePhone, getChatId, getAllUsers } = require('./utils/db');
const { detectIntent } = require('./utils/intent');

// Import features
const { handleTimetableUpdate, handleViewTimetable, handleUpdateSingleClass, handleDeleteSingleClass, sendClassReminders } = require('./features/timetable');
const { handleBunkClass } = require('./features/bunk');
const { handleSplitExpense } = require('./features/splitter');
const { handleSummarize } = require('./features/summarizer');
const { handleAddResource, handleViewResources } = require('./features/resources');
const { handleAddExpense, handleViewExpenses } = require('./features/expenses');
const { handleAddDeadline, handleViewDeadlines } = require('./features/deadlines');
const { handleAddNote, handleViewNotes } = require('./features/notes');
const { handleViewAttendance, handleMarkPresent } = require('./features/attendance');
const { handleWeeklySummary, sendWeeklySummaryToAll } = require('./features/weekly-summary');
const { trackClassLive, getClassStatus } = require('./features/class-tracker');
const {
    handleAddTask,
    handleViewTasks,
    handleCompleteTask,
    handleSetPlanningTime,
    handleSetMorningTime,
    sendNightPlanningPrompt,
    sendMorningBrief,
    handleNightPlanningResponse
} = require('./features/planner');

// Initialize database
initDB();

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Initialize WhatsApp client with minimal configuration
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: sessionsDir
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_BIN || '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-software-rasterizer'
        ]
    }
});

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// Track active users (who have sent "start")
const activeUsers = new Map(); // phone -> { started: boolean }

// Track conversation state for multi-step flows
const conversationState = new Map(); // phone -> { action: string, data: any, timestamp: number }

// Track night planning state
const nightPlanningState = new Map(); // phone -> timestamp

// Conversation state timeout (5 minutes)
const STATE_TIMEOUT = 5 * 60 * 1000;

// Onboarding state
const onboardingState = new Set(); // phones currently in onboarding

// Get or init user state
function getUserState(phone) {
    if (!activeUsers.has(phone)) {
        activeUsers.set(phone, { started: false });
    }
    return activeUsers.get(phone);
}

// Check if conversation state is still valid
function getConversationState(phone) {
    const state = conversationState.get(phone);
    if (!state) return null;
    
    // Check if state has expired
    if (Date.now() - state.timestamp > STATE_TIMEOUT) {
        conversationState.delete(phone);
        return null;
    }
    
    return state;
}

// Set conversation state
function setConversationState(phone, action, data = {}) {
    conversationState.set(phone, {
        action,
        data,
        timestamp: Date.now()
    });
}

// Clear conversation state
function clearConversationState(phone) {
    conversationState.delete(phone);
}

// =============================================================================
// CLIENT EVENTS
// =============================================================================

// QR code display
client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(50));
    console.log('📱 BUDDY - WhatsApp Bot QR Code');
    console.log('='.repeat(50));
    console.log('\n1. Open WhatsApp on your phone');
    console.log('2. Tap the 3 dots (Android) or Settings (iPhone)');
    console.log('3. Select "Linked Devices"');
    console.log('4. Tap "Link a device" (green button)');
    console.log('5. Point your camera at this QR code\n');
    
    qrcode.generate(qr, { small: true });
    
    console.log('\n' + '='.repeat(50));
    console.log('⏳ QR Code expires in 2 minutes');
    console.log('🔄 If it expires, a new QR will appear automatically');
    console.log('='.repeat(50) + '\n');
});

// Authentication success
client.on('authenticated', () => {
    console.log('✅ Authentication successful!');
    console.log('🔐 Session saved - you won\'t need to scan again');
});

// Client ready
client.on('ready', () => {
    console.log('\n🎉 BUDDY is ready!');
    console.log('📱 WhatsApp bot for college students is now active');
    console.log('📨 Send "start" to begin using the bot\n');
});

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

client.on('message', async (message) => {
    try {
        // Ignore group messages, status updates, etc.
        if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
            return;
        }
        
        const phone = normalizePhone(message.from);
        const msgBody = (message.body || '').trim();
        
        // Ignore empty messages
        if (!msgBody && !message.hasMedia) return;
        
        console.log(`📨 Message from ${phone}: ${msgBody.substring(0, 100)}`);
        
        const userState = getUserState(phone);
        
        // =================================================================
        // GATE: Bot is SILENT until "start" is sent
        // =================================================================
        if (!userState.started) {
            if (msgBody.toLowerCase() === 'start') {
                userState.started = true;
                activeUsers.set(phone, userState);
                
                // Check if user is onboarded
                isOnboarded(phone, (err, onboarded) => {
                    if (err) {
                        console.error('Database error:', err);
                        message.reply('Sorry, I had trouble checking your profile. Please try again.');
                        return;
                    }
                    
                    if (!onboarded) {
                        // Start onboarding flow
                        onboardingState.add(phone);
                        message.reply(
                            '👋 *Welcome to BUDDY!*\n\n' +
                            'I\'m your personal college assistant. Let me get to know you!\n\n' +
                            'What\'s your name? Just type your first name.'
                        );
                    } else {
                        getUser(phone, (err, user) => {
                            if (err) {
                                console.error('Error getting user:', err);
                                message.reply('Sorry, I had trouble finding your profile.');
                                return;
                            }
                            sendMainMenu(message, user ? user.name : 'there');
                        });
                    }
                });
            }
            // COMPLETELY SILENT for any other message before "start"
            return;
        }
        
        // =================================================================
        // STOP command
        // =================================================================
        if (msgBody.toLowerCase() === 'stop') {
            userState.started = false;
            activeUsers.set(phone, userState);
            clearConversationState(phone);
            onboardingState.delete(phone);
            nightPlanningState.delete(phone);
            
            await message.reply(
                '👋 *BUDDY Paused*\n\n' +
                'I won\'t send any messages until you say "start" again.\n' +
                'Your data is saved and ready when you return!'
            );
            return;
        }
        
        // =================================================================
        // CANCEL command - exits any multi-step flow
        // =================================================================
        if (msgBody.toLowerCase() === 'cancel') {
            clearConversationState(phone);
            onboardingState.delete(phone);
            nightPlanningState.delete(phone);
            
            getUser(phone, (err, user) => {
                sendMainMenu(message, user ? user.name : 'there');
            });
            return;
        }
        
        // =================================================================
        // ONBOARDING FLOW
        // =================================================================
        if (onboardingState.has(phone)) {
            await handleOnboarding(message, phone);
            return;
        }
        
        // =================================================================
        // NIGHT PLANNING RESPONSE
        // =================================================================
        if (nightPlanningState.has(phone)) {
            const lastPrompt = nightPlanningState.get(phone);
            const timeDiff = Date.now() - lastPrompt;
            
            // If within 30 minutes of night planning prompt
            if (timeDiff < 30 * 60 * 1000) {
                handleNightPlanningResponse(client, message, phone);
                nightPlanningState.delete(phone);
                return;
            } else {
                nightPlanningState.delete(phone);
            }
        }
        
        // =================================================================
        // MULTI-STEP CONVERSATION FLOW
        // =================================================================
        const state = getConversationState(phone);
        if (state) {
            await handleConversationState(state, message, phone);
            return;
        }
        
        // =================================================================
        // INTENT DETECTION & ROUTING
        // =================================================================
        const intent = detectIntent(msgBody);
        await handleIntent(message, phone, intent);
        
    } catch (error) {
        console.error(`Error processing message:`, error);
        try {
            await message.reply('Sorry, something went wrong. Please try again.');
        } catch (replyError) {
            console.error('Error sending error reply:', replyError);
        }
    }
});

// =============================================================================
// MULTI-STEP CONVERSATION HANDLER
// =============================================================================

async function handleConversationState(state, message, phone) {
    const msgBody = message.body.toLowerCase().trim();
    
    switch (state.action) {
        case 'await_timetable_data':
            clearConversationState(phone);
            await handleTimetableUpdate(client, message, phone);
            break;
            
        case 'await_expense_data':
            clearConversationState(phone);
            await handleAddExpense(client, message, phone);
            break;
            
        case 'await_task_data':
            clearConversationState(phone);
            // Add the task with the user's reply
            const { extractTaskInfo } = require('./utils/intent');
            const { task, date } = extractTaskInfo(message.body);
            const { addTask } = require('./utils/db');
            
            if (task && task.length >= 2) {
                addTask(phone, task, date, (err) => {
                    if (err) {
                        message.reply('Sorry, I had trouble adding that task.');
                        return;
                    }
                    message.reply(
                        `✅ *Task Added*\n\n` +
                        `📝 ${task}\n` +
                        `📅 Date: ${date}\n\n` +
                        `View tasks with option 7 or "my tasks"`
                    );
                });
            } else {
                message.reply('❌ Please provide a valid task description.');
            }
            break;
            
        case 'await_deadline_data':
            clearConversationState(phone);
            await handleAddDeadline(client, message, phone);
            break;
            
        case 'await_resource_data':
            clearConversationState(phone);
            await handleAddResource(client, message, phone);
            break;
            
        case 'await_planning_time':
            clearConversationState(phone);
            const { extractTimeSetting } = require('./utils/intent');
            const planTime = extractTimeSetting(message.body) || message.body.trim();
            
            // Try direct 24h format
            if (/^\d{1,2}:\d{2}$/.test(planTime)) {
                const { setNightPlanningTime } = require('./utils/db');
                setNightPlanningTime(phone, planTime, (err) => {
                    if (err) {
                        message.reply('Sorry, I had trouble updating your planning time.');
                        return;
                    }
                    message.reply(`✅ Night planning time updated to *${planTime}*`);
                });
            } else {
                const time = extractTimeSetting(message.body);
                if (time) {
                    const { setNightPlanningTime } = require('./utils/db');
                    setNightPlanningTime(phone, time, (err) => {
                        if (err) {
                            message.reply('Sorry, I had trouble updating your planning time.');
                            return;
                        }
                        message.reply(`✅ Night planning time updated to *${time}*`);
                    });
                } else {
                    message.reply('❌ Please provide a valid time. Example: "10:30 PM" or "22:00"');
                }
            }
            break;
            
        case 'await_morning_time':
            clearConversationState(phone);
            const { extractTimeSetting: extractTime2 } = require('./utils/intent');
            const mornTime = extractTime2(message.body) || message.body.trim();
            
            if (/^\d{1,2}:\d{2}$/.test(mornTime)) {
                const { setMorningBriefTime } = require('./utils/db');
                setMorningBriefTime(phone, mornTime, (err) => {
                    if (err) {
                        message.reply('Sorry, I had trouble updating your morning time.');
                        return;
                    }
                    message.reply(`✅ Morning brief time updated to *${mornTime}*`);
                });
            } else {
                const time2 = extractTime2(message.body);
                if (time2) {
                    const { setMorningBriefTime } = require('./utils/db');
                    setMorningBriefTime(phone, time2, (err) => {
                        if (err) {
                            message.reply('Sorry, I had trouble updating your morning time.');
                            return;
                        }
                        message.reply(`✅ Morning brief time updated to *${time2}*`);
                    });
                } else {
                    message.reply('❌ Please provide a valid time. Example: "8 AM" or "07:30"');
                }
            }
            break;
            
        default:
            clearConversationState(phone);
            await message.reply('Session expired. Please try again.');
            break;
    }
}

// =============================================================================
// INTENT HANDLER
// =============================================================================

async function handleIntent(message, phone, intent) {
    try {
        let flowResult = null;
        
        switch (intent) {
            case 'update_timetable':
                flowResult = await handleTimetableUpdate(client, message, phone);
                break;
                
            case 'view_timetable':
                await handleViewTimetable(client, message, phone);
                break;
                
            case 'update_single_class':
                await handleUpdateSingleClass(client, message, phone);
                break;
                
            case 'delete_single_class':
                await handleDeleteSingleClass(client, message, phone);
                break;
                
            case 'bunk_class':
                await handleBunkClass(client, message, phone);
                break;
                
            case 'view_attendance':
                await handleViewAttendance(client, message, phone);
                break;
                
            case 'mark_present':
                await handleMarkPresent(client, message, phone);
                break;
                
            case 'class_status':
                getClassStatus(phone, (err, statusData) => {
                    if (err || !statusData) {
                        message.reply('Sorry, I had trouble checking your class status.');
                    } else if (statusData.status === 'no_classes') {
                        message.reply('🎉 No classes scheduled for today!');
                    } else if (statusData.status === 'live') {
                        const curV = statusData.currentClass.venue ? `\n📍 Venue: *${statusData.currentClass.venue}*` : '';
                        const nextV = statusData.nextClass && statusData.nextClass.venue ? ` (📍 ${statusData.nextClass.venue})` : '';
                        const nextStr = statusData.nextClass ? `⏭️ Next: ${statusData.nextClass.subject}${nextV}` : '🎉 Last class of the day!';
                        
                        message.reply(
                            `📍 *LIVE: ${statusData.currentClass.subject}*${curV}\n\n` +
                            `⏱️ ${statusData.remaining} minutes remaining\n` +
                            nextStr
                        );
                    } else if (statusData.status === 'break') {
                        const nextV = statusData.nextClass.venue ? `\n📍 Venue: *${statusData.nextClass.venue}*` : '';
                        message.reply(
                            `☕ *BREAK*\n\n` +
                            `⏭️ Next: *${statusData.nextClass.subject}*${nextV}\n` +
                            `⏱️ Starts in ${statusData.minsUntil} minutes`
                        );
                    } else {
                        message.reply('🎉 You are done with classes for today!');
                    }
                });
                break;
                
            case 'add_note':
                flowResult = await handleAddNote(client, message, phone);
                break;
                
            case 'view_notes':
                await handleViewNotes(client, message, phone);
                break;
                
            case 'weekly_summary':
                await handleWeeklySummary(client, message, phone);
                break;
                
            case 'split_expense':
                await handleSplitExpense(client, message, phone);
                break;
                
            case 'summarize':
                await handleSummarize(client, message, phone);
                break;
                
            case 'add_resource':
                flowResult = await handleAddResource(client, message, phone);
                break;
                
            case 'add_expense':
                flowResult = await handleAddExpense(client, message, phone);
                break;
                
            case 'add_deadline':
                flowResult = await handleAddDeadline(client, message, phone);
                break;
                
            case 'add_task':
                flowResult = await handleAddTask(client, message, phone);
                break;
                
            case 'view_tasks':
                await handleViewTasks(client, message, phone);
                break;
                
            case 'view_expenses':
                await handleViewExpenses(client, message, phone);
                break;
                
            case 'view_deadlines':
                await handleViewDeadlines(client, message, phone);
                break;
                
            case 'view_resources':
                await handleViewResources(client, message, phone);
                break;
                
            case 'plan_tomorrow':
                await handlePlanTomorrow(message, phone);
                break;
                
            case 'set_planning_time':
                flowResult = await handleSetPlanningTime(client, message, phone);
                break;
                
            case 'set_morning_time':
                flowResult = await handleSetMorningTime(client, message, phone);
                break;
                
            case 'complete_task':
                await handleCompleteTask(client, message, phone);
                break;
                
            case 'help':
                await sendHelpMessage(message);
                break;
                
            case 'menu':
                getUser(phone, (err, user) => {
                    sendMainMenu(message, user ? user.name : 'there');
                });
                break;
                
            case 'greeting':
                getUser(phone, (err, user) => {
                    sendMainMenu(message, user ? user.name : 'there');
                });
                break;
                
            case 'start':
                // Already started, just show menu
                getUser(phone, (err, user) => {
                    sendMainMenu(message, user ? user.name : 'there');
                });
                break;
                
            default:
                await message.reply(
                    '🤔 I didn\'t understand that.\n\n' +
                    'Type a *number (1-14)* from the menu or "help" for commands.\n' +
                    'Type "menu" to see the main menu.'
                );
        }
        
        // Handle multi-step flow responses
        if (flowResult && flowResult.action && flowResult.reply) {
            setConversationState(phone, flowResult.action);
            await message.reply(flowResult.reply);
        }
        
    } catch (error) {
        console.error(`Error handling intent "${intent}" from ${phone}:`, error);
        await message.reply('Sorry, I had trouble processing that. Please try again.');
    }
}

// =============================================================================
// MENU & HELP
// =============================================================================

async function sendMainMenu(message, userName) {
    await message.reply(
        `Hey ${userName}! 👋\n\n` +
        '🤖 *BUDDY - Main Menu*\n\n' +
        '📚 *Academics:*\n' +
        '  1️⃣ Set Timetable\n' +
        '  6️⃣ Bunk Class\n\n' +
        '📝 *Tasks & Notes:*\n' +
        '  3️⃣ Add Task\n' +
        '  7️⃣ View Tasks\n' +
        '  1️⃣5️⃣ View Attendance\n' +
        '  1️⃣6️⃣ Quick Notes\n\n' +
        '📅 *Planner:*\n' +
        '  4️⃣ Add Deadline\n' +
        '  9️⃣ View Deadlines\n' +
        '  1️⃣3️⃣ Plan Tomorrow\n\n' +
        '📂 *Resources:*\n' +
        '  5️⃣ Add Resource\n' +
        '  🔟 View Resources\n\n' +
        '⚙️ *Settings:*\n' +
        '  1️⃣1️⃣ Set Planning Time\n' +
        '  1️⃣2️⃣ Set Morning Time\n' +
        '  1️⃣4️⃣ Help\n\n' +
        '💡 Commands: "timetable mon", "class status", "my attendance", "weekly summary"\n' +
        '🛑 Type "stop" to pause the bot'
    );
}

async function sendHelpMessage(message) {
    await message.reply(
        '🤖 *BUDDY - All Commands*\n\n' +
        '*📚 Academics (1/6/15):\n*' +
        '• "set timetable" or JSON format\n' +
        '• "update mon dbms 325 to 420"\n' +
        '• "view timetable" / "timetable mon"\n' +
        '• "class status" - See current class\n' +
        '• "bunk math" / "skip physics"\n' +
        '• "my attendance" - See 75% track\n\n' +
        '*💰 Finance (2/8):\n*' +
        '• "expense 50 on lunch"\n' +
        '• "view expenses"\n' +
        '• "split 500 between 3 people"\n\n' +
        '*📝 Productivity (3/7/16):\n*' +
        '• "add task complete assignment"\n' +
        '• "my tasks" / "view tasks"\n' +
        '• "complete task 1"\n' +
        '• "note math: formula here"\n' +
        '• "view notes"\n\n' +
        '*⏰ Deadlines (4/9):\n*' +
        '• "deadline submit project by 25/12"\n' +
        '• "view deadlines"\n\n' +
        '*🔗 Resources (5/10):\n*' +
        '• "add math resource: https://..."\n' +
        '• "view resources"\n\n' +
        '*📊 Reports & Settings:\n*' +
        '• "weekly summary"\n' +
        '• "plan tomorrow"\n' +
        '• "set planning time 10:30 PM"\n' +
        '• "set morning time 8 AM"\n\n' +
        '*Other:*\n' +
        '• "menu" - Show main menu\n' +
        '• "stop" - Pause bot\n' +
        '• "cancel" - Exit current action'
    );
}

// =============================================================================
// ONBOARDING
// =============================================================================

async function handleOnboarding(message, phone) {
    const msgBody = message.body.trim();
    
    // User is providing their name (any text that's a reasonable name)
    let name = msgBody;
    
    // Clean up: extract name from common patterns
    const lowerMsg = msgBody.toLowerCase();
    if (lowerMsg.includes('my name is')) {
        name = msgBody.split(/my name is/i)[1].trim();
    } else if (lowerMsg.includes('i am')) {
        name = msgBody.split(/i am/i)[1].trim();
    } else if (lowerMsg.includes('call me')) {
        name = msgBody.split(/call me/i)[1].trim();
    }
    
    // Take first word as name, clean up
    name = name.split(/\s+/)[0];
    name = name.replace(/[^a-zA-Z]/g, ''); // Remove non-alpha chars
    
    if (name.length < 1 || name.length > 20) {
        await message.reply('Please tell me a valid name (just your first name).');
        return;
    }
    
    // Capitalize
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    
    createUser(phone, name, (err) => {
        if (err) {
            console.error('Error creating user:', err);
            message.reply('Sorry, I had trouble saving your info. Please try again.');
            return;
        }
        
        // Remove from onboarding state
        onboardingState.delete(phone);
        
        message.reply(
            `Nice to meet you, *${name}*! 🎉\n\n` +
            'I\'m BUDDY, your personal college assistant!\n\n' +
            '🔔 *Automatic features:*\n' +
            '• Morning brief at 7:00 AM\n' +
            '• Night planning prompt at 10:00 PM\n' +
            '• Class reminders 5 min before\n\n' +
            'You can change these times anytime!\n\n' +
            'Let me show you the main menu...'
        );
        
        // Send main menu after a brief delay
        setTimeout(() => {
            sendMainMenu(message, name);
        }, 1500);
    });
}

// =============================================================================
// PLAN TOMORROW
// =============================================================================

async function handlePlanTomorrow(message, phone) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await message.reply(
        '🌙 *Planning for tomorrow!*\n\n' +
        'What tasks do you want to get done tomorrow?\n\n' +
        'Reply with your tasks (one per line, or comma-separated):\n' +
        '• "skip" to cancel\n' +
        '• "view tomorrow" to see current plans'
    );
    
    // Mark that we're in planning mode for tomorrow
    nightPlanningState.set(phone, Date.now());
}

// =============================================================================
// CRON JOBS
// =============================================================================

// Class reminders & Live Tracker - every minute
cron.schedule('* * * * *', async () => {
    await sendClassReminders(client, null);
    await trackClassLive(client, null);
});

// Night planning system - every minute
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    getAllUsers((err, users) => {
        if (err) return;
        
        for (const user of users) {
            getUserSettings(user.phone, (err, settings) => {
                if (err) return;
                
                if (settings && settings.night_planning_time === currentTime) {
                    const lastPrompt = nightPlanningState.get(user.phone);
                    if (!lastPrompt || new Date(lastPrompt).toDateString() !== now.toDateString()) {
                        sendNightPlanningPrompt(client, user.phone);
                        nightPlanningState.set(user.phone, Date.now());
                    }
                }
            });
        }
    });
});

// Morning brief - every minute
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    getAllUsers((err, users) => {
        if (err) return;
        
        for (const user of users) {
            getUserSettings(user.phone, (err, settings) => {
                if (err) return;
                
                if (settings && settings.morning_brief_time === currentTime) {
                    getUser(user.phone, (err, userInfo) => {
                        if (!err && userInfo) {
                            sendMorningBrief(client, user.phone, userInfo.name);
                        }
                    });
                }
            });
        }
    });
});

// Weekly Summary - Sunday at 8 PM (20:00)
cron.schedule('0 20 * * 0', async () => {
    getAllUsers((err, users) => {
        if (err) return;
        users.forEach(user => sendWeeklySummaryToAll(client, user.phone));
    });
});

// =============================================================================
// STARTUP
// =============================================================================

async function startClient() {
    try {
        await client.initialize();
    } catch (error) {
        console.error('Failed to initialize WhatsApp client:', error);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Make sure you have a stable internet connection');
        console.log('2. Try restarting the application');
        console.log('3. Clear the sessions folder and try again');
        console.log('4. Make sure WhatsApp Web is not open in browser');
        
        // Retry after 5 seconds
        setTimeout(() => {
            console.log('\n🔄 Retrying initialization...');
            startClient();
        }, 5000);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down BUDDY...');
    client.destroy();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.log('🔄 Bot continues running...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('🔄 Bot continues running...');
});

// Start the client
startClient();
