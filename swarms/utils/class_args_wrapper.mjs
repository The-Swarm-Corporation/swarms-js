import { getSignature } from 'some-inspect-library'; // Replace with an appropriate library if needed

/**
 * Print the parameters of a class constructor.
 * 
 * @param {Function} cls - The class to inspect.
 * @param {boolean} [apiFormat=false] - Whether to return the parameters in API format.
 * @returns {Object|void} - The parameters in API format if apiFormat is true, otherwise undefined.
 * 
 * @example
 * printClassParameters(Agent);
 * // Output:
 * // Parameter: x, Type: <class 'int'>
 * // Parameter: y, Type: <class 'int'>
 */
function printClassParameters(cls, apiFormat = false) {
    try {
        // Get the parameters of the class constructor
        const sig = getSignature(cls);
        const params = sig.parameters;

        if (apiFormat) {
            const paramDict = {};
            for (const [name, param] of Object.entries(params)) {
                if (name === "self") {
                    continue;
                }
                paramDict[name] = String(param.annotation);
            }
            return paramDict;
        }

        // Print the parameters
        for (const [name, param] of Object.entries(params)) {
            if (name === "self") {
                continue;
            }
            console.log(`Parameter: ${name}, Type: ${param.annotation}`);
        }

    } catch (e) {
        console.error(`An error occurred while inspecting the class: ${e.message}`);
    }
}

// Example usage:
// class Agent {
//     constructor(x, y) {
//         this.x = x;
//         this.y = y;
//     }
// }
// printClassParameters(Agent);