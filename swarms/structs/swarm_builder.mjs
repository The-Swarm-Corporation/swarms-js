import { config } from 'dotenv';
import { OpenAIFunctionCaller, OpenAIChat } from '../models/openai.mjs';
import { Agent } from './agent.mjs';
import { SwarmRouter } from './swarm_router.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarm_builder');

const BOSS_SYSTEM_PROMPT = `
Manage a swarm of worker agents to efficiently serve the user by deciding whether to create new agents or delegate tasks. Ensure operations are efficient and effective.

### Instructions:

1. **Task Assignment**:
   - Analyze available worker agents when a task is presented.
   - Delegate tasks to existing agents with clear, direct, and actionable instructions if an appropriate agent is available.
   - If no suitable agent exists, create a new agent with a fitting system prompt to handle the task.

2. **Agent Creation**:
   - Name agents according to the task they are intended to perform (e.g., "Twitter Marketing Agent").
   - Provide each new agent with a concise and clear system prompt that includes its role, objectives, and any tools it can utilize.

3. **Efficiency**:
   - Minimize redundancy and maximize task completion speed.
   - Avoid unnecessary agent creation if an existing agent can fulfill the task.

4. **Communication**:
   - Be explicit in task delegation instructions to avoid ambiguity and ensure effective task execution.
   - Require agents to report back on task completion or encountered issues.

5. **Reasoning and Decisions**:
   - Offer brief reasoning when selecting or creating agents to maintain transparency.
   - Avoid using an agent if unnecessary, with a clear explanation if no agents are suitable for a task.

# Output Format

Present your plan in clear, bullet-point format or short concise paragraphs, outlining task assignment, agent creation, efficiency strategies, and communication protocols.

# Notes

- Preserve transparency by always providing reasoning for task-agent assignments and creation.
- Ensure instructions to agents are unambiguous to minimize error.
`;

/**
 * Configuration for an individual agent in a swarm
 */
class AgentConfig {
    constructor({ name, description, systemPrompt }) {
        this.name = name;
        this.description = description;
        this.systemPrompt = systemPrompt;
    }
}

/**
 * Configuration for a swarm of cooperative agents
 */
class SwarmConfig {
    constructor({ name, description, agents, maxLoops }) {
        this.name = name;
        this.description = description;
        this.agents = agents.map(agent => new AgentConfig(agent));
        this.maxLoops = maxLoops;
    }
}

// Get the OpenAI API key from the environment variable
config();
const apiKey = process.env.OPENAI_API_KEY;

// Create an instance of the OpenAIChat class
const model = new OpenAIChat({
    openaiApiKey: apiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.1
});

/**
 * A class that automatically builds and manages swarms of AI agents.
 */
export class AutoSwarmBuilder {
    /**
     * @param {string} name - The name of the swarm
     * @param {string} description - A description of the swarm's purpose
     * @param {boolean} verbose - Whether to output detailed logs
     * @param {number} maxLoops - Maximum number of execution loops
     */
    constructor({
        name = null,
        description = null,
        verbose = true,
        maxLoops = 1
    } = {}) {
        this.name = name;
        this.description = description;
        this.verbose = verbose;
        this.maxLoops = maxLoops;
        this.agentsPool = [];
        logger.info(`Initialized AutoSwarmBuilder: ${name} ${description}`);
    }

    /**
     * Run the swarm on a given task.
     * @param {string} task - The task to be accomplished
     * @param {string} [imageUrl=null] - URL of an image input if needed
     * @returns {Promise<any>} The output from the swarm's execution
     */
    async run(task, imageUrl = null, ...args) {
        logger.info(`Running swarm on task: ${task}`);
        const agents = await this._createAgents(task, imageUrl, ...args);
        logger.info(`Agents created ${agents.length}`);
        logger.info("Routing task through swarm");
        const output = await this.swarmRouter(agents, task, imageUrl);
        logger.info(`Swarm execution complete with output: ${output}`);
        return output;
    }

    /**
     * Create the necessary agents for a task.
     * @param {string} task - The task to create agents for
     * @returns {Promise<Array<Agent>>} List of created agents
     */
    async _createAgents(task, ...args) {
        logger.info("Creating agents for task");
        const model = new OpenAIFunctionCaller({
            systemPrompt: BOSS_SYSTEM_PROMPT,
            apiKey: process.env.OPENAI_API_KEY,
            temperature: 0.1,
            baseModel: SwarmConfig
        });

        const agentsDictionary = await model.run(task);
        logger.info(`Agents dictionary: ${JSON.stringify(agentsDictionary)}`);

        const agentsConfig = new SwarmConfig(agentsDictionary);

        this.name = agentsConfig.name;
        this.description = agentsConfig.description;
        this.maxLoops = agentsConfig.maxLoops;

        logger.info(`Swarm config: ${this.name}, ${this.description}, ${this.maxLoops}`);

        const agents = agentsConfig.agents.map(agentConfig => 
            this.buildAgent(agentConfig)
        );

        return agents;
    }

    /**
     * Build a single agent with the given specifications.
     * @param {AgentConfig} agentConfig - Configuration for the agent
     * @returns {Agent} The constructed agent instance
     */
    buildAgent(agentConfig) {
        logger.info(`Building agent: ${agentConfig.name}`);
        const agent = new Agent({
            agentName: agentConfig.name,
            description: agentConfig.description,
            systemPrompt: agentConfig.systemPrompt,
            llm: model,
            maxLoops: this.maxLoops,
            autosave: true,
            dashboard: false,
            verbose: true,
            dynamicTemperatureEnabled: true,
            savedStatePath: `${agentConfig.name}.json`,
            userName: "swarms_corp",
            retryAttempts: 1,
            contextLength: 200000,
            returnStepMeta: false,
            outputType: "str",
            streamingOn: false,
            autoGeneratePrompt: true
        });

        return agent;
    }

    /**
     * Route tasks between agents in the swarm.
     * @param {Array<Agent>} agents - List of available agents
     * @param {string} task - The task to route
     * @param {string} [imageUrl=null] - URL of an image input if needed
     * @returns {Promise<any>} The output from the routed task execution
     */
    async swarmRouter(agents, task, imageUrl = null, ...args) {
        logger.info("Routing task through swarm");
        const swarmRouterInstance = new SwarmRouter({
            name: this.name,
            description: this.description,
            agents,
            swarmType: "auto",
            maxLoops: 1
        });

        return await swarmRouterInstance.run(`${this.name} ${this.description} ${task}`);
    }
}

// Example usage (commented out):
/*
const example = new AutoSwarmBuilder({
    name: "ChipDesign-Swarm",
    description: "A swarm of specialized AI agents collaborating on chip architecture, logic design, verification, and optimization to create novel semiconductor designs",
    maxLoops: 1
});

example.run(
    "Design a new AI accelerator chip optimized for transformer model inference. Consider the following aspects: 1) Overall chip architecture and block diagram 2) Memory hierarchy and interconnects 3) Processing elements and data flow 4) Power and thermal considerations 5) Physical layout recommendations"
).then(output => {
    console.log(output);
}).catch(console.error);
*/