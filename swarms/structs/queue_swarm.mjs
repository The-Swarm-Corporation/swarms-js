import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import fs from 'fs';
import path from 'path';

const logger = initializeLogger('queue_swarm');

class AgentOutput {
    constructor({ agentName, task, result, timestamp }) {
        this.agentName = agentName;
        this.task = task;
        this.result = result;
        this.timestamp = timestamp;
    }
}

class SwarmRunMetadata {
    constructor({ runId, name, description, agents, startTime, endTime, tasksCompleted, outputs }) {
        this.runId = runId;
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.startTime = startTime;
        this.endTime = endTime;
        this.tasksCompleted = tasksCompleted;
        this.outputs = outputs;
    }
}

export class TaskQueueSwarm extends BaseSwarm {
    constructor({
        agents,
        name = 'Task-Queue-Swarm',
        description = 'A swarm that processes tasks from a queue using multiple agents on different threads.',
        autosaveOn = true,
        saveFilePath = 'swarm_run_metadata.json',
        workspaceDir = process.env.WORKSPACE_DIR || 'agent_workspace',
        returnMetadataOn = false,
        maxLoops = 1,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.agents = agents;
        this.taskQueue = [];
        this.lock = new Set();
        this.autosaveOn = autosaveOn;
        this.saveFilePath = saveFilePath;
        this.workspaceDir = workspaceDir;
        this.returnMetadataOn = returnMetadataOn;
        this.maxLoops = maxLoops;

        const currentTime = new Date().toISOString().replace(/[:.]/g, '-');
        this.metadata = new SwarmRunMetadata({
            runId: `swarm_run_${currentTime}`,
            name,
            description,
            agents: agents.map(agent => agent.agentName),
            startTime: currentTime,
            endTime: '',
            tasksCompleted: 0,
            outputs: []
        });
    }

    reliabilityChecks() {
        logger.info('Initializing reliability checks.');

        if (!this.agents.length) {
            throw new Error('You must provide a non-empty list of Agent instances.');
        }

        if (this.maxLoops <= 0) {
            throw new Error('max_loops must be greater than zero.');
        }

        logger.info('Reliability checks successful. Swarm is ready for usage.');
    }

    addTask(task) {
        this.taskQueue.push(task);
    }

    async _processTask(agent) {
        while (this.taskQueue.length) {
            const task = this.taskQueue.shift();
            if (!task) break;

            try {
                logger.info(`Agent ${agent.agentName} is running task: ${task}`);
                const result = await agent.run(task);
                this.lock.add(agent.agentName);
                this.metadata.tasksCompleted += 1;
                this.metadata.outputs.push(new AgentOutput({
                    agentName: agent.agentName,
                    task,
                    result,
                    timestamp: new Date().toISOString()
                }));
                logger.info(`Agent ${agent.agentName} completed task: ${task}`);
                logger.debug(`Result: ${result}`);
            } catch (error) {
                logger.error(`Agent ${agent.agentName} failed to complete task: ${task}`);
                logger.error(error);
            } finally {
                this.lock.delete(agent.agentName);
            }
        }
    }

    async run() {
        logger.info(`Starting swarm run: ${this.metadata.runId}`);

        const threads = this.agents.map(agent => this._processTask(agent));
        await Promise.all(threads);

        this.metadata.endTime = new Date().toISOString().replace(/[:.]/g, '-');

        if (this.autosaveOn) {
            this.saveJsonToFile();
        }

        return this.returnMetadataOn ? this.exportMetadata() : null;
    }

    saveJsonToFile() {
        const jsonString = this.exportMetadata();
        const filePath = path.join(this.workspaceDir, this.saveFilePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, jsonString);
        logger.info(`Metadata saved to ${filePath}`);
    }

    exportMetadata() {
        return JSON.stringify(this.metadata, null, 4);
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: 'Agent1', description: 'Test agent 1' }),
    new Agent({ agentName: 'Agent2', description: 'Test agent 2' })
];

const swarm = new TaskQueueSwarm({ agents });

swarm.addTask('Task 1');
swarm.addTask('Task 2');

swarm.run().then(metadata => {
    console.log(metadata);
}).catch(console.error);
*/