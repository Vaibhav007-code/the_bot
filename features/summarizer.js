// Handle text summarization - simple extractive summarizer (no external deps needed)
async function handleSummarize(client, message, phone) {
    // Check if there's text to summarize after the keyword
    const textToSummarize = message.body.replace(/summarize|summary/gi, '').trim();
    
    if (!textToSummarize || textToSummarize.length < 50) {
        await message.reply(
            '📄 Please provide the text you want me to summarize.\n\n' +
            '*Example:* "summarize [your long text here]"\n\n' +
            'The text should be at least a few sentences long.'
        );
        return;
    }
    
    try {
        const summary = extractiveSummarize(textToSummarize, 3);
        
        if (summary && summary.length > 0) {
            const compressionRatio = ((1 - summary.length / textToSummarize.length) * 100).toFixed(0);
            await message.reply(
                `📝 *Summary:*\n\n${summary}\n\n` +
                `📊 Compressed by ${compressionRatio}% (${textToSummarize.length} → ${summary.length} chars)`
            );
        } else {
            await message.reply('❌ I couldn\'t generate a summary from that text. Please try with a longer text.');
        }
    } catch (error) {
        console.error('Summarization error:', error);
        await message.reply('Sorry, I had trouble summarizing that text. Please try again.');
    }
}

// Simple extractive summarization - no external dependencies
function extractiveSummarize(text, numSentences) {
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (sentences.length <= numSentences) {
        return text.trim();
    }
    
    // Calculate word frequency
    const wordFreq = {};
    const words = text.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
    
    // Common stop words to ignore
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'out', 'off', 'up',
        'down', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
        'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same',
        'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where',
        'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
        'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
        'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their'
    ]);
    
    words.forEach(word => {
        if (word.length > 2 && !stopWords.has(word)) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });
    
    // Score each sentence based on word frequency
    const sentenceScores = sentences.map((sentence, index) => {
        const sentenceWords = sentence.toLowerCase().replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
        let score = 0;
        
        sentenceWords.forEach(word => {
            if (wordFreq[word]) {
                score += wordFreq[word];
            }
        });
        
        // Normalize by sentence length
        score = score / Math.max(sentenceWords.length, 1);
        
        // Slight boost for first and second sentences (usually important)
        if (index === 0) score *= 1.3;
        if (index === 1) score *= 1.1;
        
        return { sentence: sentence.trim(), score, index };
    });
    
    // Sort by score, take top N
    sentenceScores.sort((a, b) => b.score - a.score);
    const topSentences = sentenceScores.slice(0, numSentences);
    
    // Sort back by original order for coherent reading
    topSentences.sort((a, b) => a.index - b.index);
    
    return topSentences.map(s => s.sentence).join(' ');
}

module.exports = {
    handleSummarize
};
