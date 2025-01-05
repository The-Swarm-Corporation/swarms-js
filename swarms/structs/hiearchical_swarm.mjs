import { Agent } from './agent.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { concatStrings } from './concat.mjs';
import { AgentRegistry } from './agent_registry.mjs';
import { Conversation } from './conversation.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('hiearchical_swarm');

const HIEARCHICAL_AGENT_SYSTEM_PROMPT = `
Here's a full-fledged system prompt for a director boss agent, complete with instructions and many-shot examples:

---

**System Prompt: Director Boss Agent**

### Role:
You are a Director Boss Agent responsible for orchestrating a swarm of worker agents. Your primary duty is to serve the user efficiently, effectively, and skillfully. You dynamically create new agents when necessary or utilize existing agents, assigning them tasks that align with their capabilities. You must ensure that each agent receives clear, direct, and actionable instructions tailored to their role.

### Key Responsibilities:
1. **Task Delegation:** Assign tasks to the most relevant agent. If no relevant agent exists, create a new one with an appropriate name and system prompt.
2. **Efficiency:** Ensure that tasks are completed swiftly and with minimal resource expenditure.
3. **Clarity:** Provide orders that are simple, direct, and actionable. Avoid ambiguity.
4. **Dynamic Decision Making:** Assess the situation and choose the most effective path, whether that involves using an existing agent or creating a new one.
5. **Monitoring:** Continuously monitor the progress of each agent and provide additional instructions or corrections as necessary.

### Instructions:
- **Identify the Task:** Analyze the input task to determine its nature and requirements.
- **Agent Selection/Creation:**
  - If an agent is available and suited for the task, assign the task to that agent.
  - If no suitable agent exists, create a new agent with a relevant system prompt.
- **Task Assignment:** Provide the selected agent with explicit and straightforward instructions.
- **Reasoning:** Justify your decisions when selecting or creating agents, focusing on the efficiency and effectiveness of task completion.
`;

/**
 * A class representing the specifications of an agent.
 */
class AgentSpec {
    constructor({
        agentName,
        systemPrompt,
        agentDescription,
        task
    }) {
        this.agentName = agentName;
        this.systemPrompt = systemPrompt;
        this.agentDescription = agentDescription;
        this.task = task;
    }
}

/**
 * Schema to send orders to the agents
 */
class HierarchicalOrderCall {
    constructor({
        agentName,
        task
    }) {
        this.agentName = agentName;
        this.task = task;
    }
}

/**
 * A class representing the specifications of a swarm of agents.
 */
class SwarmSpec {
    constructor({
        swarmName,
        multipleAgents,
        rules,
        plan
    }) {
        this.swarmName = swarmName;
        this.multipleAgents = multipleAgents.map(agent => new AgentSpec(agent));
        this.rules = rules;
        this.plan = plan;
    }
}

/**
 * A class to create and manage a hierarchical swarm of agents.
 */
