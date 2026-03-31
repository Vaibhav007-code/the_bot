const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'buddy.json');

// Initialize database
function initDB() {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            users: {},
            timetable: {},
            daily_tasks: {},
            user_settings: {},
            expenses: {},
            deadlines: {},
            resources: {},
            bunk_history: {}
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
        console.log('Database initialized successfully');
    } else {
        // Ensure all keys exist (migration for existing databases)
        const data = readData();
        let needsWrite = false;
        const requiredKeys = ['users', 'timetable', 'daily_tasks', 'user_settings', 'expenses', 'deadlines', 'resources', 'bunk_history'];
        for (const key of requiredKeys) {
            if (!data[key]) {
                data[key] = {};
                needsWrite = true;
            }
        }
        if (needsWrite) {
            writeData(data);
        }
    }
}

// Helper function to read data
function readData() {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (error) {
        console.error('Error reading database:', error);
        return {
            users: {},
            timetable: {},
            daily_tasks: {},
            user_settings: {},
            expenses: {},
            deadlines: {},
            resources: {},
            bunk_history: {}
        };
    }
}

// Helper function to write data
function writeData(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing database:', error);
    }
}

// Normalize phone ID - handles both @c.us and @lid formats
function normalizePhone(rawFrom) {
    if (!rawFrom) return rawFrom;
    return rawFrom.replace(/@c\.us$/, '').replace(/@lid$/, '');
}

// Get the correct chat ID for sending messages
function getChatId(phone) {
    // Check if phone already has a suffix
    if (phone.includes('@')) return phone;
    return `${phone}@c.us`;
}

// User functions
function createUser(phone, name, callback) {
    const data = readData();
    data.users[phone] = {
        name: name,
        onboarded: 1
    };
    
    // Set default user settings
    if (!data.user_settings[phone]) {
        data.user_settings[phone] = {
            night_planning_time: '22:00',
            morning_brief_time: '07:00'
        };
    }
    
    writeData(data);
    callback(null);
}

function getUser(phone, callback) {
    const data = readData();
    callback(null, data.users[phone] || null);
}

function isOnboarded(phone, callback) {
    getUser(phone, (err, user) => {
        callback(err, user && user.onboarded === 1);
    });
}

// Timetable functions
function saveTimetable(phone, day, subject, startTime, endTime, venue = '', callback) {
    // Check if venue is callback (backwards compatibility)
    if (typeof venue === 'function') {
        callback = venue;
        venue = '';
    }
    
    const data = readData();
    if (!data.timetable[phone]) {
        data.timetable[phone] = [];
    }
    
    // Remove existing entry for this day and subject
    data.timetable[phone] = data.timetable[phone].filter(entry => 
        !(entry.day === day && entry.subject === subject)
    );
    
    // Add new entry
    data.timetable[phone].push({
        day,
        subject,
        start_time: startTime,
        end_time: endTime,
        venue
    });
    
    writeData(data);
    callback(null);
}

function getTimetable(phone, day, callback) {
    const data = readData();
    let timetable = data.timetable[phone] || [];
    
    if (day) {
        // Case-insensitive day matching
        const dayUpper = day.toUpperCase();
        timetable = timetable.filter(entry => entry.day.toUpperCase() === dayUpper);
    }
    
    // Sort by start time
    timetable.sort((a, b) => a.start_time.localeCompare(b.start_time));
    callback(null, timetable);
}

function clearTimetable(phone, day, callback) {
    const data = readData();
    if (data.timetable[phone]) {
        if (day) {
            const dayUpper = day.toUpperCase();
            data.timetable[phone] = data.timetable[phone].filter(entry => entry.day.toUpperCase() !== dayUpper);
        } else {
            data.timetable[phone] = [];
        }
        writeData(data);
    }
    callback(null);
}

// Daily tasks functions
function addTask(phone, task, date, callback) {
    const data = readData();
    if (!data.daily_tasks[phone]) {
        data.daily_tasks[phone] = [];
    }
    
    data.daily_tasks[phone].push({
        id: Date.now(),
        task,
        task_date: date,
        completed: 0
    });
    
    writeData(data);
    callback(null);
}

function getTasks(phone, date, callback) {
    const data = readData();
    let tasks = data.daily_tasks[phone] || [];
    
    if (date) {
        tasks = tasks.filter(task => task.task_date === date && task.completed === 0);
    } else {
        tasks = tasks.filter(task => task.completed === 0);
    }
    
    // Sort by date and id
    tasks.sort((a, b) => {
        if (a.task_date !== b.task_date) {
            return a.task_date.localeCompare(b.task_date);
        }
        return a.id - b.id;
    });
    
    callback(null, tasks);
}

function completeTask(phone, taskId, callback) {
    const data = readData();
    if (data.daily_tasks[phone]) {
        const task = data.daily_tasks[phone].find(t => t.id === taskId);
        if (task) {
            task.completed = 1;
            writeData(data);
            callback(null, task);
            return;
        }
    }
    callback(null, null);
}

function deleteTask(phone, taskId, callback) {
    const data = readData();
    if (data.daily_tasks[phone]) {
        const index = data.daily_tasks[phone].findIndex(t => t.id === taskId);
        if (index !== -1) {
            const removed = data.daily_tasks[phone].splice(index, 1);
            writeData(data);
            callback(null, removed[0]);
            return;
        }
    }
    callback(null, null);
}

