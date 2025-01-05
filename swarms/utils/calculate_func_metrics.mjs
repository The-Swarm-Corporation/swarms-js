import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { logger } from './loguru_logger.mjs';

class FunctionMetrics {
    constructor(executionTime, memoryUsage, cpuUsage, ioOperations, functionCalls) {
        this.executionTime = executionTime;
        this.memoryUsage = memoryUsage;
        this.cpuUsage = cpuUsage;
        this.ioOperations = ioOperations;
        this.functionCalls = functionCalls;
    }

    toJSON() {
        return JSON.stringify(this, null, 4);
    }
}

function profileFunc(func) {
    /**
     * Decorator function that profiles the execution of a given function.
     * 
     * @param {Function} func - The function to be profiled.
     * @returns {Function} - A wrapper function that profiles the execution of the given function and returns the result along with the metrics.
     */
    return function wrapper(...args) {
        // Record the initial time, memory usage, CPU usage, and I/O operations
        const startTime = performance.now();
        const startMem = process.memoryUsage().rss;
        const startCpu = process.cpuUsage();
        const startIo = execSync('iostat -d').toString();

        // Call the function
        const result = func(...args);

        // Record the final time, memory usage, CPU usage, and I/O operations
        const endTime = performance.now();
        const endMem = process.memoryUsage().rss;
        const endCpu = process.cpuUsage();
        const endIo = execSync('iostat -d').toString();

        // Calculate the execution time, memory usage, CPU usage, and I/O operations
        const executionTime = (endTime - startTime) / 1000; // Convert to seconds
        const memoryUsage = (endMem - startMem) / (1024 ** 2); // Convert bytes to MiB
        const cpuUsage = (endCpu.user + endCpu.system - startCpu.user - startCpu.system) / 1000; // Convert to seconds
        const ioOperations = endIo.split('\n').length - startIo.split('\n').length;

        // Return the metrics as a FunctionMetrics object
        const metrics = new FunctionMetrics(executionTime, memoryUsage, cpuUsage, ioOperations, 1);

        logger.info(`Function metrics: ${metrics.toJSON()}`);

        return [result, metrics];
    };
}

function profileAll(func) {
    /**
     * A decorator to profile memory usage, CPU usage, and I/O operations
     * of a function and log the data using loguru.
     * 
     * It combines tracemalloc for memory profiling, psutil for CPU and I/O operations,
     * and measures execution time.
     * 
     * @param {Function} func - The function to be profiled.
     * @returns {Function} - The wrapped function with profiling enabled.
     */
    return function wrapper(...args) {
        // Start memory tracking
        const startMem = process.memoryUsage().rss;

        // Get initial CPU stats
        const startCpu = process.cpuUsage();

        // Get initial I/O stats
        const startIo = execSync('iostat -d').toString();

        // Start timing the function execution
        const startTime = performance.now();

        // Execute the function
        const result = func(...args);

        // Stop timing
        const endTime = performance.now();
        const executionTime = (endTime - startTime) / 1000; // Convert to seconds

        // Get final CPU stats
        const endCpu = process.cpuUsage();

        // Get final I/O stats
        const endIo = execSync('iostat -d').toString();

        // Calculate CPU usage
        const cpuUsage = (endCpu.user + endCpu.system - startCpu.user - startCpu.system) / 1000; // Convert to seconds

        // Calculate I/O operations
        const ioOperations = endIo.split('\n').length - startIo.split('\n').length;

        // Get memory usage statistics
        const memoryUsage = (process.memoryUsage().rss - startMem) / (1024 ** 2); // Convert bytes to MiB

        // Log the data
        logger.info(`Execution time: ${executionTime.toFixed(4)} seconds`);
        logger.info(`CPU usage: ${cpuUsage.toFixed(2)} seconds`);
        logger.info(`I/O Operations: ${ioOperations}`);
        logger.info(`Memory usage: ${memoryUsage.toFixed(2)} MiB`);

        return result;
    };
}

export { profileFunc, profileAll };