import { createLogger, transports, format } from 'winston';

const logger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'try_except_wrapper.log' })
    ]
});

/**
 * A decorator that retries a function a specified number of times if an exception occurs.
 * 
 * @param {number} [maxRetries=3] - The maximum number of retries.
 * @returns {Function} - The decorator function.
 */
function retry(maxRetries = 3) {
    return function decoratorRetry(func) {
        return async function wrapperRetry(...args) {
            for (let i = 0; i < maxRetries; i++) {
                try {
                    return await func(...args);
                } catch (e) {
                    logger.error(`Error: ${e.message}, retrying...`);
                }
            }
            return await func(...args);
        };
    };
}

/**
 * A decorator that logs the execution time of a function.
 * 
 * @param {Function} func - The function to be decorated.
 * @returns {Function} - The decorated function.
 */
function logExecutionTime(func) {
    return async function wrapper(...args) {
        const start = Date.now();
        const result = await func(...args);
        const end = Date.now();
        logger.info(`Execution time for ${func.name}: ${(end - start) / 1000} seconds`);
        return result;
    };
}

/**
 * A decorator that wraps a function with a try-except block.
 * It catches any exception that occurs during the execution of the function,
 * prints an error message, and returns null.
 * It also prints a message indicating the exit of the function.
 * 
 * @param {boolean} [verbose=false] - Whether to print verbose error messages.
 * @returns {Function} - The decorator function.
 * 
 * @example
 * const divide = tryExceptWrapper(true)(async (a, b) => a / b);
 * divide(1, 0).then(result => console.log(result)); // Logs error and returns null
 */
function tryExceptWrapper(verbose = false) {
    return function decorator(func) {
        return retry()(logExecutionTime(async function wrapper(...args) {
            try {
                return await func(...args);
            } catch (e) {
                if (verbose) {
                    logger.error(`An error occurred in function ${func.name}: ${e.message}`);
                } else {
                    logger.error(`An error occurred in function ${func.name}: ${e.message}`);
                }
                return null;
            } finally {
                console.log(`Exiting function: ${func.name}`);
            }
        }));
    };
}

// Example usage:
// const divide = tryExceptWrapper(true)(async (a, b) => a / b);
// divide(1, 0).then(result => console.log(result)); // Logs error and returns null

export { tryExceptWrapper };