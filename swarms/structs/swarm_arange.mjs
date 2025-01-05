import { v4 as uuidv4 } from 'uuid';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarm_arange');

class SwarmArrangeInput {
    constructor({ id = uuidv4(), timeStamp = new Date().toISOString(), name, description, swarms = [], outputType, flow = "" }) {
        this.id = id;
        this.timeStamp = timeStamp;
        this.name = name;
        this.description = description;
        this.swarms = swarms;
        this.outputType = outputType;
        this.flow = flow;
    }
}

class SwarmArrangeOutput {
    constructor({ inputConfig = null }) {
        this.inputConfig = inputConfig;
    }
}

export class SwarmRearrange {
    constructor({
        id = uuidv4(),
        name = "SwarmRearrange",
        description = "A swarm of swarms for rearranging tasks.",
        swarms = [],
        flow = "",
        maxLoops = 1,
        verbose = true,
        humanInTheLoop = false,
        customHumanInTheLoop = null,
        returnJson = false,
        ...args
    } = {}) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.swarms = new Map(swarms.map(swarm => [swarm.name, swarm]));
        this.flow = flow;
        this.maxLoops = maxLoops;
        this.verbose = verbose;
        this.humanInTheLoop = humanInTheLoop;
        this.customHumanInTheLoop = customHumanInTheLoop;
        this.returnJson = returnJson;
        this.swarmHistory = new Map(swarms.map(swarm => [swarm.name, []]));
        this.lock = new Set();

        this.reliabilityChecks();

        if (this.verbose) {
            logger.add('swarm_rearrange.log', { rotation: '10 MB' });
        }
    }

    reliabilityChecks() {
        logger.info('Running reliability checks.');
        if (!this.swarms.size) throw new Error('No swarms found in the swarm.');
        if (!this.flow) throw new Error('No flow found in the swarm.');
        if (this.maxLoops <= 0) throw new Error('Max loops must be a positive integer.');
        logger.info(`SwarmRearrange initialized with swarms: ${Array.from(this.swarms.keys()).join(', ')}`);
    }

    setCustomFlow(flow) {
        this.flow = flow;
        logger.info(`Custom flow set: ${flow}`);
    }

    addSwarm(swarm) {
        logger.info(`Adding swarm ${swarm.name} to the swarm.`);
        this.swarms.set(swarm.name, swarm);
    }

    trackHistory(swarmName, result) {
        this.swarmHistory.get(swarmName).push(result);
    }

    removeSwarm(swarmName) {
        this.swarms.delete(swarmName);
    }

    addSwarms(swarms) {
        swarms.forEach(swarm => this.swarms.set(swarm.name, swarm));
    }

    validateFlow() {
        if (!this.flow.includes('->')) throw new Error("Flow must include '->' to denote the direction of the task.");
        const swarmsInFlow = [];
        const tasks = this.flow.split('->');
        tasks.forEach(task => {
            const swarmNames = task.split(',').map(name => name.trim());
            swarmNames.forEach(swarmName => {
                if (!this.swarms.has(swarmName) && swarmName !== 'H') throw new Error(`Swarm '${swarmName}' is not registered.`);
                swarmsInFlow.push(swarmName);
            });
        });
        if (new Set(swarmsInFlow).size !== swarmsInFlow.length) throw new Error('Duplicate swarm names in the flow are not allowed.');
        logger.info('Flow is valid.');
        return true;
    }

    async run(task = null, img = null, customTasks = null, ...args) {
        try {
            if (!this.validateFlow()) return 'Invalid flow configuration.';
            const tasks = this.flow.split('->');
            let currentTask = task;

            if (customTasks && typeof customTasks === 'object' && Object.keys(customTasks).length) {
                const [cSwarmName, cTask] = Object.entries(customTasks)[0];
                const position = tasks.indexOf(cSwarmName);
                if (position > 0) {
                    tasks[position - 1] += `->${cTask}`;
                } else {
                    tasks.splice(position, 0, cTask);
                }
            }

            let loopCount = 0;
            while (loopCount < this.maxLoops) {
                for (const task of tasks) {
                    const swarmNames = task.split(',').map(name => name.trim());
                    if (swarmNames.length > 1) {
                        logger.info(`Running swarms in parallel: ${swarmNames.join(', ')}`);
                        const results = await Promise.all(swarmNames.map(async swarmName => {
                            if (swarmName === 'H') {
                                return this.humanInTheLoop && this.customHumanInTheLoop ? this.customHumanInTheLoop(currentTask) : prompt('Enter your response: ');
                            } else {
                                const swarm = this.swarms.get(swarmName);
                                const result = await swarm.run(currentTask, img, ...args);
                                logger.info(`Swarm ${swarmName} returned result of type: ${typeof result}`);
                                return result;
                            }
                        }));
                        currentTask = results.filter(r => r !== null).join('; ');
                    } else {
                        logger.info(`Running swarms sequentially: ${swarmNames.join(', ')}`);
                        const swarmName = swarmNames[0];
                        if (swarmName === 'H') {
                            currentTask = this.humanInTheLoop && this.customHumanInTheLoop ? this.customHumanInTheLoop(currentTask) : prompt('Enter the next task: ');
                        } else {
                            const swarm = this.swarms.get(swarmName);
                            const result = await swarm.run(currentTask, img, ...args);
                            logger.info(`Swarm ${swarmName} returned result of type: ${typeof result}`);
                            currentTask = result !== null ? result : currentTask;
                        }
                    }
                }
                loopCount++;
            }
            return currentTask;
        } catch (error) {
            logger.error(`An error occurred: ${error.message}`);
            return error.message;
        }
    }
}

export async function swarmArrange({
    name = "SwarmArrange-01",
    description = "Combine multiple swarms and execute them sequentially",
    swarms = [],
    outputType = "json",
    flow = null,
    task = null,
    ...args
} = {}) {
    try {
        const swarmArrangement = new SwarmRearrange({ name, description, swarms, outputType, flow });
        const result = await swarmArrangement.run(task, ...args);
        logger.info(`Swarm arrangement ${name} executed successfully with output type ${outputType}.`);
        return result;
    } catch (error) {
        logger.error(`An error occurred during swarm arrangement execution: ${error.message}`);
        return error.message;
    }
}

// Example usage (commented out):
/*
import { SwarmRearrange, swarmArrange } from './swarm_arange.mjs';

const exampleSwarm1 = {
    name: 'ExampleSwarm1',
    run: async (task) => {
        console.log(`ExampleSwarm1 running task: ${task}`);
        return `Result from ExampleSwarm1 for task: ${task}`;
    }
};

const exampleSwarm2 = {
    name: 'ExampleSwarm2',
    run: async (task) => {
        console.log(`ExampleSwarm2 running task: ${task}`);
        return `Result from ExampleSwarm2 for task: ${task}`;
    }
};

const swarms = [exampleSwarm1, exampleSwarm2];
const flow = 'ExampleSwarm1->ExampleSwarm2';

const result = await swarmArrange({
    name: 'ExampleSwarmArrange',
    description: 'An example swarm arrangement',
    swarms,
    flow,
    task: 'Initial task'
});

console.log(result);
*/