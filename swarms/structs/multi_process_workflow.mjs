import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { Agent } from './agent.mjs';
import { BaseWorkflow } from './base_workflow.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('multi_process_workflow');

/**
 * MultiProcessWorkflow class for managing and executing tasks using multiple processes.
 */
export class MultiProcessWorkflow extends BaseWorkflow {
    /**
     * @param {number} maxWorkers - The maximum number of workers to use for parallel processing
     * @param {boolean} autosave - Flag indicating whether to automatically save the workflow
     * @param {Array<Agent|Function>} agents - A list of Agent objects or callable functions representing the workflow tasks
     */
    constructor({
        maxWorkers = 5,
        autosave = true,
        agents = [],
        ...args
    } = {}) {
        super(args);
        this.maxWorkers = maxWorkers || cpus().length;
        this.autosave = autosave;
        this.agents = agents;

        logger.info(`Initialized MultiProcessWorkflow with ${this.maxWorkers} max workers and autosave set to ${this.autosave}`);

        if (this.agents.length) {
            this.agents.forEach(agent => logger.info(`Agent: ${agent.agentName}`));
        }
    }

    /**
     * Execute a task and handle exceptions.
     * @param {string} task - The task to execute
     * @param {...any} args - Additional arguments for the task execution
     * @returns {Promise<any>} The result of the task execution
     */
    async executeTask(task, ...args) {
        try {
            if (this.agents.length) {
                for (const agent of this.agents) {
                    const result = await agent.run(task, ...args);
                    return result;
                }
            }
        } catch (error) {
            logger.error(`An error occurred during execution of task ${task}: ${error.message}`);
            return null;
        }
    }

    /**
     * Run the workflow.
     * @param {string} task - The task to run
     * @param {...any} args - Additional arguments for the task execution
     * @returns {Promise<Array<any>>} The results of all executed tasks
     */
    async run(task, ...args) {
        try {
            const results = [];
            const workers = [];

            for (let i = 0; i < this.maxWorkers; i++) {
                workers.push(new Promise((resolve, reject) => {
                    const worker = new Worker(__filename, {
                        workerData: { task, args }
                    });

                    worker.on('message', resolve);
                    worker.on('error', reject);
                    worker.on('exit', code => {
                        if (code !== 0) {
                            reject(new Error(`Worker stopped with exit code ${code}`));
                        }
                    });
                }));
            }

            const workerResults = await Promise.all(workers);
            results.push(...workerResults);

            return results;
        } catch (error) {
            logger.error(`Error in run: ${error.message}`);
            return null;
        }
    }

    /**
     * Asynchronously run the workflow.
     * @param {string} task - The task to run
     * @param {...any} args - Additional arguments for the task execution
     * @returns {Promise<Array<any>>} The results of all executed tasks
     */
    async asyncRun(task, ...args) {
        try {
            const results = [];
            const workers = [];

            for (let i = 0; i < this.maxWorkers; i++) {
                workers.push(new Promise((resolve, reject) => {
                    const worker = new Worker(__filename, {
                        workerData: { task, args }
                    });

                    worker.on('message', resolve);
                    worker.on('error', reject);
                    worker.on('exit', code => {
                        if (code !== 0) {
                            reject(new Error(`Worker stopped with exit code ${code}`));
                        }
                    });
                }));
            }

            const workerResults = await Promise.all(workers);
            results.push(...workerResults);

            return results;
        } catch (error) {
            logger.error(`Error in asyncRun: ${error.message}`);
            return null;
        }
    }

    /**
     * Run tasks in batches.
     * @param {Array<string>} tasks - A list of tasks to run
     * @param {number} batchSize - The size of each batch
     * @param {...any} args - Additional arguments for the task execution
     * @returns {Promise<Array<any>>} The results of all executed tasks
     */
    async batchedRun(tasks, batchSize = 5, ...args) {
        try {
            const results = [];

            for (let i = 0; i < tasks.length; i += batchSize) {
                const batch = tasks.slice(i, i + batchSize);
                const batchResults = await this.run(batch, ...args);
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            logger.error(`Error in batchedRun: ${error.message}`);
            return null;
        }
    }

    /**
     * Run tasks concurrently.
     * @param {Array<string>} tasks - A list of tasks to run
     * @param {...any} args - Additional arguments for the task execution
     * @returns {Promise<Array<any>>} The results of all executed tasks
     */
    async concurrentRun(tasks, ...args) {
        try {
            const results = [];
            const workers = tasks.map(task => new Promise((resolve, reject) => {
                const worker = new Worker(__filename, {
                    workerData: { task, args }
                });

                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            }));

            const workerResults = await Promise.all(workers);
            results.push(...workerResults);

            return results;
        } catch (error) {
            logger.error(`Error in concurrentRun: ${error.message}`);
            return null;
        }
    }
}

// Worker thread execution
if (!isMainThread) {
    const { task, args } = workerData;
    const workflow = new MultiProcessWorkflow();
    workflow.executeTask(task, ...args)
        .then(result => parentPort.postMessage(result))
        .catch(error => parentPort.postMessage({ error: error.message }));
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';
import { MultiProcessWorkflow } from './multi_process_workflow.mjs';

const runExample = async () => {
    const agent = new Agent({
        agentName: "ExampleAgent",
        description: "An example agent",
        systemPrompt: "Perform the task efficiently."
    });

    const workflow = new MultiProcessWorkflow({
        maxWorkers: 4,
        agents: [agent]
    });

    const task = "Example task";
    const results = await workflow.run(task);

    console.log("Results:", results);
};

// Only run if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    runExample().catch(console.error);
}
*/