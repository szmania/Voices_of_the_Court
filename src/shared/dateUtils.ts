// New file to hold date utility functions to avoid circular dependencies.

export function parseGameDate(dateStr: string): Date | null {
    if (!dateStr || !(dateStr.trim())) return null;

    const str = dateStr.trim();

    // Handle purely numeric strings, assuming they are a year.
    if (/^\d+$/.test(str)) {
        // Creates a date for Jan 1st of that year.
        // For two-digit years, we want to use them as-is (e.g., 82 = 82 AD, not 1982)
        const year = parseInt(str);
        // Use setFullYear to ensure two-digit years are not interpreted as 1900s
        const date = new Date();
        date.setFullYear(year, 0, 1);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    // Handle Chinese date format with optional prefix (e.g., "伊耿历82年1月22日" or "82年1月22日")
    const chineseDateMatch = str.match(/^.*?(\d+)年(\d+)月(\d+)日$/);
    if (chineseDateMatch) {
        const year = parseInt(chineseDateMatch[1]);
        const month = parseInt(chineseDateMatch[2]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(chineseDateMatch[3]);
        // For two-digit years, we want to use them as-is (e.g., 82 = 82 AD, not 1982)
        // Use setFullYear to ensure two-digit years are not interpreted as 1900s
        const date = new Date();
        date.setFullYear(year, month, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    // Handle "Moon" format dates (e.g., "14th Third Moon, 172 A.C.")
    const moonDateMatch = str.match(/^(\d+)(?:st|nd|rd|th)\s+(\w+)\s+Moon,\s+(\d+)\s*(?:A\.C\.|AC)?$/);
    if (moonDateMatch) {
        const day = parseInt(moonDateMatch[1]);
        const moonName = moonDateMatch[2].toLowerCase();
        const year = parseInt(moonDateMatch[3]);
        
        // Map moon names to month numbers
        const moonToMonth: { [key: string]: number } = {
            'first': 0,     // January
            'second': 1,    // February
            'third': 2,     // March
            'fourth': 3,    // April
            'fifth': 4,     // May
            'sixth': 5,     // June
            'seventh': 6,   // July
            'eighth': 7,    // August
            'ninth': 8,     // September
            'tenth': 9,     // October
            'eleventh': 10, // November
            'twelfth': 11   // December
        };
        
        const month = moonToMonth[moonName];
        if (month !== undefined) {
            // For two-digit years, we want to use them as-is (e.g., 73 = 73 AD, not 1973)
            // Use setFullYear to ensure two-digit years are not interpreted as 1900s
            const date = new Date();
            date.setFullYear(year, month, day);
            date.setHours(0, 0, 0, 0);
            return date;
        }
    }

    // Attempt to parse with the native constructor for standard/English formats.
    // Note: This may still interpret two-digit years as 1900s, but we've already
    // handled the specific game date formats above.
    const date = new Date(str);

    // Return the date object if it's valid, otherwise return null.
    if (!isNaN(date.getTime())) {
        return date;
    }

    console.warn(`Could not parse date string: "${str}". It will be included in the prompt by default.`);
    return null;
}

export function getDateDifference(pastDate: string, todayDate: string): string{
    // Use parseGameDate to handle both English and Chinese date formats
    const pastDateObj = parseGameDate(pastDate);
    const todayDateObj = parseGameDate(todayDate);

    // If either date can't be parsed, return a default string
    if (!pastDateObj || !todayDateObj) {
        return "unknown time ago";
    }

    // Calculate the difference in days
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((todayDateObj.getTime() - pastDateObj.getTime()) / msPerDay);

    if(totalDays > 365){
        return Math.round(totalDays/365) + " years ago"
    }
    else if(totalDays >= 30){
        return Math.round(totalDays/30) + " months ago"
    }
    else if(totalDays > 0){
        return totalDays + " days ago"
    }
    else{
        return "today"
    }
}
