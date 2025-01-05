import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { createFileInFolder } from '../utils/file_processing.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { executeOnGpu, executeWithCpuCores, executeOnMultipleGpus, listAvailableGpus } from '../utils/clusterops.mjs';

const logger = initializeLogger('concurrent_workflow');

/**
 * Agent output schema for structured data
 */
class AgentOutputSchema {
    constructor({
        runId,
        agentName,
        task,
        output,
        startTime,
        endTime,
        duration
    }) {
        this.runId = runId;
        this.agentName = agentName;
        this.task = task;
        this.output = output;
        this.startTime = startTime;
        this.endTime = endTime;
        this.duration = duration;
    }
}

/**
 * Metadata schema for structured data
 */
class MetadataSchema {
    constructor({
        swarmId = uuidv4(),
        task,
        description = "Concurrent execution of multiple agents",
        agents,
        timestamp = new Date()
    }) {
        this.swarmId = swarmId;
        this.task = task;
        this.description = description;
        this.agents = agents;
        this.timestamp = timestamp;
    }
}

/**
 * Represents a concurrent workflow that executes multiple agents concurrently in a production-grade manner.
 */
export class ConcurrentWorkflow extends BaseSwarm {
    /**
     * @param {string} name - The name of the workflow
     * @param {string} description - The description of the workflow
     * @param {Array<Agent>} agents - The list of agents to be executed concurrently
     * @param {string} metadataOutputPath - The path to save the metadata output
     * @param {boolean} autoSave - Flag indicating whether to automatically save the metadata
     * @param {MetadataSchema} outputSchema - The output schema for the metadata
     * @param {number} maxLoops - The maximum number of loops for each agent
     * @param {boolean} returnStrOn - Flag indicating whether to return the output as a string
     * @param {Array} agentResponses - The list of agent responses
     * @param {boolean} autoGeneratePrompts - Flag indicating whether to auto-generate prompts for agents
     * @param {number} maxWorkers - Maximum number of concurrent workers
     */
    constructor({
        name = "ConcurrentWorkflow",
        description = "Execution of multiple agents concurrently",
        agents = [],
        metadataOutputPath = "agent_metadata.json",
        autoSave = true,
        outputSchema = MetadataSchema,
        maxLoops = 1,
        returnStrOn = false,
        agentResponses = [],
        autoGeneratePrompts = false,
        maxWorkers = null,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.metadataOutputPath = metadataOutputPath;
        this.autoSave = autoSave;
        this.outputSchema = outputSchema;
        this.maxLoops = maxLoops;
        this.returnStrOn = returnStrOn;
        this.agentResponses = agentResponses;
        this.autoGeneratePrompts = autoGeneratePrompts;
        this.maxWorkers = maxWorkers || require('os').cpus().length;
        this.tasks = [];

        this.reliabilityCheck();
    }

    reliabilityCheck() {
        try {
            logger.info("Starting reliability checks");

            if (!this.name) {
                logger.error("A name is required for the swarm");
                throw new Error("A name is required for the swarm");
            }

            if (!this.agents.length) {
                logger.error("The list of agents must not be empty.");
                throw new Error("The list of agents must not be empty.");
            }

            if (!this.description) {
                logger.error("A description is required.");
                throw new Error("A description is required.");
            }

            logger.info("Reliability checks completed successfully");
        } catch (error) {
            logger.error(`Reliability check failed: ${error.message}`);
            throw error;
        }
    }

    activateAutoPromptEngineering() {
        if (this.autoGeneratePrompts) {
            this.agents.forEach(agent => {
                agent.autoGeneratePrompt = true;
            });
        }
    }

    async _runAgent(agent, task, img, executor, ...args) {
        const startTime = new Date();
        try {
            const output = await executor(agent.run.bind(agent), task, img, ...args);
            const endTime = new Date();
            const duration = (endTime - startTime) / 1000;

            return new AgentOutputSchema({
                runId: uuidv4(),
                agentName: agent.agentName,
                task,
                output,
                startTime,
                endTime,
                duration
            });
        } catch (error) {
            logger.error(`Error running agent ${agent.agentName}: ${error.message}`);
            throw error;
        }
    }

    transformMetadataSchemaToStr(schema) {
        this.agentResponses = schema.agents.map(agent => 
            `Agent Name: ${agent.agentName}\nResponse: ${agent.output}\n\n`
        );
        return this.agentResponses.join('\n');
    }

    async _executeAgentsConcurrently(task, img, ...args) {
        const executor = require('util').promisify(require('child_process').exec);
        const tasksToRun = this.agents.map(agent => 
            this._runAgent(agent, task, img, executor, ...args)
        );

        const agentOutputs = await Promise.all(tasksToRun);
        return new MetadataSchema({
            swarmId: uuidv4(),
            task,
            description: this.description,
            agents: agentOutputs
        });
    }

    saveMetadata() {
        if (this.autoSave) {
            logger.info(`Saving metadata to ${this.metadataOutputPath}`);
            createFileInFolder(
                process.env.WORKSPACE_DIR,
                this.metadataOutputPath,
                JSON.stringify(this.outputSchema, null, 4)
            );
        }
    }

    _run(task, img, ...args) {
        logger.info(`Running concurrent workflow with ${this.agents.length} agents.`);
        this.outputSchema = this._executeAgentsConcurrently(task, img, ...args);

        this.saveMetadata();

        if (this.returnStrOn) {
            return this.transformMetadataSchemaToStr(this.outputSchema);
        } else {
            return JSON.stringify(this.outputSchema, null, 4);
        }
    }

    run(task = null, img = null, isLast = false, device = "cpu", deviceId = 0, allCores = true, allGpus = false, ...args) {
        if (task) {
            this.tasks.push(task);
        }

        try {
            logger.info(`Attempting to run on device: ${device}`);
            if (device === "cpu") {
                logger.info("Device set to CPU");
                const count = allCores ? require('os').cpus().length : deviceId;
                logger.info(`Using ${allCores ? 'all available' : 'specific'} CPU cores: ${count}`);
                return executeWithCpuCores(count, this._run.bind(this), task, img, ...args);
            } else if (device === "gpu") {
                logger.info("Device set to GPU");
                return executeOnGpu(deviceId, this._run.bind(this), task, img, ...args);
            } else if (allGpus) {
                return executeOnMultipleGpus(listAvailableGpus().map(Number), this._run.bind(this), task, img, ...args);
            } else {
                throw new Error(`Invalid device specified: ${device}. Supported devices are 'cpu' and 'gpu'.`);
            }
        } catch (error) {
            logger.error(`Error during execution: ${error.message}`);
            throw error;
        }
    }

    runBatched(tasks) {
        return tasks.map(task => this.run(task));
    }

    runAsync(task) {
        logger.info(`Running concurrent workflow asynchronously with ${this.agents.length} agents.`);
        return this.run(task);
    }

    runBatchedAsync(tasks) {
        return tasks.map(task => this.runAsync(task));
    }

    runParallel(tasks) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            const results = [];
            const workers = tasks.map(task => new Worker(__filename, { workerData: task }));
            workers.forEach(worker => {
                worker.on('message', result => results.push(result));
                worker.on('error', error => logger.error(`Worker error: ${error.message}`));
            });
            return results;
        } else {
            parentPort.postMessage(this.run(workerData));
        }
    }

    runParallelAsync(tasks) {
        const { Worker, isMainThread, parentPort } = require('worker_threads');
        if (isMainThread) {
            const results = [];
            const workers = tasks.map(task => new Worker(__filename, { workerData: task }));
            workers.forEach(worker => {
                worker.on('message', result => results.push(result));
                worker.on('error', error => logger.error(`Worker error: ${error.message}`));
            });
            return results;
        } else {
            parentPort.postMessage(this.runAsync(workerData));
        }
    }
}

// Example usage (commented out):
/*
import { OpenAIChat } from '../models/openai.mjs';

const model = new OpenAIChat({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
    temperature: 0.1
});

const agents = Array.from({ length: 3 }, (_, i) => new Agent({
    agentName: `Financial-Analysis-Agent-${i}`,
    systemPrompt: FINANCIAL_AGENT_SYS_PROMPT,
    llm: model,
    maxLoops: 1,
    autosave: true,
    dashboard: false,
    verbose: true,
    dynamicTemperatureEnabled: true,
    savedStatePath: `finance_agent_${i}.json`,
    userName: "swarms_corp",
    retryAttempts: 1,
    contextLength: 200000,
    returnStepMeta: false
}));

const workflow = new ConcurrentWorkflow({
    agents,
    metadataOutputPath: "agent_metadata_4.json",
    returnStrOn: true
});

const task = "How can I establish a ROTH IRA to buy stocks and get a tax break? What are the criteria?";
const metadata = workflow.run(task);
console.log(metadata);
*/