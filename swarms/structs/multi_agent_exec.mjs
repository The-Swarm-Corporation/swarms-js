import { Agent } from './agent.mjs';
import { execCallableWithClusterOps } from '../utils/clusterops.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('multi_agent_exec');

/**
 * Run a single agent synchronously
 */
function runSingleAgent(agent, task) {
    return agent.run(task);
}

/**
 * Run an agent asynchronously using a thread executor.
 */
async function runAgentAsync(agent, task, executor) {
    return new Promise((resolve, reject) => {
        executor.submit(() => {
            try {
                const result = runSingleAgent(agent, task);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * Run multiple agents concurrently using asyncio and thread executor.
 */
async function runAgentsConcurrentlyAsync(agents, task, executor) {
    const promises = agents.map(agent => runAgentAsync(agent, task, executor));
    return Promise.all(promises);
}

/**
 * Optimized concurrent agent runner using both uvloop and ThreadPoolExecutor.
 */
function runAgentsConcurrently(agents, task, batchSize = null, maxWorkers = null) {
    const cpuCores = require('os').cpus().length;
    batchSize = batchSize || cpuCores;
    maxWorkers = maxWorkers || cpuCores * 2;

    const results = [];
    const executor = new (require('worker_threads').Worker)({ maxWorkers });

    for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);
        const batchResults = runAgentsConcurrentlyAsync(batch, task, executor);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Manage and run multiple agents concurrently in batches, with optimized performance.
 */
function runAgentsConcurrentlyMultiprocess(agents, task, batchSize = require('os').cpus().length) {
    const results = [];
    const executor = new (require('worker_threads').Worker)({ maxWorkers: batchSize });

    for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);
        const batchResults = runAgentsConcurrentlyAsync(batch, task, executor);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Run multiple agents sequentially for baseline comparison.
 */
function runAgentsSequentially(agents, task) {
    return agents.map(agent => runSingleAgent(agent, task));
}

/**
 * Run multiple agents with different tasks concurrently.
 */
function runAgentsWithDifferentTasks(agentTaskPairs, batchSize = null, maxWorkers = null) {
    const cpuCores = require('os').cpus().length;
    batchSize = batchSize || cpuCores;
    maxWorkers = maxWorkers || cpuCores * 2;

    const results = [];
    const executor = new (require('worker_threads').Worker)({ maxWorkers });

    for (let i = 0; i < agentTaskPairs.length; i += batchSize) {
        const batch = agentTaskPairs.slice(i, i + batchSize);
        const batchResults = runAgentsConcurrentlyAsync(batch.map(([agent, task]) => runAgentAsync(agent, task, executor)));
        results.push(...batchResults);
    }

    return results;
}

/**
 * Run an agent with a timeout limit.
 */
async function runAgentWithTimeout(agent, task, timeout, executor) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), timeout * 1000);
        executor.submit(() => {
            try {
                const result = runSingleAgent(agent, task);
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    });
}

/**
 * Run multiple agents concurrently with a timeout for each agent.
 */
function runAgentsWithTimeout(agents, task, timeout, batchSize = null, maxWorkers = null) {
    const cpuCores = require('os').cpus().length;
    batchSize = batchSize || cpuCores;
    maxWorkers = maxWorkers || cpuCores * 2;

    const results = [];
    const executor = new (require('worker_threads').Worker)({ maxWorkers });

    for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);
        const batchResults = runAgentsConcurrentlyAsync(batch.map(agent => runAgentWithTimeout(agent, task, timeout, executor)));
        results.push(...batchResults);
    }

    return results;
}

/**
 * Run multiple agents with corresponding tasks concurrently.
 */
function runAgentsWithTasksConcurrently(agents, tasks = [], batchSize = null, maxWorkers = null, device = "cpu", deviceId = 1, allCores = true, noClusterOps = false) {
    if (agents.length !== tasks.length) {
        throw new Error("The number of agents must match the number of tasks.");
    }

    if (noClusterOps) {
        return runAgentsWithDifferentTasks(agents.map((agent, i) => [agent, tasks[i]]), batchSize, maxWorkers);
    } else {
        return execCallableWithClusterOps(device, deviceId, allCores, runAgentsWithDifferentTasks, agents.map((agent, i) => [agent, tasks[i]]), batchSize, maxWorkers);
    }
}

// Example usage (commented out):
/*
const agents = [
    new Agent({
        agentName: "Financial-Analysis-Agent1",
        systemPrompt: "Analyze financial data",
        llm: model,
        maxLoops: 1,
        autosave: true,
        dashboard: false,
        verbose: false,
        dynamicTemperatureEnabled: false,
        savedStatePath: "finance_agent_1.json",
        userName: "swarms_corp",
        retryAttempts: 1,
        contextLength: 200000,
        returnStepMeta: false
    }),
    new Agent({
        agentName: "Financial-Analysis-Agent2",
        systemPrompt: "Analyze financial data",
        llm: model,
        maxLoops: 1,
        autosave: true,
        dashboard: false,
        verbose: false,
        dynamicTemperatureEnabled: false,
        savedStatePath: "finance_agent_2.json",
        userName: "swarms_corp",
        retryAttempts: 1,
        contextLength: 200000,
        returnStepMeta: false
    })
];

const task = "How can I establish a ROTH IRA to buy stocks and get a tax break? What are the criteria";
const outputs = runAgentsConcurrently(agents, task);

outputs.forEach((output, i) => {
    console.log(`Output from agent ${i + 1}:\n${output}`);
});
*/