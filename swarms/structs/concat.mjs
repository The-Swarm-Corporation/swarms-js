/**
 * Concatenates a list of strings into a single string.
 * 
 * @param {Array<string>} stringList - A list of strings to be concatenated.
 * @returns {string} The concatenated string.
 * @throws {TypeError} If the input is not a list of strings or if any element in the list is not a string.
 */
export function concatStrings(stringList) {
    if (!Array.isArray(stringList)) {
        throw new TypeError("Input must be a list of strings.");
    }

    if (!stringList.every(string => typeof string === 'string')) {
        throw new TypeError("All elements in the list must be strings.");
    }

    try {
        return stringList.join('');
    } catch (error) {
        throw new TypeError("All elements in the list must be strings.");
    }
}

// Example usage:
// const result = concatStrings(["Hello", " ", "world", "!"]);
// console.log(result); // Output: "Hello world!"