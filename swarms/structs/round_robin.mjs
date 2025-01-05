import { BaseSwarm } from './base_swarm.mjs';
import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { v4 as uuidv4 } from 'uuid';

const logger = initializeLogger('round-robin');
const datetimeStamp = new Date().toISOString();

/**
 * Metadata schema for the round-robin swarm execution
 */
class MetadataSchema {
    constructor({
        swarmId = uuidv4(),
        name = "RoundRobinSwarm",
        task = "",
        description = "Concurrent execution of multiple agents",
        agentOutputs = [],
        timestamp = new Date(),
        maxLoops = 1
    } = {}) {
        this.swarmId = swarmId;
        this.name = name;
        this.task = task;
        this.description = description;
        this.agentOutputs = agentOutputs;
        this.timestamp = timestamp;
        this.maxLoops = maxLoops;
    }
}

/**
 * A swarm implementation that executes tasks in a round-robin fashion.
 */
export class RoundRobinSwarm extends BaseSwarm {
    constructor({
        name = "RoundRobinSwarm",
        description = "A swarm implementation that executes tasks in a round-robin fashion.",
        agents = [],
        verbose = false,
        maxLoops = 1,
        callback = null,
        returnJsonOn = false,
        maxRetries = 3,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.verbose = verbose;
        this.maxLoops = maxLoops;
        this.callback = callback;
        this.returnJsonOn = returnJsonOn;
        this.index = 0;
        this.maxRetries = maxRetries;

        this.outputSchema = new MetadataSchema({
            name: this.name,
            swarmId: datetimeStamp,
            task: "",
            description: this.description,
            agentOutputs: [],
            timestamp: datetimeStamp,
            maxLoops: this.maxLoops
        });

        if (this.agents.length) {
            this.agents.forEach(agent => {
                agent.maxLoops = Math.floor(Math.random() * 5) + 1;
            });
        }

        logger.info(`Successfully initialized ${this.name} with ${this.agents.length} agents`);
    }

    async _executeAgent(agent, task, ...args) {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                logger.info(`Running Agent ${agent.agentName} on task: ${task}`);
                const result = await agent.run(task, ...args);
                this.outputSchema.agentOutputs.push(agent.agentOutput);
                return result;
            } catch (error) {
                logger.error(`Error executing agent ${agent.agentName}: ${error.message}`);
                if (attempt === this.maxRetries - 1) throw error;
                const delay = Math.min(4 * Math.pow(2, attempt), 10) * 1000;
                logger.info(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async run(task, ...args) {
        if (!this.agents.length) {
            logger.error("No agents configured for the swarm");
            throw new Error("No agents configured for the swarm");
        }

        try {
            let result = task;
            this.outputSchema.task = task;
            const n = this.agents.length;
            logger.info(`Starting round-robin execution with task '${task}' on ${n} agents`);

            for (let loop = 0; loop < this.maxLoops; loop++) {
                logger.debug(`Starting loop ${loop + 1}/${this.maxLoops}`);

                for (let i = 0; i < n; i++) {
                    const currentAgent = this.agents[this.index];
                    result = await this._executeAgent(currentAgent, result, ...args);
                    this.index = (this.index + 1) % n;
                }

                if (this.callback) {
                    logger.debug(`Executing callback for loop ${loop + 1}`);
                    try {
                        this.callback(loop, result);
                    } catch (error) {
                        logger.error(`Callback execution failed: ${error.message}`);
                    }
                }
            }

            logger.success(`Successfully completed ${this.maxLoops} loops of round-robin execution`);

            if (this.returnJsonOn) {
                return this.exportMetadata();
            }
            return result;
        } catch (error) {
            logger.error(`Round-robin execution failed: ${error.message}`);
            throw error;
        }
    }

    exportMetadata() {
        try {
            return JSON.stringify(this.outputSchema, null, 4);
        } catch (error) {
            logger.error(`Failed to export metadata: ${error.message}`);
            throw error;
        }
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: "Agent1", description: "First agent" }),
    new Agent({ agentName: "Agent2", description: "Second agent" })
];

const swarm = new RoundRobinSwarm({
    agents,
    maxLoops: 3,
    verbose: true
});

const task = "Example task";
swarm.run(task).then(result => {
    console.log("Final result:", result);
}).catch(console.error);
*/