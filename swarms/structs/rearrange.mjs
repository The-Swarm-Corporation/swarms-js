import { v4 as uuidv4 } from 'uuid';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { showcaseAvailableAgents } from './agents_available.mjs';
import { execCallableWithClusterOps } from '../utils/wrapper_clusterop.mjs';
import { logAgentData } from '../telemetry/capture_sys_data.mjs';
import { BaseSwarm } from './base_swarm.mjs';

const logger = initializeLogger('rearrange');

class AgentRearrangeInput {
    constructor({
        swarmId = uuidv4(),
        name = null,
        description = null,
        flow = null,
        maxLoops = 1,
        time = new Date().toISOString(),
        outputType = 'final'
    } = {}) {
        this.swarmId = swarmId;
        this.name = name;
        this.description = description;
        this.flow = flow;
        this.maxLoops = maxLoops;
        this.time = time;
        this.outputType = outputType;
    }
}

class AgentRearrangeOutput {
    constructor({
        outputId = uuidv4(),
        input = null,
        outputs = [],
        time = new Date().toISOString()
    } = {}) {
        this.outputId = outputId;
        this.input = input;
        this.outputs = outputs;
        this.time = time;
    }
}

export class AgentRearrange extends BaseSwarm {
    constructor({
        id = uuidv4(),
        name = 'AgentRearrange',
        description = 'A swarm of agents for rearranging tasks.',
        agents = [],
        flow = '',
        maxLoops = 1,
        verbose = true,
        memorySystem = null,
        humanInTheLoop = false,
        customHumanInTheLoop = null,
        returnJson = false,
        outputType = 'all',
        docs = null,
        docFolder = null,
        device = 'cpu',
        deviceId = 0,
        allCores = false,
        allGpus = true,
        noUseClusterOps = true,
        autosave = true,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.id = id;
        this.agents = new Map(agents.map(agent => [agent.agentName, agent]));
        this.flow = flow;
        this.verbose = verbose;
        this.maxLoops = maxLoops;
        this.memorySystem = memorySystem;
        this.humanInTheLoop = humanInTheLoop;
        this.customHumanInTheLoop = customHumanInTheLoop;
        this.returnJson = returnJson;
        this.outputType = outputType;
        this.docs = docs;
        this.docFolder = docFolder;
        this.device = device;
        this.deviceId = deviceId;
        this.allCores = allCores;
        this.allGpus = allGpus;
        this.noUseClusterOps = noUseClusterOps;
        this.autosave = autosave;

        this.outputSchema = new AgentRearrangeOutput({
            input: new AgentRearrangeInput({
                swarmId: id,
                name,
                description,
                flow,
                maxLoops
            })
        });
    }

    showcaseAgents() {
        return showcaseAvailableAgents({
            name: this.name,
            description: this.description,
            agents: Array.from(this.agents.values()),
            format: 'Table'
        });
    }

    rearrangePromptPrep() {
        const agentsAvailable = this.showcaseAgents();
        return `
        ===== Swarm Configuration =====
        
        Name: ${this.name}
        Description: ${this.description}
        
        ===== Execution Flow =====
        ${this.flow}
        
        ===== Participating Agents =====
        ${agentsAvailable}
        
        ===========================
        `;
    }

    setCustomFlow(flow) {
        this.flow = flow;
        logger.info(`Custom flow set: ${flow}`);
    }

    addAgent(agent) {
        logger.info(`Adding agent ${agent.agentName} to the swarm.`);
        this.agents.set(agent.agentName, agent);
    }

    trackHistory(agentName, result) {
        if (!this.swarmHistory) this.swarmHistory = new Map();
        if (!this.swarmHistory.has(agentName)) this.swarmHistory.set(agentName, []);
        this.swarmHistory.get(agentName).push(result);
    }

    removeAgent(agentName) {
        this.agents.delete(agentName);
    }

    addAgents(agents) {
        agents.forEach(agent => this.addAgent(agent));
    }

    validateFlow() {
        if (!this.flow.includes('->')) {
            throw new Error("Flow must include '->' to denote the direction of the task.");
        }

        const agentsInFlow = [];
        const tasks = this.flow.split('->');

        tasks.forEach(task => {
            const agentNames = task.split(',').map(name => name.trim());
            agentNames.forEach(agentName => {
                if (!this.agents.has(agentName) && agentName !== 'H') {
                    throw new Error(`Agent '${agentName}' is not registered.`);
                }
                agentsInFlow.push(agentName);
            });
        });

        if (new Set(agentsInFlow).size !== agentsInFlow.length) {
            throw new Error('Duplicate agent names in the flow are not allowed.');
        }

        logger.info(`Flow: ${this.flow} is valid.`);
        return true;
    }

    async _run(task = null, img = null, customTasks = null, ...args) {
        try {
            if (!this.validateFlow()) {
                logger.error('Flow validation failed');
                return 'Invalid flow configuration.';
            }

            const tasks = this.flow.split('->');
            let currentTask = task;
            const allResponses = [];
            const responseDict = {};
            let previousAgent = null;

            logger.info(`Starting task execution with ${tasks.length} steps`);

            if (customTasks) {
                logger.info('Processing custom tasks');
                const [cAgentName, cTask] = Object.entries(customTasks)[0];
                const position = tasks.indexOf(cAgentName);

                if (position > 0) {
                    tasks[position - 1] += `->${cTask}`;
                } else {
                    tasks.splice(position, 0, cTask);
                }
            }

            let loopCount = 0;
            while (loopCount < this.maxLoops) {
                logger.info(`Starting loop ${loopCount + 1}/${this.maxLoops}`);

                for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
                    const task = tasks[taskIdx];
                    const isLast = task === tasks[tasks.length - 1];
                    const agentNames = task.split(',').map(name => name.trim());

                    let promptPrefix = '';
                    if (previousAgent && taskIdx > 0) {
                        promptPrefix = `Previous agent ${previousAgent} output: ${currentTask}\n`;
                    } else if (taskIdx === 0) {
                        promptPrefix = 'Initial task: ';
                    }

                    if (agentNames.length > 1) {
                        logger.info(`Running agents in parallel: ${agentNames}`);
                        const results = await Promise.all(agentNames.map(async agentName => {
                            if (agentName === 'H') {
                                if (this.humanInTheLoop && this.customHumanInTheLoop) {
                                    currentTask = this.customHumanInTheLoop(promptPrefix + String(currentTask));
                                } else {
                                    currentTask = prompt(promptPrefix + 'Enter your response: ');
                                }
                                responseDict[agentName] = currentTask;
                                return currentTask;
                            } else {
                                const agent = this.agents.get(agentName);
                                const taskWithContext = promptPrefix + String(currentTask);
                                const result = await agent.run(taskWithContext, img, isLast, ...args);
                                responseDict[agentName] = result;
                                this.outputSchema.outputs.push(agent.agentOutput);
                                logger.debug(`Agent ${agentName} output: ${result}`);
                                return result;
                            }
                        }));

                        currentTask = results.join('; ');
                        allResponses.push(...results);
                        previousAgent = agentNames.join(',');
                    } else {
                        logger.info(`Running agent sequentially: ${agentNames[0]}`);
                        const agentName = agentNames[0];

                        if (agentName === 'H') {
                            if (this.humanInTheLoop && this.customHumanInTheLoop) {
                                currentTask = this.customHumanInTheLoop(promptPrefix + String(currentTask));
                            } else {
                                currentTask = prompt(promptPrefix + 'Enter the next task: ');
                            }
                            responseDict[agentName] = currentTask;
                        } else {
                            const agent = this.agents.get(agentName);
                            const taskWithContext = promptPrefix + String(currentTask);
                            currentTask = await agent.run(taskWithContext, img, isLast, ...args);
                            responseDict[agentName] = currentTask;
                            this.outputSchema.outputs.push(agent.agentOutput);
                            logger.debug(`Agent ${agentName} output: ${currentTask}`);
                        }

                        allResponses.push(`Agent Name: ${agentName} \n Output: ${currentTask}`);
                        previousAgent = agentName;
                    }
                }

                loopCount++;
            }

            logger.info('Task execution completed');

            if (this.returnJson) {
                return JSON.stringify(this.outputSchema, null, 4);
            }

            switch (this.outputType) {
                case 'all':
                    return allResponses.join(' ');
                case 'list':
                    return allResponses;
                case 'dict':
                    return responseDict;
                default:
                    return currentTask;
            }
        } catch (error) {
            this._catchError(error);
        }
    }

