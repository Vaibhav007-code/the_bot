const { addResource, getResources } = require('../utils/db');

// In-memory notes storage (persisted via resources system with subject = "Notes")

/**
 * Handle adding a quick note
 * Format: "note math: integration formula is ∫f(x)dx"
 * Or: "note: remember to bring lab coat"
 */
async function handleAddNote(client, message, phone) {
    const msg = message.body.trim();
    const lowerMsg = msg.toLowerCase();
    
    // If just "15" or "note" from menu
    if (lowerMsg === '16' || lowerMsg === 'note' || lowerMsg === 'notes' || lowerMsg === 'add note') {
        return {
            action: 'await_note_data',
            reply: '📓 *Quick Notes*\n\n' +
                   'Send your note in this format:\n\n' +
                   '*With subject:*\n' +
                   '• "note math: integration formula"\n' +
                   '• "note physics: F = ma"\n\n' +
                   '*General note:*\n' +
                   '• "note: bring lab coat tomorrow"\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    // Parse note
    let noteText = msg.replace(/^(note|add note)\s*/i, '').trim();
    let subject = 'General';
    
    // Check if there's a subject prefix (before colon)
    const colonIndex = noteText.indexOf(':');
    if (colonIndex > 0 && colonIndex < 30) {
        const possibleSubject = noteText.substring(0, colonIndex).trim();
        // Only treat as subject if it's a single word or short phrase
        if (possibleSubject.split(/\s+/).length <= 3) {
            subject = possibleSubject.charAt(0).toUpperCase() + possibleSubject.slice(1);
            noteText = noteText.substring(colonIndex + 1).trim();
        }
    }
    
    if (!noteText || noteText.length < 2) {
        await message.reply('❌ Please provide the note content.\n\nExample: "note math: integration formula"');
        return null;
    }
    
    // Store as a resource with type "note"
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    addResource(phone, `Notes-${subject}`, noteText, `[${timestamp}]`, (err) => {
        if (err) {
            console.error('Error adding note:', err);
            message.reply('Sorry, I had trouble saving that note.');
            return;
        }
        
        message.reply(
            `📓 *Note Saved!*\n\n` +
            `📁 Subject: ${subject}\n` +
            `📝 ${noteText}\n\n` +
            `View notes: "view notes" or "view math notes"`
        );
    });
    
    return null;
}

/**
 * Handle viewing notes
 */
async function handleViewNotes(client, message, phone) {
    const msg = message.body.toLowerCase();
    
    // Check for subject filter
    let subjectFilter = null;
    const subjects = ['math', 'physics', 'chemistry', 'biology', 'computer', 'dbms', 'english', 'general'];
    
    for (const sub of subjects) {
        if (msg.includes(sub)) {
            subjectFilter = `Notes-${sub.charAt(0).toUpperCase() + sub.slice(1)}`;
            break;
        }
    }
    
    // Get all notes (stored as resources with "Notes-" prefix)
    getResources(phone, null, (err, allResources) => {
        if (err) {
            console.error('Error getting notes:', err);
            message.reply('Sorry, I had trouble retrieving your notes.');
            return;
        }
        
        // Filter to only notes
        let notes = allResources.filter(r => r.subject.startsWith('Notes-'));
        
        if (subjectFilter) {
            notes = notes.filter(r => r.subject.toLowerCase() === subjectFilter.toLowerCase());
        }
        
        if (notes.length === 0) {
            message.reply(
                '📓 No notes found!\n\n' +
                'Add one: "note math: your note here"'
            );
            return;
        }
        
        // Group by subject
        const grouped = {};
        notes.forEach(n => {
            const sub = n.subject.replace('Notes-', '');
            if (!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(n);
        });
        
        let response = '📓 *Your Notes:*\n\n';
        
        for (const [sub, items] of Object.entries(grouped)) {
            response += `📁 *${sub}:*\n`;
            items.forEach((note, i) => {
                response += `  ${i + 1}. ${note.link}\n`;
                if (note.description) response += `     _${note.description}_\n`;
            });
            response += '\n';
        }
        
        message.reply(response.trim());
    });
}

module.exports = {
    handleAddNote,
    handleViewNotes
};
