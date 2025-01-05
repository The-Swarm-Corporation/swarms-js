import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { Agent } from './agent.mjs';
import { ConcurrentWorkflow } from './concurrent_workflow.mjs';
import { MixtureOfAgents } from './mixture_of_agents.mjs';
import { AgentRearrange } from './rearrange.mjs';
import { SequentialWorkflow } from './sequential_workflow.mjs';
import { SpreadSheetSwarm } from './spreadsheet_swarm.mjs';
import { swarmMatcher } from './swarm_matcher.mjs';
import { execCallableWithClusterOps } from '../utils/clusterops.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarm_router');

/**
 * Swarm types
 * @typedef {'AgentRearrange' | 'MixtureOfAgents' | 'SpreadSheetSwarm' | 'SequentialWorkflow' | 'ConcurrentWorkflow' | 'auto'} SwarmType
 */

/**
 * Document model
 */
class Document {
    constructor({ filePath, data }) {
        this.filePath = filePath;
        this.data = data;
    }
}

/**
 * Swarm log model
 */
class SwarmLog {
    constructor({ level, message, swarmType, task = "", metadata = {}, documents = [] }) {
        this.id = uuidv4();
        this.timestamp = DateTime.utc().toISO();
        this.level = level;
        this.message = message;
        this.swarmType = swarmType;
        this.task = task;
        this.metadata = metadata;
        this.documents = documents.map(doc => new Document(doc));
    }
}

/**
 * SwarmRouter class for dynamically routing tasks to different swarm types
 */
export class SwarmRouter {
    /**
     * @param {Object} params - SwarmRouter parameters
     * @param {string} [params.name="swarm-router"] - Name of the SwarmRouter instance
     * @param {string} [params.description="Routes your task to the desired swarm"] - Description of the SwarmRouter's purpose
     * @param {number} [params.maxLoops=1] - Maximum number of execution loops
     * @param {Array<Agent|Function>} [params.agents=[]] - List of Agent objects or callables
     * @param {SwarmType} [params.swarmType="SequentialWorkflow"] - Type of swarm to use
     * @param {boolean} [params.autosave=false] - Whether to enable autosaving
     * @param {string} [params.rearrangeFlow=null] - Flow configuration string
     * @param {boolean} [params.returnJson=false] - Whether to return results as JSON
     * @param {boolean} [params.autoGeneratePrompts=false] - Whether to auto-generate agent prompts
     * @param {any} [params.sharedMemorySystem=null] - Shared memory system for agents
     * @param {string} [params.rules=null] - Rules to inject into every agent
     * @param {Array<string>} [params.documents=[]] - List of document file paths
     * @param {string} [params.outputType="string"] - Output format type
     * @param {boolean} [params.noClusterOps=false] - Whether to disable cluster operations
     */
    constructor({
        name = "swarm-router",
        description = "Routes your task to the desired swarm",
        maxLoops = 1,
        agents = [],
        swarmType = "SequentialWorkflow",
        autosave = false,
        rearrangeFlow = null,
        returnJson = false,
        autoGeneratePrompts = false,
        sharedMemorySystem = null,
        rules = null,
        documents = [],
        outputType = "string",
        noClusterOps = false,
        ...args
    } = {}) {
        this.name = name;
        this.description = description;
        this.maxLoops = maxLoops;
        this.agents = agents;
        this.swarmType = swarmType;
        this.autosave = autosave;
        this.rearrangeFlow = rearrangeFlow;
        this.returnJson = returnJson;
        this.autoGeneratePrompts = autoGeneratePrompts;
        this.sharedMemorySystem = sharedMemorySystem;
        this.rules = rules;
        this.documents = documents;
        this.outputType = outputType;
        this.noClusterOps = noClusterOps;
        this.logs = [];

        this.reliabilityCheck();
        this.activateAPE();
        if (this.sharedMemorySystem) this.activateSharedMemory();
        if (this.rules) this.handleRules();
    }

    deactivateClusterOps() {
        this.agents.forEach(agent => agent.doNotUseClusterOps = true);
    }

    activateSharedMemory() {
        logger.info("Activating shared memory with all agents");
        this.agents.forEach(agent => agent.longTermMemory = this.sharedMemorySystem);
        logger.info("All agents now have the same memory system");
    }

    handleRules() {
        logger.info("Injecting rules to every agent!");
        this.agents.forEach(agent => agent.systemPrompt += `### Swarm Rules ### ${this.rules}`);
        logger.info("Finished injecting rules");
    }

    activateAPE() {
        try {
            logger.info("Activating automatic prompt engineering...");
            let activatedCount = 0;
            this.agents.forEach(agent => {
                if (agent.autoGeneratePrompt !== undefined) {
                    agent.autoGeneratePrompt = this.autoGeneratePrompts;
                    activatedCount++;
                    logger.debug(`Activated APE for agent: ${agent.name || 'unnamed'}`);
                }
            });
            logger.info(`Successfully activated APE for ${activatedCount} agents`);
            this._log("info", `Activated automatic prompt engineering for ${activatedCount} agents`);
        } catch (error) {
            const errorMsg = `Error activating automatic prompt engineering: ${error.message}`;
            logger.error(errorMsg);
            this._log("error", errorMsg);
            throw new Error(errorMsg);
        }
    }

    reliabilityCheck() {
        logger.info("Initializing reliability checks");
        if (!this.agents.length) throw new Error("No agents provided for the swarm.");
        if (!this.swarmType) throw new Error("Swarm type cannot be 'none'.");
        if (!this.maxLoops) throw new Error("max_loops cannot be 0.");
        logger.info("Reliability checks completed. Your swarm is ready.");
    }

