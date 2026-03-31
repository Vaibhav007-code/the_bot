const { addExpense, getExpenses, deleteExpense } = require('../utils/db');
const { extractExpenseInfo } = require('../utils/intent');

// Handle adding expense - supports multi-step flow
async function handleAddExpense(client, message, phone) {
    const msg = message.body.toLowerCase().trim();
    
    // If user just sent "2" from menu, ask for expense details
    if (msg === '2') {
        return {
            action: 'await_expense_data',
            reply: '💰 How much did you spend? Tell me the details!\n\n' +
                   '*Examples:*\n' +
                   '• "50 on lunch"\n' +
                   '• "200 for books"\n' +
                   '• "150 cab"\n' +
                   '• "80 coffee"\n\n' +
                   'Or send a receipt image!\n' +
                   'Send "cancel" to go back.'
        };
    }
    
    // Check if message has image
    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            
            if (media && media.mimetype && media.mimetype.startsWith('image/')) {
                try {
                    const { extractTextFromImage, extractAmountFromText } = require('../utils/ocr');
                    const extractedText = await extractTextFromImage(Buffer.from(media.data, 'base64'));
                    const amount = extractAmountFromText(extractedText);
                    
                    if (amount) {
                        addExpense(phone, amount, 'Receipt', extractedText.substring(0, 100), (err) => {
                            if (err) {
                                console.error('Error adding expense from receipt:', err);
                                message.reply('I had trouble saving that expense. Please try again.');
                                return;
                            }
                            message.reply(`💰 Expense added from receipt: ₹${amount}`);
                        });
                    } else {
                        await message.reply('I couldn\'t find an amount in the receipt. Please tell me the amount manually.\n\nExample: "50 on lunch"');
                    }
                } catch (ocrError) {
                    console.error('OCR error:', ocrError);
                    await message.reply('I had trouble reading the receipt. Please tell me the expense details manually.\n\nExample: "50 on lunch"');
                }
                return null;
            }
        } catch (mediaError) {
            console.error('Media download error:', mediaError);
        }
    }
    
    // Handle text-based expense
    const { amount, category, description } = extractExpenseInfo(message.body);
    
    if (!amount || amount <= 0) {
        await message.reply(
            '❌ Please specify a valid amount!\n\n' +
            '*Examples:*\n' +
            '• "expense 50 on lunch"\n' +
            '• "spent 200 for books"\n' +
            '• "paid 150 for cab"\n\n' +
            'You can also send a receipt image!'
        );
        return null;
    }
    
    addExpense(phone, amount, category, description, (err) => {
        if (err) {
            console.error('Error adding expense:', err);
            message.reply('Sorry, I had trouble adding that expense. Please try again.');
            return;
        }
        
        message.reply(
            `✅ *Expense Added*\n\n` +
            `💰 Amount: ₹${amount}\n` +
            `📁 Category: ${category}\n` +
            (description ? `📝 Note: ${description}\n` : '') +
            `📅 Date: ${new Date().toISOString().split('T')[0]}`
        );
    });
    
    return null;
}

// Handle viewing expenses
async function handleViewExpenses(client, message, phone) {
    const msg = message.body.toLowerCase();
    
    // Check for month specification
    let month = null;
    const monthMatch = msg.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i);
    
    if (monthMatch) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        month = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
    }
    
    getExpenses(phone, month, (err, expenses) => {
        if (err) {
            console.error('Error getting expenses:', err);
            message.reply('Sorry, I had trouble retrieving your expenses. Please try again.');
            return;
        }
        
        if (expenses.length === 0) {
            message.reply('📝 No expenses found for this period.\n\nAdd one with: "expense 50 on lunch"');
            return;
        }
        
        let total = 0;
        let response = `💰 *Expenses${month ? ` (${month})` : ''}:*\n\n`;
        
        // Group by category
        const byCategory = {};
        expenses.forEach(expense => {
            total += expense.amount;
            if (!byCategory[expense.category]) {
                byCategory[expense.category] = { total: 0, items: [] };
            }
            byCategory[expense.category].total += expense.amount;
            byCategory[expense.category].items.push(expense);
        });
        
        // Show individual expenses
        expenses.slice(0, 15).forEach((expense, index) => {
            response += `${index + 1}. ₹${expense.amount} - ${expense.category}`;
            if (expense.description) response += ` (${expense.description})`;
            response += ` [${expense.date}]\n`;
        });
        
        if (expenses.length > 15) {
            response += `... and ${expenses.length - 15} more\n`;
        }
        
        response += `\n📊 *Category Breakdown:*\n`;
        for (const [cat, data] of Object.entries(byCategory)) {
            response += `  ${cat}: ₹${data.total.toFixed(2)} (${data.items.length} items)\n`;
        }
        
        response += `\n💵 *Total: ₹${total.toFixed(2)}*`;
        
        message.reply(response);
    });
}

module.exports = {
    handleAddExpense,
    handleViewExpenses
};
