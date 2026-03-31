const Tesseract = require('tesseract.js');

async function extractTextFromImage(imageBuffer) {
    try {
        const result = await Tesseract.recognize(
            imageBuffer,
            'eng',
            {
                logger: m => console.log(m)
            }
        );
        
        return result.data.text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw new Error('Failed to extract text from image');
    }
}

function extractAmountFromText(text) {
    // Look for patterns like ₹500, 500, $500, etc.
    const amountPattern = /(?:₹|Rs\.?|\$)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i;
    const match = text.match(amountPattern);
    
    if (match) {
        // Remove commas and convert to number
        return parseFloat(match[1].replace(/,/g, ''));
    }
    
    return null;
}

function extractDateFromText(text) {
    // Look for date patterns
    const datePatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})/, // DD/MM/YYYY
        /(\d{1,2}-\d{1,2}-\d{4})/,   // DD-MM-YYYY
        /(\d{4}-\d{1,2}-\d{1,2})/    // YYYY-MM-DD
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

module.exports = {
    extractTextFromImage,
    extractAmountFromText,
    extractDateFromText
};
