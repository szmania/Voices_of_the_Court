/**
 * Text similarity analysis utilities for detecting repetition in AI responses.
 * Provides various methods to calculate similarity between text strings.
 */

/**
 * Calculate Jaccard similarity between two strings.
 * Jaccard similarity is the size of the intersection divided by the size of the union of the token sets.
 * @param text1 First text string
 * @param text2 Second text string
 * @returns Similarity score between 0 (completely different) and 1 (identical)
 */
export function jaccardSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Tokenize by splitting on whitespace and punctuation
    const tokenize = (text: string): Set<string> => {
        return new Set(
            text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(token => token.length > 0)
        );
    };
    
    const set1 = tokenize(text1);
    const set2 = tokenize(text2);
    
    if (set1.size === 0 && set2.size === 0) return 1;
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two strings using term frequency vectors.
 * @param text1 First text string
 * @param text2 Second text string
 * @returns Similarity score between 0 (completely different) and 1 (identical)
 */
export function cosineSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Create term frequency vectors
    const getTermFrequencies = (text: string): Map<string, number> => {
        const frequencies = new Map<string, number>();
        const tokens = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 0);
        
        tokens.forEach(token => {
            frequencies.set(token, (frequencies.get(token) || 0) + 1);
        });
        
        return frequencies;
    };
    
    const tf1 = getTermFrequencies(text1);
    const tf2 = getTermFrequencies(text2);
    
    // Calculate dot product
    let dotProduct = 0;
    for (const [term, freq1] of tf1) {
        const freq2 = tf2.get(term) || 0;
        dotProduct += freq1 * freq2;
    }
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt([...tf1.values()].reduce((sum, freq) => sum + freq * freq, 0));
    const magnitude2 = Math.sqrt([...tf2.values()].reduce((sum, freq) => sum + freq * freq, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate Levenshtein distance (edit distance) between two strings.
 * @param text1 First text string
 * @param text2 Second text string
 * @returns Normalized similarity score between 0 (completely different) and 1 (identical)
 */
export function levenshteinSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Convert to lowercase for case-insensitive comparison
    const a = text1.toLowerCase();
    const b = text2.toLowerCase();
    
    // Create distance matrix
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
}

/**
 * Calculate combined similarity score using multiple methods.
 * @param text1 First text string
 * @param text2 Second text string
 * @param weights Optional weights for each method [jaccard, cosine, levenshtein]
 * @returns Combined similarity score between 0 and 1
 */
export function combinedSimilarity(
    text1: string, 
    text2: string, 
    weights: [number, number, number] = [0.4, 0.4, 0.2]
): number {
    const jaccard = jaccardSimilarity(text1, text2);
    const cosine = cosineSimilarity(text1, text2);
    const levenshtein = levenshteinSimilarity(text1, text2);
    
    return (jaccard * weights[0] + cosine * weights[1] + levenshtein * weights[2]);
}

/**
 * Analyze similarity between a response and recent responses to detect repetition.
 * @param currentResponse The current AI response
 * @param recentResponses Array of recent AI responses (most recent first)
 * @param maxRecentResponses Maximum number of recent responses to compare against
 * @returns Repetition score between 0 (no repetition) and 1 (high repetition)
 */
export function calculateRepetitionScore(
    currentResponse: string,
    recentResponses: string[],
    maxRecentResponses: number = 5
): number {
    if (recentResponses.length === 0) return 0;
    
    // Only consider the most recent responses
    const responsesToCheck = recentResponses.slice(0, maxRecentResponses);
    
    // Calculate similarity with each recent response
    const similarities = responsesToCheck.map(response => 
        combinedSimilarity(currentResponse, response)
    );
    
    // Return the highest similarity (most similar recent response)
    return Math.max(...similarities);
}

/**
 * Check if a response is too similar to recent responses.
 * @param currentResponse The current AI response
 * @param recentResponses Array of recent AI responses
 * @param threshold Similarity threshold above which repetition is detected (0-1)
 * @returns True if repetition is detected, false otherwise
 */
export function detectRepetition(
    currentResponse: string,
    recentResponses: string[],
    threshold: number = 0.7
): boolean {
    const score = calculateRepetitionScore(currentResponse, recentResponses);
    return score > threshold;
}

/**
 * Generate suggestions for reducing repetition based on similarity analysis.
 * @param repetitionScore Current repetition score
 * @returns Array of suggestion strings
 */
export function getRepetitionReductionSuggestions(repetitionScore: number): string[] {
    const suggestions: string[] = [];
    
    if (repetitionScore > 0.8) {
        suggestions.push("High repetition detected. Consider increasing temperature and frequency penalty significantly.");
        suggestions.push("Try changing the conversation topic or introducing new elements.");
    } else if (repetitionScore > 0.6) {
        suggestions.push("Moderate repetition detected. Slightly increase temperature and frequency penalty.");
        suggestions.push("Consider adding more varied vocabulary in the prompt.");
    } else if (repetitionScore > 0.4) {
        suggestions.push("Low repetition detected. Monitor conversation for patterns.");
    }
    
    return suggestions;
}
