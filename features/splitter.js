// Handle expense splitting
async function handleSplitExpense(client, message, phone) {
    const msg = message.body.toLowerCase();
    
    // Extract all numbers from the message
    const numbers = msg.match(/\d+(?:\.\d{1,2})?/g);
    
    if (!numbers || numbers.length === 0) {
        await message.reply(
            '💸 How much do you want to split?\n\n' +
            '*Examples:*\n' +
            '• "split 500 between 3 people"\n' +
            '• "divide 1200 among 4 friends"\n' +
            '• "split 300 3 ways"'
        );
        return;
    }
    
    let amount = null;
    let people = 2; // default
    
    if (numbers.length >= 2) {
        // First number is amount, second is people (usually)
        amount = parseFloat(numbers[0]);
        const secondNum = parseInt(numbers[1]);
        
        // Sanity check: people count should be small (< 100), amount is usually larger
        if (secondNum > 0 && secondNum < 100) {
            people = secondNum;
        }
    } else {
        amount = parseFloat(numbers[0]);
        
        // Try to extract people from text patterns
        const peopleMatch = msg.match(/between\s+(\d+)|among\s+(\d+)|(\d+)\s+people|(\d+)\s+friends|(\d+)\s+ways/);
        if (peopleMatch) {
            people = parseInt(peopleMatch[1] || peopleMatch[2] || peopleMatch[3] || peopleMatch[4] || peopleMatch[5]);
        }
    }
    
    if (!amount || amount <= 0) {
        await message.reply('❌ Please specify a valid amount to split.');
        return;
    }
    
    if (people < 2) {
        await message.reply('❌ You need at least 2 people to split an expense!');
        return;
    }
    
    const sharePerPerson = (amount / people).toFixed(2);
    const remainder = (amount - (Math.floor(amount / people) * people)).toFixed(2);
    
    let response = `💸 *Expense Split*\n\n` +
                  `💰 Total: ₹${amount}\n` +
                  `👥 People: ${people}\n` +
                  `💵 Each pays: ₹${sharePerPerson}\n`;
    
    if (parseFloat(remainder) > 0) {
        response += `\n⚠️ Note: ₹${remainder} remainder (someone pays a bit extra)`;
    }
    
    await message.reply(response);
}

module.exports = {
    handleSplitExpense
};
