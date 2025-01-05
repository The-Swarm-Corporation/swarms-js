import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarming_architectures');

/**
 * Agent log model for structured data
 */
class AgentLog {
    constructor({ agentName, task, response }) {
        this.agentName = agentName;
        this.task = task;
        this.response = response;
    }
}

/**
 * Conversation model for logging agent interactions
 */
class Conversation {
    constructor() {
        this.logs = [];
    }

    addLog(agentName, task, response) {
        const logEntry = new AgentLog({ agentName, task, response });
        this.logs.push(logEntry);
        logger.info(`Agent: ${agentName} | Task: ${task} | Response: ${response}`);
    }

    returnHistory() {
        return {
            history: this.logs.map(log => ({
                agentName: log.agentName,
                task: log.task,
                response: log.response
            }))
        };
    }
}

/**
 * Implements a circular swarm where agents pass tasks in a circular manner.
 */
export function circularSwarm(agents, tasks, returnFullHistory = true) {
    if (!agents.length || !tasks.length) {
        throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation();
    const responses = [];

    for (const task of tasks) {
        for (const agent of agents) {
            const response = agent.run(task);
            conversation.addLog(agent.agentName, task, response);
            responses.push(response);
        }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
}

/**
 * Implements a grid swarm where agents process tasks in a grid manner.
 */
export function gridSwarm(agents, tasks) {
    const gridSize = Math.floor(Math.sqrt(agents.length));
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (tasks.length) {
                const task = tasks.shift();
                agents[i * gridSize + j].run(task);
            }
        }
    }
}

/**
 * Implements a linear swarm where agents process tasks sequentially.
 */
