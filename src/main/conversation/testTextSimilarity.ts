/**
 * Test file for text similarity functions.
 * Run with: npx ts-node testTextSimilarity.ts
 */

import {
    jaccardSimilarity,
    cosineSimilarity,
    levenshteinSimilarity,
    combinedSimilarity,
    calculateRepetitionScore,
    detectRepetition,
    getRepetitionReductionSuggestions
} from './textSimilarity.js';

function testSimilarityFunctions() {
    console.log('Testing Text Similarity Functions\n');
    
    // Test cases
    const testCases = [
        {
            text1: "The quick brown fox jumps over the lazy dog",
            text2: "The quick brown fox jumps over the lazy dog",
            description: "Identical sentences"
        },
        {
            text1: "The quick brown fox jumps over the lazy dog",
            text2: "A quick brown fox jumps over a lazy dog",
            description: "Similar sentences with minor changes"
        },
        {
            text1: "The quick brown fox jumps over the lazy dog",
            text2: "The lazy dog is jumped over by the quick brown fox",
            description: "Same meaning, different structure"
        },
        {
            text1: "The quick brown fox jumps over the lazy dog",
            text2: "I like to eat pizza on weekends",
            description: "Completely different sentences"
        },
        {
            text1: "Hello world",
            text2: "Hello world!",
            description: "Same text with punctuation difference"
        }
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.description}`);
        console.log(`Text 1: "${testCase.text1}"`);
        console.log(`Text 2: "${testCase.text2}"`);
        console.log(`Jaccard Similarity: ${jaccardSimilarity(testCase.text1, testCase.text2).toFixed(3)}`);
        console.log(`Cosine Similarity: ${cosineSimilarity(testCase.text1, testCase.text2).toFixed(3)}`);
        console.log(`Levenshtein Similarity: ${levenshteinSimilarity(testCase.text1, testCase.text2).toFixed(3)}`);
        console.log(`Combined Similarity: ${combinedSimilarity(testCase.text1, testCase.text2).toFixed(3)}`);
        console.log('---');
    });
    
    // Test repetition detection
    console.log('\nTesting Repetition Detection\n');
    
    const recentResponses = [
        "I think we should consider all options carefully before making a decision.",
        "We need to carefully consider all available options before deciding.",
        "Before making a decision, we should consider all options carefully.",
        "It's important to consider all options carefully before deciding."
    ];
    
    const newResponse = "We should carefully consider all options before making a decision.";
    
    console.log('Recent Responses:');
    recentResponses.forEach((resp, i) => console.log(`${i + 1}. ${resp}`));
    console.log(`\nNew Response: "${newResponse}"`);
    
    const repetitionScore = calculateRepetitionScore(newResponse, recentResponses);
    console.log(`Repetition Score: ${repetitionScore.toFixed(3)}`);
    
    const isRepetitive = detectRepetition(newResponse, recentResponses, 0.6);
    console.log(`Detected as repetitive (threshold 0.6): ${isRepetitive}`);
    
    const suggestions = getRepetitionReductionSuggestions(repetitionScore);
    console.log('\nSuggestions:');
    suggestions.forEach(suggestion => console.log(`- ${suggestion}`));
    
    // Test edge cases
    console.log('\nTesting Edge Cases\n');
    console.log(`Empty strings - Jaccard: ${jaccardSimilarity('', '').toFixed(3)}`);
    console.log(`Null strings - Cosine: ${cosineSimilarity('', 'test').toFixed(3)}`);
    console.log(`Very short strings - Levenshtein: ${levenshteinSimilarity('a', 'b').toFixed(3)}`);
}

// Run tests if this file is executed directly
if (require.main === module) {
    testSimilarityFunctions();
}

export default testSimilarityFunctions;