// User settings functions
function setUserSetting(phone, setting, value, callback) {
    const data = readData();
    if (!data.user_settings[phone]) {
        data.user_settings[phone] = {
            night_planning_time: '22:00',
            morning_brief_time: '07:00'
        };
    }
    
    data.user_settings[phone][setting] = value;
    writeData(data);
    callback(null);
}

function getUserSettings(phone, callback) {
    const data = readData();
    const settings = data.user_settings[phone] || {
        night_planning_time: '22:00',
        morning_brief_time: '07:00'
    };
    callback(null, settings);
}

function setNightPlanningTime(phone, time, callback) {
    setUserSetting(phone, 'night_planning_time', time, callback);
}

function setMorningBriefTime(phone, time, callback) {
    setUserSetting(phone, 'morning_brief_time', time, callback);
}

// Expenses functions
function addExpense(phone, amount, category, description, callback) {
    const data = readData();
    if (!data.expenses[phone]) {
        data.expenses[phone] = [];
    }
    
    const date = new Date().toISOString().split('T')[0];
    
    data.expenses[phone].push({
        id: Date.now(),
        amount,
        category,
        description,
        date
    });
    
    writeData(data);
    callback(null);
}

function getExpenses(phone, month, callback) {
    const data = readData();
    let expenses = data.expenses[phone] || [];
    
    if (month) {
        expenses = expenses.filter(expense => expense.date.startsWith(month));
    }
    
    // Sort by date descending
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    callback(null, expenses);
}

function deleteExpense(phone, expenseId, callback) {
    const data = readData();
    if (data.expenses[phone]) {
        const index = data.expenses[phone].findIndex(e => e.id === expenseId);
        if (index !== -1) {
            const removed = data.expenses[phone].splice(index, 1);
            writeData(data);
            callback(null, removed[0]);
            return;
        }
    }
    callback(null, null);
}

// Deadlines functions
function addDeadline(phone, task, deadlineDate, callback) {
    const data = readData();
    if (!data.deadlines[phone]) {
        data.deadlines[phone] = [];
    }
    
    data.deadlines[phone].push({
        id: Date.now(),
        task,
        deadline_date: deadlineDate
    });
    
    writeData(data);
    callback(null);
}

function getDeadlines(phone, callback) {
    const data = readData();
    let deadlines = data.deadlines[phone] || [];
    
    // Sort by deadline date ascending
    deadlines.sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date));
    callback(null, deadlines);
}

function deleteDeadline(phone, deadlineId, callback) {
    const data = readData();
    if (data.deadlines[phone]) {
        const index = data.deadlines[phone].findIndex(d => d.id === deadlineId);
        if (index !== -1) {
            const removed = data.deadlines[phone].splice(index, 1);
            writeData(data);
            callback(null, removed[0]);
            return;
        }
    }
    callback(null, null);
}

// Resources functions
function addResource(phone, subject, link, description, callback) {
    const data = readData();
    if (!data.resources[phone]) {
        data.resources[phone] = [];
    }
    
    data.resources[phone].push({
        id: Date.now(),
        subject,
        link,
        description
    });
    
    writeData(data);
    callback(null);
}

function getResources(phone, subject, callback) {
    const data = readData();
    let resources = data.resources[phone] || [];
    
    if (subject) {
        resources = resources.filter(resource => 
            resource.subject.toLowerCase() === subject.toLowerCase()
        );
    }
    
    // Sort by subject
    resources.sort((a, b) => a.subject.localeCompare(b.subject));
    callback(null, resources);
}

// Bunk history
function addBunkRecord(phone, subject, date, callback) {
    const data = readData();
    if (!data.bunk_history) data.bunk_history = {};
    if (!data.bunk_history[phone]) {
        data.bunk_history[phone] = [];
    }
    
    data.bunk_history[phone].push({
        subject,
        date,
        timestamp: Date.now()
    });
    
    writeData(data);
    callback(null);
}

function getBunkCount(phone, subject, callback) {
    const data = readData();
    if (!data.bunk_history) data.bunk_history = {};
    const history = data.bunk_history[phone] || [];
    const count = history.filter(b => b.subject.toLowerCase() === subject.toLowerCase()).length;
    callback(null, count);
}

// Get all users for cron jobs
function getAllUsers(callback) {
    const data = readData();
    const users = Object.keys(data.users)
        .filter(phone => data.users[phone].onboarded === 1)
        .map(phone => ({ phone }));
    callback(null, users);
}

module.exports = {
    initDB,
    normalizePhone,
    getChatId,
    createUser,
    getUser,
    isOnboarded,
    saveTimetable,
    getTimetable,
    clearTimetable,
    addTask,
    getTasks,
    completeTask,
    deleteTask,
    setUserSetting,
    getUserSettings,
    setNightPlanningTime,
    setMorningBriefTime,
    addExpense,
    getExpenses,
    deleteExpense,
    addDeadline,
    getDeadlines,
    deleteDeadline,
    addResource,
    getResources,
    addBunkRecord,
    getBunkCount,
    getAllUsers
};
