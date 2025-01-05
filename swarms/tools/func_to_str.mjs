/**
 * Convert a function dictionary to a string representation.
 * 
 * @param {Object} func - The function dictionary to convert.
 * @returns {string} - The string representation of the function.
 */
function functionToStr(func) {
    let functionStr = `Function: ${func.name}\n`;
    functionStr += `Description: ${func.description}\n`;
    functionStr += "Parameters:\n";

    for (const [param, details] of Object.entries(func.parameters.properties)) {
        functionStr += `  ${param} (${details.type}): ${details.description || ''}\n`;
    }

    return functionStr;
}

/**
 * Convert a list of function dictionaries to a string representation.
 * 
 * @param {Array<Object>} funcs - The list of function dictionaries to convert.
 * @returns {string} - The string representation of the functions.
 */
function functionsToStr(funcs) {
    return funcs.map(func => functionToStr(func)).join("\n");
}

// Example usage:
// const exampleFunction = {
//     name: "exampleFunction",
//     description: "This is an example function.",
//     parameters: {
//         properties: {
//             param1: { type: "int", description: "The first parameter." },
//             param2: { type: "string", description: "The second parameter." }
//         }
//     }
// };

// const funcStr = functionToStr(exampleFunction);
// console.log(funcStr);

// const funcs = [exampleFunction, exampleFunction];
// const funcsStr = functionsToStr(funcs);
// console.log(funcsStr);