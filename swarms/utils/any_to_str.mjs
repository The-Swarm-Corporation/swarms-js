/**
 * Convert any input data type to a nicely formatted string.
 * 
 * This function handles conversion of various data types into a clean string representation.
 * It recursively processes nested data structures and handles null values gracefully.
 * 
 * @param {any} data - Input data of any type to convert to string. Can be:
 *   - Object
 *   - Array
 *   - String
 *   - null
 *   - Any other type that can be converted via String()
 * @returns {string} - A formatted string representation of the input data.
 *   - Objects are formatted as "key: value" pairs separated by commas
 *   - Arrays are comma-separated
 *   - null returns "None"
 *   - Other types are converted using String()
 * 
 * @example
 * console.log(anyToStr({ a: 1, b: 2 })); // 'a: 1, b: 2'
 * console.log(anyToStr([1, 2, 3])); // '1, 2, 3'
 * console.log(anyToStr(null)); // 'None'
 */
function anyToStr(data) {
    try {
        if (typeof data === 'object' && data !== null) {
            if (Array.isArray(data)) {
                // Format arrays with brackets and proper spacing
                const items = data.map(anyToStr);
                return `[${items.join(', ')}]`;
            } else {
                // Format objects with newlines and indentation
                const items = Object.entries(data).map(([k, v]) => `${k}: ${anyToStr(v)}`);
                return items.join('\n');
            }
        } else if (data === null) {
            return "None";
        } else {
            // Handle strings and other types
            return typeof data === 'string' ? `"${data}"` : String(data);
        }
    } catch (e) {
        return `Error converting data: ${e.message}`;
    }
}

// Example usage:
// console.log("Dictionary:");
// console.log(anyToStr({ name: "John", age: 30, hobbies: ["reading", "hiking"] }));

// console.log("\nNested Dictionary:");
// console.log(anyToStr({ user: { id: 123, details: { city: "New York", active: true } }, data: [1, 2, 3] }));

// console.log("\nList and Tuple:");
// console.log(anyToStr([1, "text", null, [1, 2]]));
// console.log(anyToStr([true, false, null]));

// console.log("\nEmpty Collections:");
// console.log(anyToStr([]));
// console.log(anyToStr({}));