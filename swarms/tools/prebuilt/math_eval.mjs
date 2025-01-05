import { wrap } from 'lodash';
import { logger } from 'loguru';

/**
 * Math evaluation decorator.
 * 
 * @param {Function} func1 - The first function to evaluate.
 * @param {Function} func2 - The second function to evaluate.
 * @returns {Function} - The decorator function.
 * 
 * @example
 * const groundTruth = (x) => x * 2;
 * const generatedFunc = (x) => x - 10;
 * 
 * const testFunc = mathEval(groundTruth, generatedFunc)((x) => x);
 * const [result1, result2] = testFunc(5);
 * console.log(`Result from groundTruth: ${result1}`);
 * console.log(`Result from generatedFunc: ${result2}`);
 */
function mathEval(func1, func2) {
    return function decorator(func) {
        return wrap(func, function (originalFunc, ...args) {
            let result1, result2;
            try {
                result1 = func1(...args);
            } catch (e) {
                logger.error(`Error in func1: ${e.message}`);
                result1 = null;
            }

            try {
                result2 = func2(...args);
            } catch (e) {
                logger.error(`Error in func2: ${e.message}`);
                result2 = null;
            }

            if (result1 !== result2) {
                logger.warning(`Outputs do not match: ${result1} !== ${result2}`);
            }

            return [result1, result2];
        });
    };
}

// Example usage:
// const groundTruth = (x) => x * 2;
// const generatedFunc = (x) => x - 10;

// const testFunc = mathEval(groundTruth, generatedFunc)((x) => x);
// const [result1, result2] = testFunc(5);
// console.log(`Result from groundTruth: ${result1}`);
// console.log(`Result from generatedFunc: ${result2}`);