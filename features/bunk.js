const { getTimetable, addBunkRecord, getBunkCount } = require('../utils/db');

// Handle bunk class request
async function handleBunkClass(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If user just sent "6" from menu, ask for subject
    if (msg === '6' || msg === 'bunk' || msg === 'skip') {
        await message.reply(
            '💤 Which subject do you want to bunk?\n\n' +
            'Example: "bunk math" or "skip physics"'
        );
        return;
    }
    
    // Try to extract subject from message
    const words = msg.split(/\s+/);
    let subject = null;
    
    const skipWords = new Set(['bunk', 'skip', 'i', 'want', 'to', 'class', 'the', 'a', 'my']);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!skipWords.has(word) && word.length > 1) {
            // Capitalize first letter
            subject = word.charAt(0).toUpperCase() + word.slice(1);
            break;
        }
    }
    
    if (!subject) {
        await message.reply(
            'Which subject do you want to bunk? Please specify the subject name.\n\n' +
            'Example: "bunk math" or "skip physics"'
        );
        return;
    }
    
    // Get today's timetable
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = days[now.getDay()];
    
    getTimetable(phone, currentDay, (err, timetable) => {
        if (err) {
            console.error('Error getting timetable:', err);
            message.reply('Sorry, I had trouble checking your timetable. Please try again.');
            return;
        }
        
        if (!timetable || timetable.length === 0) {
            message.reply(
                `📚 You don't have any classes scheduled for today (${currentDay}).\n\n` +
                'Set your timetable first with option 1!'
            );
            return;
        }
        
        const todayClass = timetable.find(cls => cls.subject.toLowerCase() === subject.toLowerCase());
        
        if (!todayClass) {
            const availableSubjects = timetable.map(cls => cls.subject).join(', ');
            message.reply(
                `❌ You don't have *${subject}* today!\n\n` +
                `Today's subjects: ${availableSubjects}`
            );
            return;
        }
        
        // Track bunk
        const today = now.toISOString().split('T')[0];
        addBunkRecord(phone, subject, today, () => {});
        
        // Get total bunk count
        getBunkCount(phone, subject, (err, count) => {
            const currentTime = new Date();
            const classStartTime = new Date();
            const [hours, minutes] = todayClass.start_time.split(':');
            classStartTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            let statusMsg = '';
            if (currentTime >= classStartTime) {
                statusMsg = `⏰ ${subject} has already started! (${todayClass.start_time}-${todayClass.end_time})\n\n`;
            } else {
                const timeUntilClass = Math.floor((classStartTime - currentTime) / (1000 * 60));
                statusMsg = `📚 ${subject} today: ${todayClass.start_time}-${todayClass.end_time}\n⏰ Class starts in ${timeUntilClass} minutes\n\n`;
            }
            
            message.reply(
                `💤 *Bunking ${subject}*\n\n` +
                statusMsg +
                `📊 Total bunks in ${subject}: ${count}\n\n` +
                `💡 Tips:\n` +
                `• Get notes from classmates\n` +
                `• Check for assignments online\n` +
                `• Don't make it a habit! 😉`
            );
        });
    });
}

module.exports = {
    handleBunkClass
};
