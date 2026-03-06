/**
 * Calculates the Levenshtein distance between two strings.
 * @param a The first string.
 * @param b The second string.
 * @returns The Levenshtein distance.
 */
function levenshtein(a: string, b: string): number {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) {
        return bn;
    }
    if (bn === 0) {
        return an;
    }
    const matrix = new Array<number[]>(bn + 1);
    for (let i = 0; i <= bn; ++i) {
        let row = matrix[i] = new Array<number>(an + 1);
        row[0] = i;
    }
    const firstRow = matrix[0];
    for (let j = 1; j <= an; ++j) {
        firstRow[j] = j;
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[bn][an];
}

/**
 * Calculates the similarity ratio between two strings based on Levenshtein distance.
 * @param a The first string.
 * @param b The second string.
 * @returns A similarity ratio between 0 and 1.
 */
export function getSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) {
        return 1;
    }
    return 1 - (dist / maxLen);
}
