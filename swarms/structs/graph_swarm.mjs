import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { autoCheckAndDownloadPackage } from '../utils/auto_download_check_packages.mjs';

const logger = initializeLogger('graph_swarm');

// Utility function to implement retry functionality
const retryWithBackoff = async (fn, attempts = 3, minDelay = 4000, maxDelay = 10000) => {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === attempts - 1) throw error;
            const delay = Math.min(minDelay * Math.pow(2, i), maxDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

/**
 * Agent output model for structured data
 */
class AgentOutput {
    constructor({
        agentName,
        timestamp = Date.now() / 1000,
        output,
        executionTime,
        error = null,
        metadata = {}
    }) {
        this.agentName = agentName;
        this.timestamp = timestamp;
        this.output = output;
        this.executionTime = executionTime;
        this.error = error;
        this.metadata = metadata;
    }
}

/**
 * Swarm output model for structured data
 */
class SwarmOutput {
    constructor({
        timestamp = Date.now() / 1000,
        outputs,
        executionTime,
        success,
        error = null,
        metadata = {}
    }) {
        this.timestamp = timestamp;
        this.outputs = outputs;
        this.executionTime = executionTime;
        this.success = success;
        this.error = error;
        this.metadata = metadata;
    }
}

/**
 * Vector-based memory system for GraphSwarm using ChromaDB.
 */
class SwarmMemory {
    constructor(collectionName = 'swarm_memories') {
        try {
            this.client = new ChromaClient();
        } catch (error) {
            autoCheckAndDownloadPackage('chromadb', 'npm', true);
            this.client = new ChromaClient();
        }

        this.collection = this.client.getOrCreateCollection({
            name: collectionName,
            metadata: { description: 'GraphSwarm execution memories' }
        });
    }

    async storeExecution(task, result) {
        try {
            const metadata = {
                timestamp: new Date().toISOString(),
                success: result.success,
                executionTime: result.executionTime,
                agentSequence: JSON.stringify(Object.keys(result.outputs)),
                error: result.error || ''
            };

            const document = {
                task,
                outputs: JSON.stringify(
                    Object.fromEntries(
                        Object.entries(result.outputs).map(([name, output]) => [
                            name,
                            {
                                output: String(output.output),
                                executionTime: output.executionTime,
                                error: output.error
                            }
                        ])
                    )
                )
            };

            await this.collection.add({
                documents: [JSON.stringify(document)],
                metadatas: [metadata],
                ids: [`exec_${Date.now()}`]
            });

            logger.info(`Stored execution in memory: ${task}`);
        } catch (error) {
            logger.error(`Failed to store execution in memory: ${error.message}`);
        }
    }

    async getSimilarExecutions(task, limit = 5) {
        try {
            const results = await this.collection.query({
                queryTexts: [task],
                nResults: limit,
                include: ['documents', 'metadatas']
            });

            if (!results.documents.length) return [];

            return results.documents[0].map((doc, idx) => ({
                task: JSON.parse(doc).task,
                outputs: JSON.parse(doc).outputs,
                success: results.metadatas[0][idx].success,
                executionTime: results.metadatas[0][idx].executionTime,
                agentSequence: JSON.parse(results.metadatas[0][idx].agentSequence),
                timestamp: results.metadatas[0][idx].timestamp
            }));
        } catch (error) {
            logger.error(`Failed to retrieve similar executions: ${error.message}`);
            return [];
        }
    }

    async getOptimalSequence(task) {
        const similarExecutions = await this.getSimilarExecutions(task);
        if (!similarExecutions.length) return null;

        const successfulExecs = similarExecutions.filter(ex => ex.success);
        if (!successfulExecs.length) return null;

        return successfulExecs[0].agentSequence;
    }

    async clearMemory() {
        await this.client.deleteCollection(this.collection.name);
        this.collection = await this.client.getOrCreateCollection({
            name: this.collection.name
        });
    }
}

/**
 * Enhanced framework for creating and managing swarms of collaborative agents.
 */
export class GraphSwarm {
    constructor({
        agents = null,
        maxWorkers = null,
        swarmName = 'Collaborative Agent Swarm',
        memoryCollection = 'swarm_memory'
    } = {}) {
        this.graph = new Map();
        this.agents = new Map();
        this.dependencies = new Map();
        this.executor = new ThreadPoolExecutor(maxWorkers);
        this.swarmName = swarmName;
        this.memoryCollection = memoryCollection;
        this.memory = new SwarmMemory(memoryCollection);

        if (agents) {
            this.initializeAgents(agents);
        }

        logger.info(`Initialized GraphSwarm: ${swarmName}`);
    }

    initializeAgents(agents) {
        agents.forEach(item => {
            const [agent, dependencies] = Array.isArray(item) ? item : [item, []];
            if (!(agent instanceof Agent)) {
                throw new Error(`Expected Agent object, got ${typeof agent}`);
            }

            this.agents.set(agent.agentName, agent);
            this.dependencies.set(agent.agentName, dependencies);
            this.graph.set(agent.agentName, { agent, dependencies });

            dependencies.forEach(dep => {
                if (!this.agents.has(dep)) {
                    throw new Error(`Dependency ${dep} not found for agent ${agent.agentName}`);
                }
            });
        });

        this.validateGraph();
    }

    validateGraph() {
        const visited = new Set();
        const stack = new Set();

        const visit = node => {
            if (stack.has(node)) {
                throw new Error(`Agent dependency graph contains cycles: ${Array.from(stack)}`);
            }
            if (!visited.has(node)) {
                stack.add(node);
                this.dependencies.get(node).forEach(visit);
                stack.delete(node);
                visited.add(node);
            }
        };

        this.agents.forEach((_, agentName) => visit(agentName));
    }

    getAgentRoleDescription(agentName) {
        const predecessors = this.dependencies.get(agentName) || [];
        const successors = Array.from(this.graph.entries())
            .filter(([_, { dependencies }]) => dependencies.includes(agentName))
            .map(([name]) => name);
        const position = !predecessors.length ? 'initial' : (!successors.length ? 'final' : 'intermediate');

        return `
            You are ${agentName}, a specialized agent in the ${this.swarmName}.
            Position: ${position} agent in the workflow

            Your relationships:
            ${predecessors.length ? `You receive input from: ${predecessors.join(', ')}` : ''}
            ${successors.length ? `Your output will be used by: ${successors.join(', ')}` : ''}
        `;
    }

    generateWorkflowContext() {
        const executionOrder = Array.from(this.graph.keys());

        return `
            Workflow Overview of ${this.swarmName}:

            Processing Order:
            ${executionOrder.join(' -> ')}

            Agent Roles:
            ${executionOrder.map(agentName => {
                const predecessors = this.dependencies.get(agentName) || [];
                const successors = Array.from(this.graph.entries())
                    .filter(([_, { dependencies }]) => dependencies.includes(agentName))
                    .map(([name]) => name);

                return `
                    ${agentName}:
                    ${predecessors.length ? `- Receives from: ${predecessors.join(', ')}` : ''}
                    ${successors.length ? `- Sends to: ${successors.join(', ')}` : ''}
                    ${!predecessors.length && !successors.length ? '- Independent agent' : ''}
                `;
            }).join('\n')}
        `;
    }

    buildAgentPrompt(agentName, task, context = {}) {
        return `
            ${this.getAgentRoleDescription(agentName)}
            \nWorkflow Context:
            ${this.generateWorkflowContext()}
            \nYour Task:
            ${task}
            \nContext from Previous Agents:
            ${JSON.stringify(context)}
            \nInstructions:
            1. Process the task according to your role
            2. Consider the input from previous agents when available
            3. Provide clear, structured output
            4. Remember that your output will be used by subsequent agents
            \nResponse Guidelines:
            - Provide clear, well-organized output
            - Include relevant details and insights
            - Highlight key findings
            - Flag any uncertainties or issues
        `;
    }

    async executeAgent(agentName, task, context = {}) {
        const startTime = Date.now() / 1000;
        const agent = this.agents.get(agentName);

        try {
            const fullPrompt = this.buildAgentPrompt(agentName, task, context);
            logger.debug(`Prompt for ${agentName}:\n${fullPrompt}`);

            const output = await agent.run(fullPrompt);

            return new AgentOutput({
                agentName,
                output,
                executionTime: Date.now() / 1000 - startTime,
                metadata: {
                    task,
                    context,
                    positionInWorkflow: Array.from(this.graph.keys()).indexOf(agentName)
                }
            });
        } catch (error) {
            logger.error(`Error executing agent ${agentName}: ${error.message}`);
            return new AgentOutput({
                agentName,
                output: null,
                executionTime: Date.now() / 1000 - startTime,
                error: error.message,
                metadata: { task }
            });
        }
    }

    async execute(task) {
        const startTime = Date.now() / 1000;
        const outputs = {};
        let success = true;
        let error = null;

        try {
            const similarExecutions = await this.memory.getSimilarExecutions(task, 3);
            const optimalSequence = await this.memory.getOptimalSequence(task);
            const baseExecutionOrder = Array.from(this.graph.keys());
            const executionOrder = optimalSequence && optimalSequence.every(agent => baseExecutionOrder.includes(agent))
                ? optimalSequence
                : baseExecutionOrder;

            const historicalContext = similarExecutions.length ? {
                similarTask: similarExecutions[0].task,
                previousOutputs: similarExecutions[0].outputs,
                executionTime: similarExecutions[0].executionTime,
                successPatterns: this.extractSuccessPatterns(similarExecutions)
            } : {};

            for (const agentName of executionOrder) {
                const agentContext = {
                    dependencies: Object.fromEntries(
                        (this.dependencies.get(agentName) || []).map(dep => [dep, outputs[dep]?.output])
                    ),
                    historical: historicalContext,
                    position: executionOrder.indexOf(agentName),
                    totalAgents: executionOrder.length
                };

                const output = await this.executeAgent(agentName, task, agentContext);
                outputs[agentName] = output;

                if (output.error) {
                    success = false;
                    error = `Agent ${agentName} failed: ${output.error}`;

                    const recoveryOutput = this.attemptRecovery(agentName, task, similarExecutions);
                    if (recoveryOutput) {
                        outputs[agentName] = recoveryOutput;
                        success = true;
                        error = null;
                        continue;
                    }
                    break;
                }
            }

            const result = new SwarmOutput({
                outputs,
                executionTime: Date.now() / 1000 - startTime,
                success,
                error,
                metadata: {
                    task,
                    usedOptimalSequence: !!optimalSequence,
                    similarExecutionsFound: similarExecutions.length,
                    executionOrder,
                    historicalContextUsed: !!Object.keys(historicalContext).length
                }
            });

            await this.storeExecutionAsync(task, result);
            return result;
        } catch (error) {
            logger.error(`Swarm execution failed: ${error.message}`);
            return new SwarmOutput({
                outputs,
                executionTime: Date.now() / 1000 - startTime,
                success: false,
                error: error.message,
                metadata: { task }
            });
        }
    }

    run(task) {
        return this.execute(task);
    }

    extractSuccessPatterns(similarExecutions) {
        const successfulExecs = similarExecutions.filter(ex => ex.success);
        if (!successfulExecs.length) return {};

        return {
            commonSequences: this.findCommonSequences(successfulExecs),
            avgExecutionTime: successfulExecs.reduce((sum, ex) => sum + ex.executionTime, 0) / successfulExecs.length,
            successfulStrategies: this.extractStrategies(successfulExecs)
        };
    }

    attemptRecovery(failedAgent, task, similarExecutions) {
        for (const execution of similarExecutions) {
            if (execution.success && execution.outputs[failedAgent]) {
                const historicalOutput = execution.outputs[failedAgent];
                return new AgentOutput({
                    agentName: failedAgent,
                    output: historicalOutput.output,
                    executionTime: historicalOutput.executionTime,
                    metadata: {
                        recoveredFromMemory: true,
                        originalTask: execution.task
                    }
                });
            }
        }
        return null;
    }

    async storeExecutionAsync(task, result) {
        try {
            await this.memory.storeExecution(task, result);
        } catch (error) {
            logger.error(`Failed to store execution in memory: ${error.message}`);
        }
    }

    addAgent(agent, dependencies = []) {
        this.agents.set(agent.agentName, agent);
        this.dependencies.set(agent.agentName, dependencies);
        this.graph.set(agent.agentName, { agent, dependencies });

        dependencies.forEach(dep => {
            if (!this.agents.has(dep)) {
                throw new Error(`Dependency ${dep} not found`);
            }
        });

        this.validateGraph();
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const runExample = async () => {
    const agents = [
        new Agent({ agentName: 'Agent1', description: 'First agent' }),
        new Agent({ agentName: 'Agent2', description: 'Second agent' }),
        new Agent({ agentName: 'Agent3', description: 'Third agent' })
    ];

    const graphSwarm = new GraphSwarm({ agents });

    const task = 'Analyze the financial statements of a potential acquisition target and identify key growth drivers.';
    const result = await graphSwarm.run(task);

    console.log('Swarm execution result:', result);
};

// Only run if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    runExample().catch(console.error);
}
*/