export function linearSwarm(agents, tasks, returnFullHistory = true) {
    if (!agents.length || !tasks.length) {
        throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation();
    const responses = [];

    for (const agent of agents) {
        if (tasks.length) {
            const task = tasks.shift();
            const response = agent.run(task);
            conversation.addLog(agent.agentName, task, response);
            responses.push(response);
        }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
}

/**
 * Implements a star swarm where a central agent processes all tasks first.
 */
export function starSwarm(agents, tasks, returnFullHistory = true) {
    if (!agents.length || !tasks.length) {
        throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation();
    const centerAgent = agents[0];
    const responses = [];

    for (const task of tasks) {
        const centerResponse = centerAgent.run(task);
        conversation.addLog(centerAgent.agentName, task, centerResponse);
        responses.push(centerResponse);

        for (const agent of agents.slice(1)) {
            const response = agent.run(task);
            conversation.addLog(agent.agentName, task, response);
            responses.push(response);
        }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
}

/**
 * Implements a mesh swarm where agents work on tasks randomly from a task queue.
 */
export function meshSwarm(agents, tasks, returnFullHistory = true) {
    if (!agents.length || !tasks.length) {
        throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation();
    const taskQueue = [...tasks];
    const responses = [];

    while (taskQueue.length) {
        for (const agent of agents) {
            if (taskQueue.length) {
                const task = taskQueue.shift();
                const response = agent.run(task);
                conversation.addLog(agent.agentName, task, response);
                responses.push(response);
            }
        }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
}

/**
 * Implements a pyramid swarm where agents are arranged in a pyramid structure.
 */
export function pyramidSwarm(agents, tasks, returnFullHistory = true) {
    if (!agents.length || !tasks.length) {
        throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation();
    const responses = [];
    const levels = Math.floor((-1 + Math.sqrt(1 + 8 * agents.length)) / 2);

    for (let i = 0; i < levels; i++) {
        for (let j = 0; j <= i; j++) {
            if (tasks.length) {
                const task = tasks.shift();
                const agentIndex = i * (i + 1) / 2 + j;
                const response = agents[agentIndex].run(task);
                conversation.addLog(agents[agentIndex].agentName, task, response);
                responses.push(response);
            }
        }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
}

/**
 * Implements a Fibonacci swarm where agents process tasks based on Fibonacci sequence.
 */
export function fibonacciSwarm(agents, tasks) {
    const fib = [1, 1];
    while (fib.length < agents.length) {
        fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
    }
    for (let i = 0; i < fib.length; i++) {
        for (let j = 0; j < fib[i]; j++) {
            if (tasks.length) {
                const task = tasks.shift();
                agents[sum(fib.slice(0, i)) + j].run(task);
            }
        }
    }
}

/**
 * Implements a prime swarm where agents process tasks based on prime numbers.
 */
export function primeSwarm(agents, tasks) {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    for (const prime of primes) {
        if (prime < agents.length && tasks.length) {
            const task = tasks.shift();
            agents[prime].run(task);
        }
    }
}

/**
 * Implements a power swarm where agents process tasks based on powers of 2.
 */
export function powerSwarm(agents, tasks) {
    const powers = Array.from({ length: Math.floor(Math.sqrt(agents.length)) }, (_, i) => 2 ** i);
    for (const power of powers) {
        if (power < agents.length && tasks.length) {
            const task = tasks.shift();
            agents[power].run(task);
        }
    }
}

/**
 * Implements a logarithmic swarm where agents process tasks based on logarithmic scale.
 */
export function logSwarm(agents, tasks) {
    for (let i = 0; i < agents.length; i++) {
        if (2 ** i < agents.length && tasks.length) {
            const task = tasks.shift();
            agents[2 ** i].run(task);
        }
    }
}

/**
 * Implements an exponential swarm where agents process tasks based on exponential scale.
 */
export function exponentialSwarm(agents, tasks) {
    for (let i = 0; i < agents.length; i++) {
        const index = Math.min(2 ** i, agents.length - 1);
        if (tasks.length) {
            const task = tasks.shift();
            agents[index].run(task);
        }
    }
}

/**
 * Implements a geometric swarm where agents process tasks based on geometric progression.
 */
export function geometricSwarm(agents, tasks) {
    const ratio = 2;
    for (let i = 0; i < agents.length; i++) {
        const index = Math.min(ratio ** 2, agents.length - 1);
        if (tasks.length) {
            const task = tasks.shift();
            agents[index].run(task);
        }
    }
}

/**
 * Implements a harmonic swarm where agents process tasks based on harmonic series.
 */
export function harmonicSwarm(agents, tasks) {
    for (let i = 1; i <= agents.length; i++) {
        const index = Math.min(Math.floor(agents.length / i), agents.length - 1);
        if (tasks.length) {
            const task = tasks.shift();
            agents[index].run(task);
        }
    }
}

/**
 * Implements a staircase swarm where agents process tasks in a staircase pattern.
 */
export function staircaseSwarm(agents, task) {
    const step = Math.floor(agents.length / 5);
    for (let i = 0; i < agents.length; i++) {
        const index = Math.floor(i / step) * step;
        agents[index].run(task);
    }
}

/**
 * Implements a sigmoid swarm where agents process tasks based on sigmoid function.
 */
export function sigmoidSwarm(agents, task) {
    for (let i = 0; i < agents.length; i++) {
        const index = Math.floor(agents.length / (1 + Math.exp(-i)));
        agents[index].run(task);
    }
}

/**
 * Implements a sinusoidal swarm where agents process tasks based on sinusoidal function.
 */
export function sinusoidalSwarm(agents, task) {
    for (let i = 0; i < agents.length; i++) {
        const index = Math.floor((Math.sin(i) + 1) / 2 * agents.length);
        agents[index].run(task);
    }
}

/**
 * Facilitates one-to-one communication between two agents.
 */
export function oneToOne(sender, receiver, task, maxLoops = 1) {
    const conversation = new Conversation();
    const responses = [];

    try {
        for (let i = 0; i < maxLoops; i++) {
            const senderResponse = sender.run(task);
            conversation.addLog(sender.agentName, task, senderResponse);
            responses.push(senderResponse);

            const receiverResponse = receiver.run(senderResponse);
            conversation.addLog(receiver.agentName, task, receiverResponse);
            responses.push(receiverResponse);
        }
    } catch (error) {
        logger.error(`Error during oneToOne communication: ${error.message}`);
        throw error;
    }

    return conversation.returnHistory();
}

/**
 * Facilitates broadcast communication from one sender to multiple agents.
 */
export async function broadcast(sender, agents, task) {
    const conversation = new Conversation();

    if (!sender || !agents.length || !task) {
        throw new Error("Sender, agents, and task cannot be empty.");
    }

    try {
        const broadcastMessage = sender.run(task);
        conversation.addLog(sender.agentName, task, broadcastMessage);

        for (const agent of agents) {
            const response = agent.run(broadcastMessage);
            conversation.addLog(agent.agentName, broadcastMessage, response);
        }

        return conversation.returnHistory();
    } catch (error) {
        logger.error(`Error during broadcast: ${error.message}`);
        throw error;
    }
}

/**
 * Facilitates one-to-three communication from one sender to three agents.
 */
export async function oneToThree(sender, agents, task) {
    if (agents.length !== 3) {
        throw new Error("The number of agents must be exactly 3.");
    }

    if (!task || !sender) {
        throw new Error("Sender and task cannot be empty.");
    }

    const conversation = new Conversation();

    try {
        const senderMessage = sender.run(task);
        conversation.addLog(sender.agentName, task, senderMessage);

        for (const agent of agents) {
            const response = agent.run(senderMessage);
            conversation.addLog(agent.agentName, senderMessage, response);
        }

        return conversation.returnHistory();
    } catch (error) {
        logger.error(`Error in oneToThree: ${error.message}`);
        throw error;
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: "Agent1", description: "First agent" }),
    new Agent({ agentName: "Agent2", description: "Second agent" })
];

const tasks = ["Task1", "Task2"];

const result = circularSwarm(agents, tasks);
console.log(result);
*/