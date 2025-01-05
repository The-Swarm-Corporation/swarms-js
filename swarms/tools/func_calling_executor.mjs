import { ThreadPoolExecutor } from 'some-concurrent-library'; // Replace with an appropriate library if needed
import { initialize_logger } from '../utils/loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "func_calling_executor" });

// function openai_tool_executor(
//     tools,
//     function_map,
//     verbose = true,
//     return_as_string = false,
//     ...args
// ) {
//     /**
//      * Creates a function that dynamically and concurrently executes multiple functions based on parameters specified
//      * in a list of tool dictionaries, with extensive error handling and validation.
//      *
//      * @param {Array} tools - A list of dictionaries, each containing configuration for a tool, including parameters.
//      * @param {Object} function_map - A dictionary mapping function names to their corresponding callable functions.
//      * @param {boolean} verbose - If true, enables verbose logging.
//      * @param {boolean} return_as_string - If true, returns the results as a concatenated string.
//      * @returns {Function} - A function that, when called, executes the specified functions concurrently with the parameters given.
//      *
//      * @example
//      * function test_function(param1, param2) {
//      *     return `Test function called with parameters: ${param1}, ${param2}`;
//      * }
//      *
//      * const tool_executor = openai_tool_executor(
//      *     tools=[
//      *         {
//      *             type: "function",
//      *             function: {
//      *                 name: "test_function",
//      *                 parameters: {
//      *                     param1: 1,
//      *                     param2: "example"
//      *                 }
//      *             }
//      *         }
//      *     ],
//      *     function_map={
//      *         "test_function": test_function
//      *     },
//      *     return_as_string=true
//      * );
//      * const results = tool_executor();
//      * console.log(results);
//      */
//     function tool_executor() {
//         const results = [];
//         logger.info(`Executing ${tools.length} tools concurrently.`);
//         const executor = new ThreadPoolExecutor();
//         const futures = [];
//         for (const tool of tools) {
//             if (tool.type !== "function") {
//                 continue; // Skip non-function tool entries
//             }
//             const function_info = tool.function || {};
//             const func_name = function_info.name;
//             logger.info(`Executing function: ${func_name}`);
//             if (!(func_name in function_map)) {
//                 const error_message = `Function '${func_name}' not found in function map.`;
//                 logger.error(error_message);
//                 results.push(error_message);
//                 continue;
//             }
//             const params = function_info.parameters || {};
//             if (!params) {
//                 const error_message = `No parameters specified for function '${func_name}'.`;
//                 logger.error(error_message);
//                 results.push(error_message);
//                 continue;
//             }
//             try {
//                 const future = executor.submit(
//                     function_map[func_name], params
//                 );
//                 futures.push([func_name, future]);
//             } catch (e) {
//                 const error_message = `Failed to submit the function '${func_name}' for execution: ${e}`;
//                 logger.error(error_message);
//                 results.push(error_message);
//             }
//         }
//         for (const [func_name, future] of futures) {
//             try {
//                 const result = future.result();
//                 results.push(`${func_name}: ${result}`);
//             } catch (e) {
//                 const error_message = `Error during execution of function '${func_name}': ${e}`;
//                 logger.error(error_message);
//                 results.push(error_message);
//             }
//         }
//         if (return_as_string) {
//             return results.join("\n");
//         }
//         logger.info(`Results: ${results}`);
//         return results;
//     }
//     return tool_executor;
// }

function openai_tool_executor(
    tools,
    function_map,
    verbose = true,
    return_as_string = false,
    ...args
) {
    function tool_executor() {
        const results = [];
        logger.info(`Executing ${tools.length} tools concurrently.`);
        const executor = new ThreadPoolExecutor();
        const futures = [];
        for (const tool of tools) {
            if (tool.type !== "function") {
                continue;
            }
            const function_info = tool.function || {};
            const func_name = function_info.name;
            logger.info(`Executing function: ${func_name}`);
            if (!(func_name in function_map)) {
                const error_message = `Function '${func_name}' not found in function map.`;
                logger.error(error_message);
                results.push(error_message);
                continue;
            }
            const params = function_info.parameters || {};
            if (!params) {
                const error_message = `No parameters specified for function '${func_name}'.`;
                logger.error(error_message);
                results.push(error_message);
                continue;
            }
            if ("name" in params && params.name in function_map) {
                try {
                    const result = function_map[params.name](params);
                    results.push(`${params.name}: ${result}`);
                } catch (e) {
                    const error_message = `Failed to execute the function '${params.name}': ${e}`;
                    logger.error(error_message);
                    results.push(error_message);
                }
                continue;
            }
            try {
                const future = executor.submit(
                    function_map[func_name], params
                );
                futures.push([func_name, future]);
            } catch (e) {
                const error_message = `Failed to submit the function '${func_name}' for execution: ${e}`;
                logger.error(error_message);
                results.push(error_message);
            }
        }
        for (const [func_name, future] of futures) {
            try {
                const result = future.result();
                results.push(`${func_name}: ${result}`);
            } catch (e) {
                const error_message = `Error during execution of function '${func_name}': ${e}`;
                logger.error(error_message);
                results.push(error_message);
            }
        }
        if (return_as_string) {
            return results.join("\n");
        }
        logger.info(`Results: ${results}`);
        return results;
    }
    return tool_executor;
}

// function_schema = {
//     "name": "execute",
//     "description": "Executes code on the user's machine **in the users local environment** and returns the output",
//     "parameters": {
//         "type": "object",
//         "properties": {
//             "language": {
//                 "type": "string",
//                 "description": "The programming language (required parameter to the `execute` function)",
//                 "enum": [
//                     // This will be filled dynamically with the languages OI has access to.
//                 ],
//             },
//             "code": {
//                 "type": "string",
//                 "description": "The code to execute (required)",
//             },
//         },
//         "required": ["language", "code"],
//     },
// }

// function execute(language, code) {
//     /**
//      * Executes code on the user's machine **in the users local environment** and returns the output
//      *
//      * @param {string} language - The programming language (required parameter to the `execute` function)
//      * @param {string} code - The code to execute (required)
//      * @returns {string} - The output of the code execution
//      */
//     // This function will be implemented by the user
//     return "Code execution not implemented yet";
// }

// // Example execution
// const out = openai_tool_executor(
//     tools=[function_schema],
//     function_map={
//         "execute": execute,
//     },
//     return_as_string=true,
// );
// console.log(out);