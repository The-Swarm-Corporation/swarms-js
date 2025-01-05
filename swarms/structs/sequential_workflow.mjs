import { Agent } from './agent.mjs';
import { AgentRearrange } from './rearrange.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('sequential_workflow');

export class SequentialWorkflow {
    /**
     * Initializes a SequentialWorkflow object, which orchestrates the execution of a sequence of agents.
     * @param {Object} params - Parameters for initializing the workflow
     * @param {string} [params.name="SequentialWorkflow"] - The name of the workflow
     * @param {string} [params.description="Sequential Workflow, where agents are executed in a sequence."] - A description of the workflow
     * @param {Array<Agent>} [params.agents=[]] - The list of agents in the workflow
     * @param {number} [params.maxLoops=1] - The maximum number of loops to execute the workflow
     * @param {string} [params.outputType="all"] - The output type
     * @param {boolean} [params.returnJson=false] - Whether to return results in JSON format
     * @param {Function} [params.sharedMemorySystem=null] - Shared memory system for agents
     */
    constructor({
        name = "SequentialWorkflow",
        description = "Sequential Workflow, where agents are executed in a sequence.",
        agents = [],
        maxLoops = 1,
        outputType = "all",
        returnJson = false,
        sharedMemorySystem = null,
        ...args
    } = {}) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.maxLoops = maxLoops;
        this.outputType = outputType;
        this.returnJson = returnJson;
        this.sharedMemorySystem = sharedMemorySystem;

        this.reliabilityCheck();
        this.flow = this.sequentialFlow();

        this.agentRearrange = new AgentRearrange({
            name,
            description,
            agents,
            flow: this.flow,
            maxLoops,
            outputType,
            returnJson,
            sharedMemorySystem,
            ...args
        });
    }

    sequentialFlow() {
        if (this.agents.length) {
            const agentNames = this.agents.map(agent => agent.agentName || agent.name).filter(Boolean);
            if (agentNames.length) {
                return agentNames.join(' -> ');
            } else {
                logger.warning("No valid agent names found to create flow");
                return "";
            }
        } else {
            logger.warning("No agents provided to create flow");
            return "";
        }
    }

    reliabilityCheck() {
        if (!this.agents.length) {
            throw new Error("Agents list cannot be empty");
        }
        if (this.maxLoops === 0) {
            throw new Error("maxLoops cannot be 0");
        }
        logger.info("Checks completed. Your swarm is ready.");
    }

    run(task, img = null, device = "cpu", allCores = false, allGpus = false, deviceId = 0, noUseClusterOps = true, ...args) {
        try {
            return this.agentRearrange.run(task, img, device, allCores, allGpus, deviceId, noUseClusterOps, ...args);
        } catch (error) {
            logger.error(`An error occurred while executing the task: ${error.message}`);
            throw error;
        }
    }

    runBatched(tasks) {
        if (!tasks || !tasks.every(task => typeof task === 'string')) {
            throw new Error("Tasks must be a non-empty list of strings");
        }
        try {
            return tasks.map(task => this.agentRearrange.run(task));
        } catch (error) {
            logger.error(`An error occurred while executing the batch of tasks: ${error.message}`);
            throw error;
        }
    }

    async runAsync(task) {
        if (!task || typeof task !== 'string') {
            throw new Error("Task must be a non-empty string");
        }
        try {
            return await this.agentRearrange.runAsync(task);
        } catch (error) {
            logger.error(`An error occurred while executing the task asynchronously: ${error.message}`);
            throw error;
        }
    }

    async runConcurrent(tasks) {
        if (!tasks || !tasks.every(task => typeof task === 'string')) {
            throw new Error("Tasks must be a non-empty list of strings");
        }
        try {
            const results = await Promise.all(tasks.map(task => this.agentRearrange.runAsync(task)));
            return results;
        } catch (error) {
            logger.error(`An error occurred while executing the batch of tasks concurrently: ${error.message}`);
            throw error;
        }
    }
}

// Example usage (commented out):
/*
import { SequentialWorkflow } from './sequential_workflow.mjs';
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: "Agent1", description: "Test agent 1" }),
    new Agent({ agentName: "Agent2", description: "Test agent 2" })
];

const workflow = new SequentialWorkflow({ agents });

const task = "Example task";
workflow.run(task).then(result => {
    console.log(`Task result: ${result}`);
}).catch(console.error);

const tasks = ["Task 1", "Task 2"];
workflow.runBatched(tasks).then(results => {
    results.forEach((result, index) => {
        console.log(`Task ${index + 1} result: ${result}`);
    });
}).catch(console.error);

workflow.runAsync(task).then(result => {
    console.log(`Async task result: ${result}`);
}).catch(console.error);

workflow.runConcurrent(tasks).then(results => {
    results.forEach((result, index) => {
        console.log(`Concurrent task ${index + 1} result: ${result}`);
    });
}).catch(console.error);
*/