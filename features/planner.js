const { addTask, getTasks, completeTask, getUserSettings, setNightPlanningTime, setMorningBriefTime, getChatId } = require('../utils/db');
const { extractTaskInfo, extractTimeSetting } = require('../utils/intent');

// Handle add task intent - supports multi-step flow
async function handleAddTask(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If user just sent "3" from menu
    if (msg === '3') {
        return {
            action: 'await_task_data',
            reply: '📝 What task do you want to add?\n\n' +
                   '*Examples:*\n' +
                   '• "complete assignment"\n' +
                   '• "study for exam tomorrow"\n' +
                   '• "buy groceries"\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    const { task, date } = extractTaskInfo(message.body);
    
    if (!task || task.length < 2) {
        await message.reply('❌ Please tell me the task details.\n\nExample: "add task complete assignment"');
        return null;
    }
    
    addTask(phone, task, date, (err) => {
        if (err) {
            console.error('Error adding task:', err);
            message.reply('Sorry, I had trouble adding that task. Please try again.');
            return;
        }
        message.reply(
            `✅ *Task Added*\n\n` +
            `📝 ${task}\n` +
            `📅 Date: ${date}\n\n` +
            `View tasks with option 7 or "my tasks"`
        );
    });
    
    return null;
}

// Handle view tasks intent
async function handleViewTasks(client, message, phone) {
    const msg = message.body.toLowerCase();
    
    let date = new Date().toISOString().split('T')[0]; // default: today
    let label = 'today';
    
    if (msg.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
        label = 'tomorrow';
    } else if (msg.includes('all')) {
        date = null; // show all
        label = 'all pending';
    }
    
    getTasks(phone, date, (err, tasks) => {
        if (err) {
            console.error('Error getting tasks:', err);
            message.reply('Sorry, I had trouble retrieving your tasks. Please try again.');
            return;
        }
        
        if (tasks.length === 0) {
            message.reply(
                `📝 No tasks for ${label}!\n\n` +
                'Add one with: "add task [your task]"'
            );
            return;
        }
        
        let taskList = `📝 *Your tasks (${label}):*\n\n`;
        tasks.forEach((task, index) => {
            taskList += `${index + 1}. ${task.task}`;
            if (!date) taskList += ` [${task.task_date}]`;
            taskList += '\n';
        });
        
        taskList += `\n✅ Complete a task: "complete task [number]"`;
        
        message.reply(taskList);
    });
}

// Handle complete task
async function handleCompleteTask(client, message, phone) {
    const msg = message.body.toLowerCase();
    const numMatch = msg.match(/(\d+)/);
    
    if (!numMatch) {
        await message.reply('Which task do you want to complete? Send the task number.\n\nView tasks first with option 7.');
        return;
    }
    
    const taskNum = parseInt(numMatch[1]);
    const today = new Date().toISOString().split('T')[0];
    
    getTasks(phone, today, (err, tasks) => {
        if (err) {
            console.error('Error getting tasks:', err);
            message.reply('Sorry, I had trouble retrieving your tasks.');
            return;
        }
        
        if (taskNum < 1 || taskNum > tasks.length) {
            message.reply(`❌ Invalid task number. You have ${tasks.length} tasks.`);
            return;
        }
        
        const taskToComplete = tasks[taskNum - 1];
        completeTask(phone, taskToComplete.id, (err, completed) => {
            if (err) {
                console.error('Error completing task:', err);
                message.reply('Sorry, I had trouble completing that task.');
                return;
            }
            
            if (completed) {
                message.reply(`✅ Task completed: "${completed.task}"\n\nGreat job! 🎉`);
            } else {
                message.reply('❌ Could not find that task.');
            }
        });
    });
}

// Handle set planning time intent
async function handleSetPlanningTime(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If just menu option
    if (msg === '11') {
        return {
            action: 'await_planning_time',
            reply: '⏰ What time should I send the night planning prompt?\n\n' +
                   '*Examples:*\n' +
                   '• "10:30 PM"\n' +
                   '• "9 PM"\n' +
                   '• "22:00"\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    const time = extractTimeSetting(message.body);
    
    if (!time) {
        await message.reply('Please provide a valid time.\n\nExample: "set planning time 10:30 PM"');
        return null;
    }
    
    setNightPlanningTime(phone, time, (err) => {
        if (err) {
            console.error('Error setting planning time:', err);
            message.reply('Sorry, I had trouble updating your planning time. Please try again.');
            return;
        }
        message.reply(`✅ Night planning time updated to *${time}*\n\nI'll remind you to plan your next day at this time!`);
    });
    
    return null;
}

// Handle set morning time intent
async function handleSetMorningTime(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If just menu option
    if (msg === '12') {
        return {
            action: 'await_morning_time',
            reply: '☀️ What time should I send the morning brief?\n\n' +
                   '*Examples:*\n' +
                   '• "8 AM"\n' +
                   '• "7:30 AM"\n' +
                   '• "06:30"\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    const time = extractTimeSetting(message.body);
    
    if (!time) {
        await message.reply('Please provide a valid time.\n\nExample: "set morning time 8 AM"');
        return null;
    }
    
    setMorningBriefTime(phone, time, (err) => {
        if (err) {
            console.error('Error setting morning time:', err);
            message.reply('Sorry, I had trouble updating your morning time. Please try again.');
            return;
        }
        message.reply(`✅ Morning brief time updated to *${time}*\n\nI'll send your daily overview at this time!`);
    });
    
    return null;
}

// Send night planning prompt
async function sendNightPlanningPrompt(client, phone) {
    try {
        const chatId = getChatId(phone);
        await client.sendMessage(chatId,
            '🌙 *Time to plan your next day!*\n\n' +
            'What do you want to get done tomorrow?\n\n' +
            'Reply with your tasks (one per line) or:\n' +
            '• "skip" to skip\n' +
            '• "view tomorrow" to see current plans'
        );
    } catch (error) {
        console.error(`Error sending night planning prompt to ${phone}:`, error);
    }
}

// Send morning brief
async function sendMorningBrief(client, phone, userName) {
    try {
        const today = new Date();
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[today.getDay()];
        const dayName = dayNames[today.getDay()];
        const todayStr = today.toISOString().split('T')[0];
        
        // Get today's classes
        const { getTimetable, getDeadlines } = require('../utils/db');
        
        getTimetable(phone, currentDay, (err, classes) => {
            if (err) {
                console.error('Error getting timetable:', err);
                return;
            }
            
            // Get today's tasks
            getTasks(phone, todayStr, (err, tasks) => {
                if (err) {
                    console.error('Error getting tasks:', err);
                    return;
                }
                
                // Get upcoming deadlines
                getDeadlines(phone, (err, deadlines) => {
                    if (err) {
                        console.error('Error getting deadlines:', err);
                        return;
                    }
                    
                    const upcomingDeadlines = deadlines.filter(d => new Date(d.deadline_date) >= today);
                    
                    let brief = `☀️ Good morning ${userName}! 👋\n`;
                    brief += `📅 *${dayName}, ${todayStr}*\n\n`;
                    
                    // Add classes
                    brief += '📚 *Today\'s Classes:*\n';
                    if (classes.length > 0) {
                        classes.forEach(cls => {
                            brief += `  • ${cls.subject} (${cls.start_time}-${cls.end_time})\n`;
                        });
                    } else {
                        brief += '  No classes today 🎉\n';
                    }
                    brief += '\n';
                    
                    // Add tasks
                    brief += '📝 *Today\'s Tasks:*\n';
                    if (tasks.length > 0) {
                        tasks.forEach((task, i) => {
                            brief += `  ${i + 1}. ${task.task}\n`;
                        });
                    } else {
                        brief += '  No tasks for today\n';
                    }
                    brief += '\n';
                    
                    // Add deadlines
                    if (upcomingDeadlines.length > 0) {
                        brief += '⚠️ *Upcoming Deadlines:*\n';
                        upcomingDeadlines.slice(0, 3).forEach(deadline => {
                            const daysLeft = Math.ceil((new Date(deadline.deadline_date) - today) / (1000 * 60 * 60 * 24));
                            const urgency = daysLeft <= 1 ? '🔴' : daysLeft <= 3 ? '🟡' : '🟢';
                            brief += `  ${urgency} ${deadline.task} (${daysLeft}d)\n`;
                        });
                        brief += '\n';
                    }
                    
                    brief += 'Have a productive day! 🚀';
                    
                    const chatId = getChatId(phone);
                    client.sendMessage(chatId, brief).catch(err => {
                        console.error(`Error sending morning brief to ${phone}:`, err);
                    });
                });
            });
        });
    } catch (error) {
        console.error(`Error in sendMorningBrief for ${phone}:`, error);
    }
}

// Handle night planning response
async function handleNightPlanningResponse(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    if (msg === 'skip') {
        await message.reply('😴 No problem! Have a good night!');
        return;
    }
    
    if (msg === 'view tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        getTasks(phone, tomorrowStr, (err, tasks) => {
            if (err) {
                console.error('Error getting tomorrow tasks:', err);
                message.reply('Sorry, I had trouble retrieving tomorrow\'s tasks.');
                return;
            }
            
            if (tasks.length === 0) {
                message.reply('📝 No tasks planned for tomorrow yet.\n\nReply with your tasks to plan!');
            } else {
                let taskList = '📝 *Tasks for tomorrow:*\n\n';
                tasks.forEach((task, index) => {
                    taskList += `${index + 1}. ${task.task}\n`;
                });
                message.reply(taskList);
            }
        });
        return;
    }
    
    // Treat as adding tasks for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Split multiple tasks by newlines or commas
    const taskLines = msg.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
    
    if (taskLines.length === 0) {
        await message.reply('Please enter at least one task, or type "skip".');
        return;
    }
    
    let completed = 0;
    let failed = 0;
    
    taskLines.forEach((taskLine) => {
        addTask(phone, taskLine, tomorrowStr, (err) => {
            if (err) {
                failed++;
            } else {
                completed++;
            }
            
            // Reply when ALL callbacks have finished
            if (completed + failed === taskLines.length) {
                if (completed > 0) {
                    let response = `✅ *Tomorrow's plan set!* (${completed} task${completed > 1 ? 's' : ''})\n\n`;
                    taskLines.forEach((t, i) => {
                        response += `${i + 1}. ${t}\n`;
                    });
                    response += '\n😴 Good night! I\'ll send you a brief in the morning.';
                    message.reply(response);
                } else {
                    message.reply('Sorry, I had trouble adding those tasks. Please try again.');
                }
            }
        });
    });
}

module.exports = {
    handleAddTask,
    handleViewTasks,
    handleCompleteTask,
    handleSetPlanningTime,
    handleSetMorningTime,
    sendNightPlanningPrompt,
    sendMorningBrief,
    handleNightPlanningResponse
};
