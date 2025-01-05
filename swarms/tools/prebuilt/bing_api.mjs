import os from 'os';
import axios from 'axios';

/**
 * Check the Bing API key from environment variables.
 * 
 * @returns {string|null} - The Bing API key or null if not found.
 * @throws {Error} - If there is an error retrieving the API key.
 */
function checkBingApiKey() {
    try {
        return process.env.BING_API_KEY;
    } catch (error) {
        console.error(`Error ${error}`);
        throw null;
    }
}

/**
 * Parses logs and merges them into a single string for input to an LLM.
 * 
 * @param {Array<Object>} logs - A list of dictionaries where each dictionary represents a log entry.
 * @returns {string} - A single string containing all log entries concatenated.
 */
function parseAndMergeLogs(logs) {
    let mergedLogs = "";
    for (const log of logs) {
        const logEntries = Object.entries(log).map(([key, value]) => `${key}: ${value}`);
        const logString = logEntries.join("\n");
        mergedLogs += logString + "\n\n";
    }
    return mergedLogs.trim();
}

/**
 * Fetches four articles from Bing Web Search API based on the given query.
 * 
 * @param {string} query - The search query to retrieve articles.
 * @returns {Array<Object>} - A list of dictionaries containing article details.
 * @throws {Error} - If there is an error fetching the articles.
 */
async function fetchWebArticlesBingApi(query = null) {
    const subscriptionKey = checkBingApiKey();

    const url = "https://api.bing.microsoft.com/v7.0/search";
    const headers = { "Ocp-Apim-Subscription-Key": subscriptionKey };
    const params = { q: query, count: 4, mkt: "en-US" };

    try {
        const response = await axios.get(url, { headers, params });
        const searchResults = response.data;

        const articles = searchResults.webPages.value.map((result, i) => ({
            query,
            url: result.url,
            title: result.name,
            publishedDate: result.dateLastCrawled,
            author: result.provider ? result.provider[0].name : "Unknown",
            id: String(i + 1) // Generating a simple unique ID
        }));

        return parseAndMergeLogs(articles);
    } catch (error) {
        console.error(`Error fetching articles: ${error}`);
        throw error;
    }
}

// Example usage:
// fetchWebArticlesBingApi("swarms ai github").then(out => console.log(out)).catch(err => console.error(err));