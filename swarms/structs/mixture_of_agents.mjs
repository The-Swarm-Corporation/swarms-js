import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { logAgentData } from '../telemetry/capture_sys_data.mjs';

const logger = initializeLogger('mixture_of_agents');

const timeStamp = new Date().toISOString();

/**
 * Input configuration for MixtureOfAgents
 */
class MixtureOfAgentsInput {
    constructor({
        name = "MixtureOfAgents",
        description = "A class to run a mixture of agents and aggregate their responses.",
        agents = [],
        aggregatorAgent = null,
        aggregatorSystemPrompt = "",
        layers = 3,
        timeCreated = timeStamp
    }) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.aggregatorAgent = aggregatorAgent;
        this.aggregatorSystemPrompt = aggregatorSystemPrompt;
        this.layers = layers;
        this.timeCreated = timeCreated;
    }
}

/**
 * Output schema for MixtureOfAgents
 */
class MixtureOfAgentsOutput {
    constructor({
        id = "MixtureOfAgents",
        task = "",
        inputConfig,
        normalAgentOutputs = [],
        aggregatorAgentSummary = "",
        timeCompleted = timeStamp
    }) {
        this.id = id;
        this.task = task;
        this.inputConfig = inputConfig;
        this.normalAgentOutputs = normalAgentOutputs;
        this.aggregatorAgentSummary = aggregatorAgentSummary;
        this.timeCompleted = timeCompleted;
    }
}

/**
 * A class to manage and run a mixture of agents, aggregating their responses.
 */
export class MixtureOfAgents {
    constructor({
        name = "MixtureOfAgents",
        description = "A class to run a mixture of agents and aggregate their responses.",
        agents = [],
        aggregatorAgent = null,
        aggregatorSystemPrompt = "",
        layers = 3
    } = {}) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.aggregatorAgent = aggregatorAgent;
        this.aggregatorSystemPrompt = aggregatorSystemPrompt;
        this.layers = layers;

        this.inputSchema = new MixtureOfAgentsInput({
            name,
            description,
            agents: agents.map(agent => agent.toDict()),
            aggregatorAgent: aggregatorAgent.toDict(),
            aggregatorSystemPrompt,
            layers,
            timeCreated: timeStamp
        });

        this.outputSchema = new MixtureOfAgentsOutput({
            inputConfig: this.inputSchema
        });

        this.reliabilityCheck();
    }

    reliabilityCheck() {
        logger.info("Checking the reliability of the Mixture of Agents class.");

        if (!this.agents.length) {
            throw new Error("No reference agents provided.");
        }

        if (!this.aggregatorAgent) {
            throw new Error("No aggregator agent provided.");
        }

        if (!this.aggregatorSystemPrompt) {
            throw new Error("No aggregator system prompt provided.");
        }

        if (!this.layers) {
            throw new Error("No layers provided.");
        }

        if (this.layers < 1) {
            throw new Error("Layers must be greater than 0.");
        }

        logger.info("Reliability check passed.");
        logger.info("Mixture of Agents class is ready for use.");
    }

    _getFinalSystemPrompt(systemPrompt, results) {
        return `${systemPrompt}\n${results.map((element, i) => `${i + 1}. ${element}`).join('\n')}`;
    }

    async _runAgentAsync(agent, task, prevResponses = null) {
        this.outputSchema.task = task;

        if (prevResponses) {
            const systemPromptWithResponses = this._getFinalSystemPrompt(this.aggregatorSystemPrompt, prevResponses);
            agent.systemPrompt = systemPromptWithResponses;
        }

        const response = await agent.run(task);
        this.outputSchema.normalAgentOutputs.push(agent.agentOutput);

        logger.info(`Agent ${agent.agentName} response: ${response}`);
        return response;
    }

    async _runAsync(task) {
        let results = await Promise.all(this.agents.map(agent => this._runAgentAsync(agent, task)));

        for (let i = 1; i < this.layers - 1; i++) {
            results = await Promise.all(this.agents.map(agent => this._runAgentAsync(agent, task, results)));
        }

        const finalResult = await this._runAgentAsync(this.aggregatorAgent, task, results);
        this.outputSchema.aggregatorAgentSummary = finalResult;

        logger.info(`Final Aggregated Response: ${finalResult}`);
    }

    async run(task) {
        await this._runAsync(task);

        this.outputSchema.task = task;

        logAgentData(this.outputSchema);

        return JSON.stringify(this.outputSchema, null, 4);
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agents = [
    new Agent({ agentName: "Agent1", systemPrompt: "Prompt1" }),
    new Agent({ agentName: "Agent2", systemPrompt: "Prompt2" })
];

const aggregatorAgent = new Agent({ agentName: "Aggregator", systemPrompt: "Aggregator Prompt" });

const mixture = new MixtureOfAgents({
    agents,
    aggregatorAgent,
    aggregatorSystemPrompt: "Aggregator System Prompt",
    layers: 3
});

const task = "Analyze the financial statements of a potential acquisition target and identify key growth drivers.";
const result = await mixture.run(task);
console.log(result);
*/