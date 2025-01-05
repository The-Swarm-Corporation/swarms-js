import { randomInt } from 'crypto';
import { Agent } from './agent.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarm_load_balancer');

/**
 * A load balancer class that distributes tasks among a group of agents.
 */
export class AgentLoadBalancer extends BaseSwarm {
    /**
     * @param {Array<Agent>} agents - The list of agents available for task execution.
     * @param {number} [maxRetries=3] - The maximum number of retries for a task if it fails.
     * @param {number} [maxLoops=5] - The maximum number of loops to run a task.
     * @param {number} [cooldownTime=0] - The cooldown time between retries.
     */
    constructor({
        agents,
        maxRetries = 3,
        maxLoops = 5,
        cooldownTime = 0
    }) {
        super();
        this.agents = agents;
        this.agentStatus = new Map(agents.map(agent => [agent.agentName, true]));
        this.maxRetries = maxRetries;
        this.maxLoops = maxLoops;
        this.agentPerformance = new Map(agents.map(agent => [agent.agentName, { successCount: 0, failureCount: 0 }]));
        this.lock = new Set();
        this.cooldownTime = cooldownTime;
        this.swarmInitialization();
    }

    swarmInitialization() {
        logger.info('Initializing AgentLoadBalancer with the following agents:');
        if (!this.agents.length) throw new Error('No agents provided to the Load Balancer');
        this.agents.forEach(agent => {
            if (!(agent instanceof Agent)) throw new Error('All agents should be of type Agent');
            logger.info(`Agent Name: ${agent.agentName}`);
        });
        logger.info('Load Balancer Initialized Successfully!');
    }

    getAvailableAgent() {
        const availableAgents = this.agents.filter(agent => this.agentStatus.get(agent.agentName));
        logger.info(`Available agents: ${availableAgents.map(agent => agent.agentName).join(', ')}`);
        if (!availableAgents.length) return null;
        return availableAgents[randomInt(availableAgents.length)];
    }

    setAgentStatus(agent, status) {
        this.agentStatus.set(agent.agentName, status);
    }

    updatePerformance(agent, success) {
        const performance = this.agentPerformance.get(agent.agentName);
        if (success) {
            performance.successCount += 1;
        } else {
            performance.failureCount += 1;
        }
    }

    logPerformance() {
        logger.info('Agent Performance:');
        this.agentPerformance.forEach((stats, agentName) => {
            logger.info(`${agentName}: ${JSON.stringify(stats)}`);
        });
    }

    async run(task, ...args) {
        let retries = 0;
        while (retries < this.maxRetries) {
            const agent = this.getAvailableAgent();
            if (!agent) throw new Error('No available agents to handle the request.');

            try {
                this.setAgentStatus(agent, false);
                const output = await agent.run(task, ...args);
                this.updatePerformance(agent, true);
                return output;
            } catch (error) {
                logger.error(`Error with agent ${agent.agentName}: ${error.message}`);
                this.updatePerformance(agent, false);
                retries += 1;
                await new Promise(resolve => setTimeout(resolve, this.cooldownTime * 1000));
                if (retries >= this.maxRetries) throw error;
            } finally {
                this.setAgentStatus(agent, true);
            }
        }
    }

    async runMultipleTasks(tasks) {
        const results = [];
        for (const task of tasks) {
            results.push(await this.run(task));
        }
        return results;
    }

    async runTaskWithLoops(task) {
        const results = [];
        for (let i = 0; i < this.maxLoops; i++) {
            results.push(await this.run(task));
        }
        return results;
    }

    async runTaskWithCallback(task, callback) {
        try {
            const result = await this.run(task);
            callback(result);
        } catch (error) {
            logger.error(`Task failed: ${error.message}`);
            callback(error.message);
        }
    }

    async runTaskWithTimeout(task, timeout) {
        const result = await Promise.race([
            this.run(task),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Task timed out after ${timeout} seconds.`)), timeout * 1000))
        ]);
        return result;
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: 'Agent1', description: 'Test agent 1' }),
    new Agent({ agentName: 'Agent2', description: 'Test agent 2' })
];

const loadBalancer = new AgentLoadBalancer({ agents });

const task = 'Example task';
loadBalancer.run(task).then(result => {
    console.log(`Task result: ${result}`);
}).catch(console.error);

const tasks = ['Task 1', 'Task 2'];
loadBalancer.runMultipleTasks(tasks).then(results => {
    results.forEach((result, index) => {
        console.log(`Task ${index + 1} result: ${result}`);
    });
}).catch(console.error);

loadBalancer.runTaskWithLoops(task).then(results => {
    results.forEach((result, index) => {
        console.log(`Loop ${index + 1} result: ${result}`);
    });
}).catch(console.error);

loadBalancer.runTaskWithCallback(task, result => {
    console.log(`Callback result: ${result}`);
});

loadBalancer.runTaskWithTimeout(task, 5).then(result => {
    console.log(`Task result: ${result}`);
}).catch(console.error);
*/