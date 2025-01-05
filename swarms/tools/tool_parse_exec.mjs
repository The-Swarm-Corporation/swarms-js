import { parse as jsonParse, stringify as jsonStringify } from 'json5';
import { extractCodeFromMarkdown } from '../utils/parse_code.mjs';
import { initialize_logger } from '../utils/loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "tool_parse_exec" });

function parseAndExecuteJson(functions, jsonString, parseMd = false, verbose = false, returnStr = true) {
    /**
     * Parses and executes a JSON string containing function names and parameters.
     * 
     * @param {Array<Function>} functions - A list of callable functions.
     * @param {string} jsonString - The JSON string to parse and execute.
     * @param {boolean} [parseMd=false] - Flag indicating whether to extract code from Markdown.
     * @param {boolean} [verbose=false] - Flag indicating whether to enable verbose logging.
     * @param {boolean} [returnStr=true] - Flag indicating whether to return a JSON string.
     * @returns {Object|string} - A dictionary containing the results of executing the functions with the parsed parameters.
     * @throws {Error} - If functions or jsonString are not provided.
     */
    if (!functions || !jsonString) {
        throw new Error("Functions and JSON string are required");
    }

    if (parseMd) {
        jsonString = extractCodeFromMarkdown(jsonString);
    }

    try {
        // Create function name to function mapping
        const functionDict = Object.fromEntries(functions.map(func => [func.name, func]));

        if (verbose) {
            logger.info(`Available functions: ${Object.keys(functionDict)}`);
            logger.info(`Processing JSON: ${jsonString}`);
        }

        // Parse JSON data
        const data = jsonParse(jsonString);

        // Handle both single function and function list formats
        let functionList = [];
        if (data.functions) {
            functionList = data.functions;
        } else if (data.function) {
            functionList = [data.function];
        } else {
            functionList = [data]; // Assume entire object is single function
        }

        // Ensure functionList is a list and filter None values
        functionList = functionList.filter(f => f);

        if (verbose) {
            logger.info(`Processing ${functionList.length} functions`);
        }

        const results = {};
        for (const functionData of functionList) {
            const functionName = functionData.name;
            const parameters = functionData.parameters || {};

            if (!functionName) {
                logger.warning("Function data missing name field");
                continue;
            }

            if (verbose) {
                logger.info(`Executing ${functionName} with params: ${parameters}`);
            }

            if (!(functionName in functionDict)) {
                logger.warning(`Function ${functionName} not found`);
                results[functionName] = null;
                continue;
            }

            try {
                const result = functionDict[functionName](parameters);
                results[functionName] = String(result);
                if (verbose) {
                    logger.info(`Result for ${functionName}: ${result}`);
                }
            } catch (e) {
                logger.error(`Error executing ${functionName}: ${e.message}`);
                results[functionName] = `Error: ${e.message}`;
            }
        }

        // Format final results
        let dataResult;
        if (Object.keys(results).length === 1) {
            // Return single result directly
            dataResult = { result: Object.values(results)[0] };
        } else {
            // Return all results
            dataResult = {
                results,
                summary: Object.entries(results).map(([k, v]) => `${k}: ${v}`).join("\n")
            };
        }

        return returnStr ? jsonStringify(dataResult) : dataResult;

    } catch (e) {
        const error = e instanceof SyntaxError ? `Invalid JSON format: ${e.message}` : `Error parsing and executing JSON: ${e.message}`;
        logger.error(error);
        return { error };
    }
}