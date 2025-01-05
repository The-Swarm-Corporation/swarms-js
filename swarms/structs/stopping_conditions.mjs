/**
 * Check if the string contains "<DONE>"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "<DONE>", otherwise false
 */
export function checkDone(s) {
    return s.includes("<DONE>");
}

/**
 * Check if the string contains "finished"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "finished", otherwise false
 */
export function checkFinished(s) {
    return s.includes("finished");
}

/**
 * Check if the string contains "complete"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "complete", otherwise false
 */
export function checkComplete(s) {
    return s.includes("complete");
}

/**
 * Check if the string contains "success"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "success", otherwise false
 */
export function checkSuccess(s) {
    return s.includes("success");
}

/**
 * Check if the string contains "failure"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "failure", otherwise false
 */
export function checkFailure(s) {
    return s.includes("failure");
}

/**
 * Check if the string contains "error"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "error", otherwise false
 */
export function checkError(s) {
    return s.includes("error");
}

/**
 * Check if the string contains "stopped"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "stopped", otherwise false
 */
export function checkStopped(s) {
    return s.includes("stopped");
}

/**
 * Check if the string contains "cancelled"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "cancelled", otherwise false
 */
export function checkCancelled(s) {
    return s.includes("cancelled");
}

/**
 * Check if the string contains "exit"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "exit", otherwise false
 */
export function checkExit(s) {
    return s.includes("exit");
}

/**
 * Check if the string contains "end"
 * @param {string} s - The string to check
 * @returns {boolean} True if the string contains "end", otherwise false
 */
export function checkEnd(s) {
    return s.includes("end");
}

// Example usage (commented out):
/*
// Example usage:
const result = checkDone("The task is <DONE>");
console.log(result); // true
*/