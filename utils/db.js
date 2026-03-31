const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(dataDir, 'buddy.json');

// =============================================================================
// HELPERS
// =============================================================================
function normalizePhone(from) {
    return from.replace('@c.us', '').replace(/\D/g, '').slice(-10);
}

function getChatId(phone) {
    if (phone.includes('@c.us')) return phone;
    if (phone.length === 10) return `91${phone}@c.us`;
    return `${phone}@c.us`;
}

// =============================================================================
// FILE I/O
// =============================================================================
function readData() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
        const empty = { users: {}, timetable: {}, tasks: {}, settings: {}, expenses: {}, deadlines: {}, notes: {}, bunk: {} };
        fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
        return empty;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        const empty = { users: {}, timetable: {}, tasks: {}, settings: {}, expenses: {}, deadlines: {}, notes: {}, bunk: {} };
        fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
        return empty;
    }
}

function writeData(data) {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// =============================================================================
// INIT (no-op for JSON, just ensure file exists)
// =============================================================================
function initDB() {
    readData(); // creates file if missing
    console.log('✅ JSON database initialized at', DB_PATH);
}

// =============================================================================
// USERS
// =============================================================================
function createUser(phone, name, callback) {
    try {
        const data = readData();
        if (!data.users[phone]) {
            data.users[phone] = { name, onboarded: 0, created_at: new Date().toISOString() };
            writeData(data);
        }
        callback(null);
    } catch (err) { callback(err); }
}

function getUser(phone, callback) {
    try {
        const data = readData();
        callback(null, data.users[phone] || null);
    } catch (err) { callback(err); }
}

function isOnboarded(phone, callback) {
    getUser(phone, (err, user) => callback(err, user && user.onboarded === 1));
}

function completeOnboarding(phone, name, callback) {
    try {
        const data = readData();
        data.users[phone] = { ...(data.users[phone] || {}), name, onboarded: 1 };
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function updateUserName(phone, name, callback) {
    try {
        const data = readData();
        if (data.users[phone]) data.users[phone].name = name;
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

// =============================================================================
// TIMETABLE
// =============================================================================
function saveTimetable(phone, day, subject, startTime, endTime, venue, callback) {
    if (typeof venue === 'function') { callback = venue; venue = ''; }
    try {
        const data = readData();
        if (!data.timetable[phone]) data.timetable[phone] = [];

        // Remove existing entry for same day+subject
        data.timetable[phone] = data.timetable[phone].filter(c =>
            !(c.day.toUpperCase() === day.toUpperCase() && c.subject.toLowerCase() === subject.toLowerCase())
        );

        data.timetable[phone].push({ day: day.toUpperCase(), subject, start_time: startTime, end_time: endTime, venue: venue || '' });
        // Sort by day then start_time
        const dayOrder = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
        data.timetable[phone].sort((a, b) => {
            const di = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
            return di !== 0 ? di : a.start_time.localeCompare(b.start_time);
        });
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getTimetable(phone, day, callback) {
    try {
        const data = readData();
        let entries = data.timetable[phone] || [];
        if (day) {
            entries = entries.filter(c => c.day.toUpperCase() === day.toUpperCase());
            entries.sort((a, b) => a.start_time.localeCompare(b.start_time));
        }
        callback(null, entries);
    } catch (err) { callback(err); }
}

function clearTimetable(phone, day, callback) {
    try {
        const data = readData();
        if (!data.timetable[phone]) { data.timetable[phone] = []; }
        if (day) {
            data.timetable[phone] = data.timetable[phone].filter(c => c.day.toUpperCase() !== day.toUpperCase());
        } else {
            data.timetable[phone] = [];
        }
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

// =============================================================================
// TASKS
// =============================================================================
function addTask(phone, task, date, callback) {
    try {
        const data = readData();
        if (!data.tasks[phone]) data.tasks[phone] = [];
        const id = Date.now();
        data.tasks[phone].push({ id, task, task_date: date, completed: 0 });
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getTasks(phone, date, callback) {
    try {
        const data = readData();
        let tasks = (data.tasks[phone] || []).filter(t => t.completed === 0);
        if (date) tasks = tasks.filter(t => t.task_date === date);
        callback(null, tasks);
    } catch (err) { callback(err); }
}

function completeTask(phone, taskId, callback) {
    try {
        const data = readData();
        const tasks = data.tasks[phone] || [];
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = 1;
            writeData(data);
            callback(null, task);
        } else {
            callback(null, null);
        }
    } catch (err) { callback(err); }
}

function deleteTask(phone, taskId, callback) {
    try {
        const data = readData();
        const tasks = data.tasks[phone] || [];
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            data.tasks[phone] = tasks.filter(t => t.id !== taskId);
            writeData(data);
            callback(null, task);
        } else {
            callback(null, null);
        }
    } catch (err) { callback(err); }
}

// =============================================================================
// USER SETTINGS
// =============================================================================
function setUserSetting(phone, setting, value, callback) {
    try {
        const data = readData();
        if (!data.settings[phone]) data.settings[phone] = { night_planning_time: '22:00', morning_brief_time: '07:00' };
        data.settings[phone][setting] = value;
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getUserSettings(phone, callback) {
    try {
        const data = readData();
        const defaults = { phone, night_planning_time: '22:00', morning_brief_time: '07:00' };
        callback(null, { ...defaults, ...(data.settings[phone] || {}) });
    } catch (err) { callback(err); }
}

function setNightPlanningTime(phone, time, callback) {
    setUserSetting(phone, 'night_planning_time', time, callback);
}

function setMorningBriefTime(phone, time, callback) {
    setUserSetting(phone, 'morning_brief_time', time, callback);
}

// =============================================================================
// EXPENSES
// =============================================================================
function addExpense(phone, amount, category, description, date, callback) {
    try {
        const data = readData();
        if (!data.expenses[phone]) data.expenses[phone] = [];
        data.expenses[phone].push({ id: Date.now(), amount, category, description, date });
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getExpenses(phone, startDate, endDate, callback) {
    try {
        const data = readData();
        let expenses = data.expenses[phone] || [];
        if (startDate) expenses = expenses.filter(e => e.date >= startDate);
        if (endDate) expenses = expenses.filter(e => e.date <= endDate);
        expenses.sort((a, b) => b.date.localeCompare(a.date));
        callback(null, expenses);
    } catch (err) { callback(err); }
}

function deleteExpense(phone, expenseId, callback) {
    try {
        const data = readData();
        data.expenses[phone] = (data.expenses[phone] || []).filter(e => e.id !== expenseId);
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

// =============================================================================
// DEADLINES
// =============================================================================
function addDeadline(phone, task, deadlineDate, callback) {
    try {
        const data = readData();
        if (!data.deadlines[phone]) data.deadlines[phone] = [];
        data.deadlines[phone].push({ id: Date.now(), task, deadline_date: deadlineDate, created_at: new Date().toISOString() });
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getDeadlines(phone, callback) {
    try {
        const data = readData();
        const deadlines = (data.deadlines[phone] || []).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
        callback(null, deadlines);
    } catch (err) { callback(err); }
}

function deleteDeadline(phone, deadlineId, callback) {
    try {
        const data = readData();
        data.deadlines[phone] = (data.deadlines[phone] || []).filter(d => d.id !== deadlineId);
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

// =============================================================================
// NOTES
// =============================================================================
function addNote(phone, subject, content, callback) {
    try {
        const data = readData();
        if (!data.notes[phone]) data.notes[phone] = [];
        data.notes[phone].push({ id: Date.now(), subject, content, created_at: new Date().toISOString() });
        writeData(data);
        callback(null);
    } catch (err) { callback(err); }
}

function getNotes(phone, subject, callback) {
    try {
        const data = readData();
        let notes = data.notes[phone] || [];
        if (subject) notes = notes.filter(n => n.subject.toLowerCase() === subject.toLowerCase());
        callback(null, notes);
    } catch (err) { callback(err); }
}

// =============================================================================
// BUNK RECORDS
// =============================================================================
function addBunkRecord(phone, subject, date, callback) {
    try {
        const data = readData();
        if (!data.bunk[phone]) data.bunk[phone] = [];
        const exists = data.bunk[phone].find(b => b.subject.toLowerCase() === subject.toLowerCase() && b.date === date);
        if (!exists) {
            data.bunk[phone].push({ subject, date });
            writeData(data);
        }
        callback(null);
    } catch (err) { callback(err); }
}

function getBunkRecords(phone, subject, callback) {
    try {
        const data = readData();
        let records = data.bunk[phone] || [];
        if (subject) records = records.filter(b => b.subject.toLowerCase() === subject.toLowerCase());
        callback(null, records);
    } catch (err) { callback(err); }
}

// =============================================================================
// ALL USERS — for cron jobs (no memory gate, reads from disk)
// =============================================================================
function getAllUsers(callback) {
    try {
        const data = readData();
        const phoneSet = new Set();

        // Onboarded users
        Object.keys(data.users || {}).forEach(phone => {
            if (data.users[phone].onboarded === 1) phoneSet.add(phone);
        });

        // Anyone with timetable data (catches fresh installs & partial onboarding)
        Object.keys(data.timetable || {}).forEach(phone => {
            if ((data.timetable[phone] || []).length > 0) phoneSet.add(phone);
        });

        callback(null, Array.from(phoneSet).map(phone => ({ phone })));
    } catch (err) { callback(err); }
}

module.exports = {
    initDB,
    normalizePhone,
    getChatId,
    createUser,
    getUser,
    isOnboarded,
    completeOnboarding,
    updateUserName,
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
    addNote,
    getNotes,
    addBunkRecord,
    getBunkRecords,
    getAllUsers
};
