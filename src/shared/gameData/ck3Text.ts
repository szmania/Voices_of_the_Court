/**
 * Remove CK3 rich-text control bytes, data-context actions, tooltips, and
 * formatting tokens from text emitted through debug.log.
 */
export function removeTooltip(str: string): string {
    if (!str) return "";

    // \x15/\x16 wrap CK3 rich-text commands in rendered debug strings.
    let cleanedStr = str.replace(/[\x15\x16]/g, '')
                      .replace(/\^U[^\n]*/g, '')
                      .replace(/\b(?:ONCLICK|TOOLTIP):[A-Z_]+,[^\s)]*/g, '')
                      .replace(/^\s*([A-Z][;\s]\s*)+/, '')
                      .replace(/(?<![A-Za-z])L\s+/g, '')
                      .replace(/(?<![A-Za-z])[A-Z];\s*/g, '');

    cleanedStr = cleanedStr.replace(/\b(?:high|weak|positive_value|negative_value|zero_value)\b\s*/g, '');

    const lSemicolonIndex = cleanedStr.indexOf(' L; ');
    if (lSemicolonIndex !== -1) {
        cleanedStr = cleanedStr.substring(lSemicolonIndex + 4);
    }

    return cleanedStr.replace(/!+/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[\s:!']+$/, '')
      .trim();
}
