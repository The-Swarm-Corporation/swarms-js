import { parse as jsonParse } from 'json5';
import { getDoc, getSignature } from 'some-inspect-library'; // Replace with an appropriate library if needed
import { formatter } from '../utils/formatter.mjs';

function scrapeToolFuncDocs(fn) {
    /**
     * Scrape the docstrings and parameters of a function decorated with `tool` and return a formatted string.
     * 
     * @param {Function} fn - The function to scrape.
     * @returns {string} - A string containing the function's name, documentation string, and a list of its parameters. Each parameter is represented as a line containing the parameter's name, default value, and annotation.
     */
    try {
        // If the function is a tool, get the original function
        if (fn.func) {
            fn = fn.func;
        }

        const signature = getSignature(fn);
        const parameters = [];
        for (const [name, param] of Object.entries(signature.parameters)) {
            parameters.push(
                `Name: ${name}, Type: ${param.default !== undefined ? param.default : 'None'}, Annotation: ${param.annotation !== undefined ? param.annotation : 'None'}`
            );
        }
        const parametersStr = parameters.join("\n");
        return `Function: ${fn.name}\nDocstring: ${getDoc(fn)}\nParameters:\n${parametersStr}`;
    } catch (error) {
        formatter.printPanel(`Error scraping tool function docs ${error} try optimizing your inputs with different variables and attempt once more.`);
        throw error;
    }
}

function toolFindByName(toolName, tools) {
    /**
     * Find the tool by name.
     * 
     * @param {string} toolName - The name of the tool to find.
     * @param {Array} tools - The list of tools.
     * @returns {Object|null} - The found tool or null if not found.
     */
    return tools.find(tool => tool.name === toolName) || null;
}

function isStrValidFuncOutput(output = null, functionMap = null) {
    /**
     * Check if the output is a valid JSON string, and if the function name in the JSON matches any name in the function map.
     * 
     * @param {string} output - The output to check.
     * @param {Object} functionMap - A dictionary mapping function names to functions.
     * @returns {boolean} - True if the output is valid and the function name matches, False otherwise.
     */
    try {
        // Parse the output as JSON
        const data = jsonParse(output);

        // Check if the output matches the schema
        if (data.type === "function" && data.function && data.function.name) {
            // Check if the function name matches any name in the function map
            const functionName = data.function.name;
            if (functionName in functionMap) {
                return true;
            }
        }
    } catch (e) {
        // Ignore JSON parse errors
    }

    return false;
}