    _catchError(error) {
        if (this.autosave) {
            logAgentData(this.toDict());
        }

        logger.error(`An error occurred with your swarm ${this.name}: Error: ${error.message}`);
        return error;
    }

    run(task = null, img = null, device = 'cpu', deviceId = 2, allCores = true, allGpus = false, noUseClusterOps = true, ...args) {
        try {
            noUseClusterOps = noUseClusterOps || this.noUseClusterOps;

            if (noUseClusterOps) {
                return this._run(task, img, ...args);
            } else {
                return execCallableWithClusterOps({
                    device,
                    deviceId,
                    allCores,
                    allGpus,
                    func: this._run.bind(this),
                    task,
                    img,
                    ...args
                });
            }
        } catch (error) {
            this._catchError(error);
        }
    }

    async batchRun(tasks, img = null, batchSize = 10, device = 'cpu', deviceId = null, allCores = true, allGpus = false, ...args) {
        try {
            const results = [];
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batchTasks = tasks.slice(i, i + batchSize);
                const batchImgs = img ? img.slice(i, i + batchSize) : Array(batchTasks.length).fill(null);

                const batchResults = await Promise.all(batchTasks.map((task, idx) => 
                    this.run(task, batchImgs[idx], device, deviceId, allCores, allGpus, ...args)
                ));
                results.push(...batchResults);
            }
            return results;
        } catch (error) {
            this._catchError(error);
        }
    }

    async abatchRun(tasks, img = null, batchSize = 10, ...args) {
        try {
            const results = [];
            for (let i = 0; i < tasks.length; i += batchSize) {
                const batchTasks = tasks.slice(i, i + batchSize);
                const batchImgs = img ? img.slice(i, i + batchSize) : Array(batchTasks.length).fill(null);

                const batchResults = await Promise.all(batchTasks.map((task, idx) => 
                    this.astream(task, batchImgs[idx], ...args)
                ));
                results.push(...batchResults);
            }
            return results;
        } catch (error) {
            this._catchError(error);
        }
    }

    async concurrentRun(tasks, img = null, maxWorkers = null, device = 'cpu', deviceId = null, allCores = true, allGpus = false, ...args) {
        try {
            const results = await Promise.all(tasks.map((task, idx) => 
                this.run(task, img ? img[idx] : null, device, deviceId, allCores, allGpus, ...args)
            ));
            return results;
        } catch (error) {
            this._catchError(error);
        }
    }

    _serializeCallable(attrValue) {
        return {
            name: attrValue.name || attrValue.constructor.name,
            doc: attrValue.doc || null
        };
    }

    _serializeAttr(attrName, attrValue) {
        try {
            if (typeof attrValue === 'function') {
                return this._serializeCallable(attrValue);
            } else if (attrValue && typeof attrValue.toDict === 'function') {
                return attrValue.toDict();
            } else {
                JSON.stringify(attrValue);
                return attrValue;
            }
        } catch {
            return `<Non-serializable: ${typeof attrValue}>`;
        }
    }

    toDict() {
        return Object.fromEntries(Object.entries(this).map(([key, value]) => [key, this._serializeAttr(key, value)]));
    }
}

export function rearrange({ agents = [], flow = '', task = null, img = null, ...args } = {}) {
    const agentSystem = new AgentRearrange({ agents, flow, ...args });
    return agentSystem.run(task, img, ...args);
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agent1 = new Agent({ agentName: 'Agent1', description: 'Test agent 1' });
const agent2 = new Agent({ agentName: 'Agent2', description: 'Test agent 2' });

const agents = [agent1, agent2];
const flow = 'Agent1 -> Agent2';
const task = 'Example task';

const result = rearrange({ agents, flow, task });
console.log(result);
*/