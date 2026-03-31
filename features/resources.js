const { addResource, getResources } = require('../utils/db');

// Handle adding study resources - supports multi-step flow
async function handleAddResource(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If user just sent "5" from menu
    if (msg === '5') {
        return {
            action: 'await_resource_data',
            reply: '🔗 Share a study resource!\n\n' +
                   '*Format:* add [subject] resource: [link]\n\n' +
                   '*Examples:*\n' +
                   '• "add math resource: https://example.com/video"\n' +
                   '• "physics notes https://example.com"\n\n' +
                   '*Supported subjects:*\n' +
                   'Math, Physics, Chemistry, Biology, Computer, DBMS, Data Structures, Algorithms, Networks, English, Economics\n\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    // Try to extract subject and link
    let subject = null;
    let link = null;
    let description = '';
    
    // Simple parsing - look for URLs
    const urlMatch = message.body.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
        link = urlMatch[0];
    }
    
    // Extract subject - expanded list
    const subjects = [
        'math', 'maths', 'mathematics',
        'physics', 'phy',
        'chemistry', 'chem',
        'biology', 'bio',
        'computer', 'cs', 'computer science',
        'dbms', 'database',
        'data structures', 'ds', 'dsa',
        'algorithms', 'algo',
        'networks', 'networking', 'cn',
        'english', 'eng',
        'economics', 'eco',
        'hindi',
        'history',
        'geography',
        'electronics',
        'mechanical',
        'civil',
        'electrical'
    ];
    
    const subjectMap = {
        'math': 'Math', 'maths': 'Math', 'mathematics': 'Math',
        'physics': 'Physics', 'phy': 'Physics',
        'chemistry': 'Chemistry', 'chem': 'Chemistry',
        'biology': 'Biology', 'bio': 'Biology',
        'computer': 'Computer', 'cs': 'Computer', 'computer science': 'Computer',
        'dbms': 'DBMS', 'database': 'DBMS',
        'data structures': 'Data Structures', 'ds': 'Data Structures', 'dsa': 'Data Structures',
        'algorithms': 'Algorithms', 'algo': 'Algorithms',
        'networks': 'Networks', 'networking': 'Networks', 'cn': 'Networks',
        'english': 'English', 'eng': 'English',
        'economics': 'Economics', 'eco': 'Economics',
        'hindi': 'Hindi',
        'history': 'History',
        'geography': 'Geography',
        'electronics': 'Electronics',
        'mechanical': 'Mechanical',
        'civil': 'Civil',
        'electrical': 'Electrical'
    };
    
    for (const sub of subjects) {
        if (msg.includes(sub)) {
            subject = subjectMap[sub] || sub.charAt(0).toUpperCase() + sub.slice(1);
            break;
        }
    }
    
    if (!subject) {
        await message.reply(
            '❌ What subject is this resource for?\n\n' +
            '*Example:* "add math resource: https://example.com/video"\n\n' +
            '*Supported subjects:* Math, Physics, Chemistry, Biology, Computer, DBMS, Data Structures, Algorithms, Networks, English, Economics'
        );
        return null;
    }
    
    if (!link) {
        await message.reply(
            `📚 Subject: ${subject}\n\n` +
            '❌ Please provide the resource link.\n\n' +
            `*Example:* "add ${subject.toLowerCase()} resource: https://example.com/video"`
        );
        return null;
    }
    
    // Extract description (anything meaningful after removing known parts)
    description = message.body;
    description = description.replace(/add|resource|material|notes/gi, '');
    description = description.replace(link, '');
    for (const sub of subjects) {
        description = description.replace(new RegExp(sub, 'gi'), '');
    }
    description = description.replace(/[:]/g, '').replace(/\s+/g, ' ').trim();
    
    addResource(phone, subject, link, description, (err) => {
        if (err) {
            console.error('Error adding resource:', err);
            message.reply('Sorry, I had trouble adding that resource. Please try again.');
            return;
        }
        
        message.reply(
            `✅ *Resource Added for ${subject}!*\n\n` +
            `🔗 ${link}\n` +
            (description ? `📝 ${description}\n` : '') +
            '\nView resources with option 10 or "view resources"'
        );
    });
    
    return null;
}

// Handle viewing resources
async function handleViewResources(client, message, phone) {
    const msg = message.body.toLowerCase();
    
    let subject = null;
    const subjectMap = {
        'math': 'Math', 'maths': 'Math',
        'physics': 'Physics',
        'chemistry': 'Chemistry',
        'biology': 'Biology',
        'computer': 'Computer',
        'dbms': 'DBMS',
        'data structures': 'Data Structures',
        'algorithms': 'Algorithms',
        'networks': 'Networks',
        'english': 'English',
        'economics': 'Economics'
    };
    
    for (const [key, val] of Object.entries(subjectMap)) {
        if (msg.includes(key)) {
            subject = val;
            break;
        }
    }
    
    getResources(phone, subject, (err, resources) => {
        if (err) {
            console.error('Error getting resources:', err);
            message.reply('Sorry, I had trouble retrieving your resources. Please try again.');
            return;
        }
        
        if (resources.length === 0) {
            if (subject) {
                message.reply(`📚 No resources found for *${subject}*.\n\nAdd one: "add ${subject.toLowerCase()} resource: [link]"`);
            } else {
                message.reply('📚 No resources found.\n\nAdd one: "add [subject] resource: [link]"');
            }
            return;
        }
        
        // Group by subject
        const grouped = {};
        resources.forEach(r => {
            if (!grouped[r.subject]) grouped[r.subject] = [];
            grouped[r.subject].push(r);
        });
        
        let response = `📚 *${subject ? subject + ' ' : ''}Resources:*\n\n`;
        
        for (const [sub, items] of Object.entries(grouped)) {
            if (!subject) response += `*${sub}:*\n`;
            items.forEach((resource, index) => {
                response += `  ${index + 1}. ${resource.link}\n`;
                if (resource.description) {
                    response += `     ${resource.description}\n`;
                }
            });
            response += '\n';
        }
        
        message.reply(response.trim());
    });
}

module.exports = {
    handleAddResource,
    handleViewResources
};
