const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'buddy.db');
let db;

// =============================================================================
// INIT
// =============================================================================
function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            phone TEXT PRIMARY KEY,
            name TEXT,
            onboarded INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS timetable (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            day TEXT NOT NULL,
            subject TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            venue TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS daily_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            task TEXT NOT NULL,
            task_date TEXT NOT NULL,
            completed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            phone TEXT PRIMARY KEY,
            night_planning_time TEXT DEFAULT '22:00',
            morning_brief_time TEXT DEFAULT '07:00'
        );

        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT DEFAULT 'General',
            description TEXT,
            date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS deadlines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            task TEXT NOT NULL,
            deadline_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            subject TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bunk_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            subject TEXT NOT NULL,
            date TEXT NOT NULL
        );
    `);

    console.log('✅ SQLite database initialized at', DB_PATH);
}

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
// USERS
// =============================================================================
function createUser(phone, name, callback) {
    try {
        const stmt = db.prepare(`INSERT OR IGNORE INTO users (phone, name, onboarded) VALUES (?, ?, 0)`);
        stmt.run(phone, name);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getUser(phone, callback) {
    try {
        const row = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
        callback(null, row || null);
    } catch (err) {
        callback(err);
    }
}

function isOnboarded(phone, callback) {
    getUser(phone, (err, user) => {
        callback(err, user && user.onboarded === 1);
    });
}

function completeOnboarding(phone, name, callback) {
    try {
        db.prepare(`INSERT OR REPLACE INTO users (phone, name, onboarded) VALUES (?, ?, 1)`).run(phone, name);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function updateUserName(phone, name, callback) {
    try {
        db.prepare(`UPDATE users SET name = ? WHERE phone = ?`).run(name, phone);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// TIMETABLE
// =============================================================================
function saveTimetable(phone, day, subject, startTime, endTime, venue = '', callback) {
    if (typeof venue === 'function') { callback = venue; venue = ''; }
    try {
        // Remove existing entry for same day+subject
        db.prepare(`DELETE FROM timetable WHERE phone = ? AND day = ? AND LOWER(subject) = LOWER(?)`).run(phone, day, subject);
        db.prepare(`INSERT INTO timetable (phone, day, subject, start_time, end_time, venue) VALUES (?, ?, ?, ?, ?, ?)`).run(phone, day, subject, startTime, endTime, venue || '');
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getTimetable(phone, day, callback) {
    try {
        let rows;
        if (day) {
            rows = db.prepare(`SELECT * FROM timetable WHERE phone = ? AND UPPER(day) = UPPER(?) ORDER BY start_time ASC`).all(phone, day);
        } else {
            rows = db.prepare(`SELECT * FROM timetable WHERE phone = ? ORDER BY day ASC, start_time ASC`).all(phone);
        }
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

function clearTimetable(phone, day, callback) {
    try {
        if (day) {
            db.prepare(`DELETE FROM timetable WHERE phone = ? AND UPPER(day) = UPPER(?)`).run(phone, day);
        } else {
            db.prepare(`DELETE FROM timetable WHERE phone = ?`).run(phone);
        }
        callback(null);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// DAILY TASKS
// =============================================================================
function addTask(phone, task, date, callback) {
    try {
        db.prepare(`INSERT INTO daily_tasks (phone, task, task_date, completed) VALUES (?, ?, ?, 0)`).run(phone, task, date);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getTasks(phone, date, callback) {
    try {
        let rows;
        if (date) {
            rows = db.prepare(`SELECT * FROM daily_tasks WHERE phone = ? AND task_date = ? AND completed = 0 ORDER BY id ASC`).all(phone, date);
        } else {
            rows = db.prepare(`SELECT * FROM daily_tasks WHERE phone = ? AND completed = 0 ORDER BY task_date ASC, id ASC`).all(phone);
        }
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

function completeTask(phone, taskId, callback) {
    try {
        const task = db.prepare(`SELECT * FROM daily_tasks WHERE id = ? AND phone = ?`).get(taskId, phone);
        if (task) {
            db.prepare(`UPDATE daily_tasks SET completed = 1 WHERE id = ?`).run(taskId);
            callback(null, task);
        } else {
            callback(null, null);
        }
    } catch (err) {
        callback(err);
    }
}

function deleteTask(phone, taskId, callback) {
    try {
        const task = db.prepare(`SELECT * FROM daily_tasks WHERE id = ? AND phone = ?`).get(taskId, phone);
        if (task) {
            db.prepare(`DELETE FROM daily_tasks WHERE id = ?`).run(taskId);
            callback(null, task);
        } else {
            callback(null, null);
        }
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// USER SETTINGS
// =============================================================================
function setUserSetting(phone, setting, value, callback) {
    try {
        db.prepare(`INSERT OR IGNORE INTO user_settings (phone) VALUES (?)`).run(phone);
        db.prepare(`UPDATE user_settings SET ${setting} = ? WHERE phone = ?`).run(value, phone);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getUserSettings(phone, callback) {
    try {
        let row = db.prepare(`SELECT * FROM user_settings WHERE phone = ?`).get(phone);
        if (!row) {
            db.prepare(`INSERT OR IGNORE INTO user_settings (phone) VALUES (?)`).run(phone);
            row = { phone, night_planning_time: '22:00', morning_brief_time: '07:00' };
        }
        callback(null, row);
    } catch (err) {
        callback(err);
    }
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
        db.prepare(`INSERT INTO expenses (phone, amount, category, description, date) VALUES (?, ?, ?, ?, ?)`).run(phone, amount, category, description, date);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getExpenses(phone, startDate, endDate, callback) {
    try {
        let rows;
        if (startDate && endDate) {
            rows = db.prepare(`SELECT * FROM expenses WHERE phone = ? AND date BETWEEN ? AND ? ORDER BY date DESC`).all(phone, startDate, endDate);
        } else if (startDate) {
            rows = db.prepare(`SELECT * FROM expenses WHERE phone = ? AND date >= ? ORDER BY date DESC`).all(phone, startDate);
        } else {
            rows = db.prepare(`SELECT * FROM expenses WHERE phone = ? ORDER BY date DESC`).all(phone);
        }
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

function deleteExpense(phone, expenseId, callback) {
    try {
        db.prepare(`DELETE FROM expenses WHERE id = ? AND phone = ?`).run(expenseId, phone);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// DEADLINES
// =============================================================================
function addDeadline(phone, task, deadlineDate, callback) {
    try {
        db.prepare(`INSERT INTO deadlines (phone, task, deadline_date) VALUES (?, ?, ?)`).run(phone, task, deadlineDate);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getDeadlines(phone, callback) {
    try {
        const rows = db.prepare(`SELECT * FROM deadlines WHERE phone = ? ORDER BY deadline_date ASC`).all(phone);
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

function deleteDeadline(phone, deadlineId, callback) {
    try {
        db.prepare(`DELETE FROM deadlines WHERE id = ? AND phone = ?`).run(deadlineId, phone);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// NOTES
// =============================================================================
function addNote(phone, subject, content, callback) {
    try {
        db.prepare(`INSERT INTO notes (phone, subject, content) VALUES (?, ?, ?)`).run(phone, subject, content);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getNotes(phone, subject, callback) {
    try {
        let rows;
        if (subject) {
            rows = db.prepare(`SELECT * FROM notes WHERE phone = ? AND LOWER(subject) = LOWER(?) ORDER BY created_at DESC`).all(phone, subject);
        } else {
            rows = db.prepare(`SELECT * FROM notes WHERE phone = ? ORDER BY subject ASC, created_at DESC`).all(phone);
        }
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// BUNK RECORDS
// =============================================================================
function addBunkRecord(phone, subject, date, callback) {
    try {
        const existing = db.prepare(`SELECT id FROM bunk_records WHERE phone = ? AND LOWER(subject) = LOWER(?) AND date = ?`).get(phone, subject, date);
        if (!existing) {
            db.prepare(`INSERT INTO bunk_records (phone, subject, date) VALUES (?, ?, ?)`).run(phone, subject, date);
        }
        callback(null);
    } catch (err) {
        callback(err);
    }
}

function getBunkRecords(phone, subject, callback) {
    try {
        let rows;
        if (subject) {
            rows = db.prepare(`SELECT * FROM bunk_records WHERE phone = ? AND LOWER(subject) = LOWER(?) ORDER BY date DESC`).all(phone, subject);
        } else {
            rows = db.prepare(`SELECT * FROM bunk_records WHERE phone = ? ORDER BY date DESC`).all(phone);
        }
        callback(null, rows);
    } catch (err) {
        callback(err);
    }
}

// =============================================================================
// ALL USERS (for cron jobs)
// =============================================================================
function getAllUsers(callback) {
    try {
        const onboardedUsers = db.prepare(`SELECT phone FROM users WHERE onboarded = 1`).all();
        const phoneSet = new Set(onboardedUsers.map(u => u.phone));

        // Also include anyone who has timetable data (works on fresh installs)
        const timetableUsers = db.prepare(`SELECT DISTINCT phone FROM timetable`).all();
        timetableUsers.forEach(u => phoneSet.add(u.phone));

        callback(null, Array.from(phoneSet).map(phone => ({ phone })));
    } catch (err) {
        callback(err);
    }
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
