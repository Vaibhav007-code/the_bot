# BUDDY - WhatsApp Bot for College Students

A personal productivity WhatsApp bot designed specifically for college students. BUDDY helps manage timetables, track expenses, organize tasks, and stay on top of deadlines - all with ₹0 external costs.

## Features

### 📚 Timetable Management
- Update your weekly timetable
- Get class reminders 5 minutes before each class
- Format: `Mon: Math 09:00-10:00, Physics 11:00-12:00 | Tue: DBMS 10:00-11:00`

### 💰 Expense Tracking
- Add expenses manually or via receipt images (OCR)
- View monthly expense summaries
- Split expenses among friends
- Automatic receipt text extraction using Tesseract.js

### ⏰ Daily Planning
- Add and view daily tasks
- Night planning prompts at customizable times
- Interactive morning briefs with your schedule and tasks
- Set custom planning and morning times

### 📝 Deadline Management
- Add assignment and project deadlines
- View upcoming deadlines with urgency indicators
- Automatic deadline tracking

### 🔗 Study Resources
- Save and organize study links by subject
- Quick access to subject-specific resources
- Support for all major subjects

### 💤 Class Bunking
- Fun responses for when you want to skip class
- Shows you exactly what free time you'll have

### 📊 Expense Splitting
- Calculate splits for group expenses
- Handle remainders automatically

### 📄 Text Summarization
- Summarize long texts using node-summarizer
- Perfect for study notes and articles

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd daily-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create data directory:
```bash
mkdir -p data
```

4. Run the bot:
```bash
npm start
```

## Usage

### Getting Started
1. Scan the QR code when prompted
2. Send your name: "My name is John"
3. Start using any of the features!

### Commands

#### Timetable
```
timetable Mon: Math 09:00-10:00, Physics 11:00-12:00 | Tue: DBMS 10:00-11:00
```

#### Tasks
```
add task complete assignment
add task tomorrow
my tasks
today tasks
```

#### Expenses
```
expense 50 on lunch
spent 200 for books
view expenses
split 500 between 3 people
```

#### Deadlines
```
deadline submit project by 25/12/2024
due assignment tomorrow
view deadlines
```

#### Resources
```
add math resource: https://example.com/video
view math resources
```

#### Settings
```
set planning time 10:30 PM
set morning time 8 AM
```

#### Other
```
bunk math
summarize [long text]
help
```

## Database Structure

The bot uses SQLite with the following tables:
- `users` - User information and onboarding status
- `timetable` - Class schedules with start/end times
- `daily_tasks` - Task management by date
- `user_settings` - Custom times for planning and morning briefs
- `expenses` - Expense tracking with categories
- `deadlines` - Assignment and project deadlines
- `resources` - Study links organized by subject

## Technology Stack

- **whatsapp-web.js** - WhatsApp connectivity
- **better-sqlite3** - Local database storage
- **node-cron** - Scheduled tasks and reminders
- **tesseract.js** - OCR for receipt images
- **node-summarizer** - Text summarization
- **puppeteer + cheerio** - Web scraping capabilities
- **keyword-based intent detection** - No external AI APIs

## Cost

**Total external cost: ₹0**

All functionality works offline using local processing and open-source libraries. No external AI APIs or paid services are required.

## Project Structure

```
buddy/
├── index.js              # Main bot entry point
├── sessions/             # WhatsApp session storage
├── features/             # Feature modules
│   ├── bunk.js          # Class bunking
│   ├── splitter.js      # Expense splitting
│   ├── summarizer.js    # Text summarization
│   ├── resources.js     # Study resource management
│   ├── expenses.js      # Expense tracking
│   ├── deadlines.js     # Deadline management
│   ├── timetable.js     # Schedule management
│   └── planner.js       # Daily task planning
├── utils/               # Utility modules
│   ├── ocr.js          # Receipt image processing
│   ├── intent.js       # Intent detection
│   └── db.js           # Database operations
├── data/               # Database storage
│   └── buddy.db        # SQLite database
└── package.json        # Dependencies
```

## Automated Features

### Morning Brief (Customizable Time)
- Daily personalized message
- Shows today's classes
- Lists pending tasks
- Displays upcoming deadlines
- Interactive response options

### Night Planning (Customizable Time)
- Daily planning prompt
- Add tasks for next day
- Option to skip or view tomorrow's plan
- Conversational task entry

### Class Reminders
- Automatic reminders 5 minutes before each class
- Shows subject, start time, and end time
- Runs every minute to check for upcoming classes

## Development

To run in development mode:
```bash
npm run dev
```

This uses nodemon for automatic restarts on file changes.

## Privacy

- All data stored locally in SQLite database
- No data sent to external services
- WhatsApp sessions stored locally
- Complete privacy for user information

## License

MIT License - feel free to use and modify for your own needs!