    _createSwarm(task = null, ...args) {
        if (this.swarmType === "auto") {
            this.swarmType = swarmMatcher(task);
            return this._createSwarm(this.swarmType);
        }

        if (this.noClusterOps) this.deactivateClusterOps();

        switch (this.swarmType) {
            case "AgentRearrange":
                return new AgentRearrange({
                    name: this.name,
                    description: this.description,
                    agents: this.agents,
                    maxLoops: this.maxLoops,
                    flow: this.rearrangeFlow,
                    returnJson: this.returnJson,
                    outputType: this.outputType,
                    ...args
                });
            case "MixtureOfAgents":
                return new MixtureOfAgents({
                    name: this.name,
                    description: this.description,
                    agents: this.agents,
                    aggregatorSystemPrompt: aggregatorSystemPrompt.getPrompt(),
                    aggregatorAgent: this.agents[this.agents.length - 1],
                    layers: this.maxLoops,
                    ...args
                });
            case "SpreadSheetSwarm":
                return new SpreadSheetSwarm({
                    name: this.name,
                    description: this.description,
                    agents: this.agents,
                    maxLoops: this.maxLoops,
                    autosaveOn: this.autosave,
                    ...args
                });
            case "SequentialWorkflow":
                return new SequentialWorkflow({
                    name: this.name,
                    description: this.description,
                    agents: this.agents,
                    maxLoops: this.maxLoops,
                    sharedMemorySystem: this.sharedMemorySystem,
                    outputType: this.outputType,
                    returnJson: this.returnJson,
                    ...args
                });
            case "ConcurrentWorkflow":
                return new ConcurrentWorkflow({
                    name: this.name,
                    description: this.description,
                    agents: this.agents,
                    maxLoops: this.maxLoops,
                    autoSave: this.autosave,
                    returnStrOn: this.returnJson,
                    ...args
                });
            default:
                throw new Error(`Invalid swarm type: ${this.swarmType}. Try again with a valid swarm type such as 'SequentialWorkflow', 'ConcurrentWorkflow', 'auto', 'AgentRearrange', 'MixtureOfAgents', or 'SpreadSheetSwarm'.`);
        }
    }

    _log(level, message, task = "", metadata = {}) {
        const logEntry = new SwarmLog({
            level,
            message,
            swarmType: this.swarmType,
            task,
            metadata
        });
        this.logs.push(logEntry);
        logger.log(level.toUpperCase(), message);
    }

    _run(task, img, ...args) {
        this.swarm = this._createSwarm(task, ...args);
        try {
            this._log("info", `Running task on ${this.swarmType} swarm with task: ${task}`);
            const result = this.swarm.run(task, ...args);
            this._log("success", `Task completed successfully on ${this.swarmType} swarm`, task, { result: String(result) });
            return result;
        } catch (error) {
            this._log("error", `Error occurred while running task on ${this.swarmType} swarm: ${error.message}`, task, { error: error.message });
            throw error;
        }
    }

    run(task, img = null, device = "cpu", allCores = true, allGpus = false, noClusterOps = true, ...args) {
        try {
            if (noClusterOps) {
                return this._run(task, img, ...args);
            } else {
                return execCallableWithClusterOps(this._run.bind(this), { task, img, device, allCores, allGpus, ...args });
            }
        } catch (error) {
            logger.error(`Error executing task on swarm: ${error.message}`);
            throw error;
        }
    }

    batchRun(tasks, ...args) {
        return tasks.map(task => this.run(task, ...args));
    }

    threadedRun(task, ...args) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            return new Promise((resolve, reject) => {
                const worker = new Worker(__filename, { workerData: { task, args } });
                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        } else {
            const result = this.run(task, ...args);
            parentPort.postMessage(result);
        }
    }

    asyncRun(task, ...args) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            return new Promise((resolve, reject) => {
                const worker = new Worker(__filename, { workerData: { task, args } });
                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        } else {
            const result = this.run(task, ...args);
            parentPort.postMessage(result);
        }
    }

    getLogs() {
        return this.logs;
    }

    concurrentRun(task, ...args) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            return new Promise((resolve, reject) => {
                const worker = new Worker(__filename, { workerData: { task, args } });
                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            });
        } else {
            const result = this.run(task, ...args);
            parentPort.postMessage(result);
        }
    }

    concurrentBatchRun(tasks, ...args) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            return Promise.all(tasks.map(task => new Promise((resolve, reject) => {
                const worker = new Worker(__filename, { workerData: { task, args } });
                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', code => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            })));
        } else {
            const result = this.run(task, ...args);
            parentPort.postMessage(result);
        }
    }
}

/**
 * Create and run a SwarmRouter instance with the given configuration.
 */
export function swarmRouter({
    name = "swarm-router",
    description = "Routes your task to the desired swarm",
    maxLoops = 1,
    agents = [],
    swarmType = "SequentialWorkflow",
    autosave = false,
    flow = null,
    returnJson = true,
    autoGeneratePrompts = false,
    task = null,
    rules = null,
    ...args
} = {}) {
    try {
        logger.info(`Creating SwarmRouter with name: ${name}, swarmType: ${swarmType}`);
        if (!agents.length) logger.warning("No agents provided, router may have limited functionality");
        if (!task) logger.warning("No task provided");

        const router = new SwarmRouter({
            name,
            description,
            maxLoops,
            agents,
            swarmType,
            autosave,
            flow,
            returnJson,
            autoGeneratePrompts,
            rules,
            ...args
        });

        logger.info(`Executing task with SwarmRouter: ${task}`);
        const result = router.run(task, ...args);
        logger.info(`Task execution completed successfully: ${result}`);
        return result;
    } catch (error) {
        logger.error(`Error in swarmRouter execution: ${error.message}`);
        throw error;
    }
}