export class HierarchicalAgentSwarm extends BaseSwarm {
    constructor({
        name = "HierarchicalAgentSwarm",
        description = "A swarm of agents that can be used to distribute tasks to a team of agents.",
        director = null,
        agents = [],
        maxLoops = 1,
        createAgentsOn = false,
        templateWorkerAgent = null,
        directorPlanningPrompt = null,
        templateBaseWorkerLlm = null,
        swarmHistory = null,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.name = name;
        this.description = description;
        this.director = director;
        this.agents = agents;
        this.maxLoops = maxLoops;
        this.createAgentsOn = createAgentsOn;
        this.templateWorkerAgent = templateWorkerAgent;
        this.directorPlanningPrompt = directorPlanningPrompt;
        this.templateBaseWorkerLlm = templateBaseWorkerLlm;
        this.swarmHistory = swarmHistory;

        this.agentsCheck();
        this.agentRegistry = new AgentRegistry();
        this.addAgentsIntoRegistry(this.agents);
        this.conversation = new Conversation({ timeEnabled: true });
        this.swarmHistory = this.conversation.returnHistoryAsString();
    }

    agentsCheck() {
        if (!this.director) {
            throw new Error("The director is not set.");
        }

        if (!this.agents.length) {
            this.createAgentsOn = true;
        }

        if (this.agents.length) {
            this.director.baseModel = SwarmSpec;
            this.director.systemPrompt = HIEARCHICAL_AGENT_SYSTEM_PROMPT;
        }

        if (!this.maxLoops) {
            throw new Error("The max_loops is not set.");
        }
    }

    addAgentsIntoRegistry(agents) {
        agents.forEach(agent => this.agentRegistry.add(agent));
    }

    createAgent({
        agentName,
        systemPrompt,
        agentDescription,
        task = null
    }) {
        logger.info(`Creating agent: ${agentName}`);

        const agent = new Agent({
            agentName,
            llm: this.templateBaseWorkerLlm,
            systemPrompt,
            agentDescription,
            retryAttempts: 1,
            verbose: false,
            dashboard: false
        });

        this.agents.push(agent);
        logger.info(`Running agent: ${agentName} on task: ${task}`);
        const output = agent.run(task);
        this.conversation.add({ role: agentName, content: output });
        return output;
    }

    parseJsonForAgentsThenCreateAgents(functionCall) {
        const responses = [];
        logger.info("Parsing JSON for agents");

        if (this.createAgentsOn) {
            functionCall.multipleAgents.forEach(agent => {
                const out = this.createAgent(agent);
                responses.push(out);
            });
        } else {
            functionCall.orders.forEach(agent => {
                const out = this.runWorkerAgent(agent);
                responses.push(out);
            });
        }

        return concatStrings(responses);
    }

    run(task) {
        logger.info("Running the swarm");
        const functionCall = this.model.run(task);
        this.conversation.add({ role: "Director", content: String(functionCall) });
        this.logDirectorFunctionCall(functionCall);
        return this.parseJsonForAgentsThenCreateAgents(functionCall);
    }

    runNew(task) {
        logger.info("Running the swarm");
        const functionCall = this.model.run(task);
        this.conversation.add({ role: "Director", content: String(functionCall) });
        this.logDirectorFunctionCall(functionCall);

        if (this.createAgentsOn) {
            this.createAgentsFromFuncCall(functionCall);
            this.director.baseModel = SwarmSpec;
            const ordersPrompt = `Now, the agents have been created. Submit orders to the agents to enable them to complete the task: ${task}: ${this.listAgentsAvailable()}`;
            const orders = this.director.run(ordersPrompt);
            this.conversation.add({ role: "Director", content: String(ordersPrompt + orders) });
            return this.distributeOrdersToAgents(this.checkAgentOutputType(orders));
        }
    }

    checkAgentOutputType(response) {
        if (typeof response === 'object') return response;
        if (typeof response === 'string') return JSON.parse(response);
        return response;
    }

    distributeOrdersToAgents(orderDict) {
        const responses = [];
        orderDict.orders.forEach(order => {
            const response = this.runWorkerAgent(order);
            const log = `Agent: ${order.agentName} completed task: ${order.task} with response: ${response}`;
            this.conversation.add({ role: order.agentName, content: order.task + response });
            responses.push(log);
            logger.info(log);
        });
        return concatStrings(responses);
    }

    createSingleAgent({ name, systemPrompt, description }) {
        const agent = new Agent({
            agentName: name,
            llm: this.templateBaseWorkerLlm,
            systemPrompt,
            agentDescription: description,
            maxLoops: 1,
            retryAttempts: 1,
            verbose: false,
            dashboard: false
        });

        this.agents.push(agent);
        return agent;
    }

    createAgentsFromFuncCall(functionCall) {
        logger.info("Creating agents from the function call");
        functionCall.multipleAgents.forEach(agentSpec => {
            const agent = this.createSingleAgent(agentSpec);
            logger.info(`Created agent: ${agent.agentName} with description: ${agent.description}`);
            this.agents.push(agent);
        });
    }

    plan(task) {
        logger.info("Director is planning the task");
        this.director.systemPrompt = this.directorPlanningPrompt;
    }

    logDirectorFunctionCall(functionCall) {
        logger.info(`Swarm Name: ${functionCall.swarmName}`);
        logger.info(`Plan: ${functionCall.plan}`);
        logger.info(`Number of agents: ${functionCall.multipleAgents.length}`);
        functionCall.multipleAgents.forEach(agent => {
            logger.info(`Agent: ${agent.agentName}`);
            logger.info(`Description: ${agent.agentDescription}`);
        });
    }

    runWorkerAgent({ name, task, ...args }) {
        try {
            const agent = this.findAgentByName(name);
            return agent.run(task, ...args);
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    listAgents() {
        logger.info("Listing agents available in the swarm");
        this.agents.forEach(agent => {
            const name = agent.agentName;
            const description = agent.description || "No description available.";
            logger.info(`Agent: ${name}, Description: ${description}`);
        });
    }

    listAgentsAvailable() {
        const numberOfAgentsAvailable = this.agents.length;
        const agentList = this.agents.map(agent => `Agent ${agent.agentName}: Description ${agent.description}`).join('\n');
        return `There are currently ${numberOfAgentsAvailable} agents available in the swarm.\n\nAgents Available:\n${agentList}`;
    }

    findAgentByName(agentName) {
        return this.agents.find(agent => agent.name === agentName) || null;
    }
}

// Example usage (commented out):
/*
const exampleSwarm = new HierarchicalAgentSwarm({
    name: "ExampleSwarm",
    description: "A swarm of specialized AI agents collaborating on various tasks",
    director: new Agent({ agentName: "Director", systemPrompt: HIEARCHICAL_AGENT_SYSTEM_PROMPT }),
    templateBaseWorkerLlm: new OpenAIChat({ modelName: "gpt-4", apiKey: process.env.OPENAI_API_KEY }),
    maxLoops: 3
});

exampleSwarm.run("Analyze the financial statements of a potential acquisition target and identify key growth drivers.");
*/