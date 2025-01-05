/**
 * Extracts all code blocks from Markdown text along with their languages.
 * 
 * @param {string} markdownText - The input Markdown text.
 * @returns {Array<Object>} - A list of objects, each containing:
 *   - 'language': The detected language (or 'plaintext' if none specified).
 *   - 'content': The content of the code block.
 */
function extractCodeBlocksWithLanguage(markdownText) {
    const pattern = /```(\w+)?\n(.*?)```/gs;
    const matches = [...markdownText.matchAll(pattern)];

    return matches.map(match => ({
        language: match[1] ? match[1].trim() : "plaintext",
        content: match[2].trim()
    }));
}

/**
 * Extracts content of code blocks for a specific language or all blocks if no language specified.
 * 
 * @param {string} markdownText - The input Markdown text.
 * @param {string} [language=null] - The language to filter by (e.g., 'yaml', 'python').
 * @returns {string} - The concatenated content of matched code blocks or an empty string if none found.
 */
function extractCodeFromMarkdown(markdownText, language = null) {
    const codeBlocks = extractCodeBlocksWithLanguage(markdownText);

    const filteredBlocks = language
        ? codeBlocks.filter(block => block.language === language).map(block => block.content)
        : codeBlocks.map(block => block.content);

    return filteredBlocks.length ? filteredBlocks.join("\n\n") : "";
}

export { extractCodeBlocksWithLanguage, extractCodeFromMarkdown };