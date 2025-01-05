import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { OpenAIFunctionCaller } from '../models/openai.mjs';

const logger = initializeLogger('multi_agent_orchestrator');

/**
 * Response from the boss agent indicating which agent should handle the task
 */
class AgentResponse {
    constructor({
        selectedAgent,
        reasoning,
        modifiedTask = null
    }) {
        this.selectedAgent = selectedAgent;
        this.reasoning = reasoning;
        this.modifiedTask = modifiedTask;
    }
}

/**
 * MultiAgentRouter class for managing and routing tasks to appropriate agents.
 */
export class MultiAgentRouter {
    constructor({
        name = "swarm-router",
        description = "Routes tasks to specialized agents based on their capabilities",
        agents = [],
        model = "gpt-4o-mini",
        temperature = 0.1,
        sharedMemorySystem = null,
        outputType = "json",
        executeTask = true
    } = {}) {
        this.name = name;
        this.description = description;
        this.sharedMemorySystem = sharedMemorySystem;
        this.agents = new Map(agents.map(agent => [agent.agentName, agent]));
        this.apiKey = process.env.OPENAI_API_KEY;
        if (!this.apiKey) {
            throw new Error("OpenAI API key must be provided");
        }
        this.outputType = outputType;
        this.executeTask = executeTask;
        this.bossSystemPrompt = this._createBossSystemPrompt();

        this.functionCaller = new OpenAIFunctionCaller({
            systemPrompt: this.bossSystemPrompt,
            apiKey: this.apiKey,
            temperature,
            modelName: model
        });
    }

    _createBossSystemPrompt() {
        const agentDescriptions = Array.from(this.agents.values())
            .map(agent => `- ${agent.agentName}: ${agent.description}`)
            .join('\n');

        return `You are a boss agent responsible for routing tasks to the most appropriate specialized agent.
        Available agents:
        ${agentDescriptions}

        Your job is to:
        1. Analyze the incoming task
        2. Select the most appropriate agent based on their descriptions
        3. Provide clear reasoning for your selection
        4. Optionally modify the task to better suit the selected agent's capabilities

        You must respond with JSON that contains:
        - selectedAgent: Name of the chosen agent (must be one of the available agents)
        - reasoning: Brief explanation of why this agent was selected
        - modifiedTask: (Optional) A modified version of the task if needed

        Always select exactly one agent that best matches the task requirements.`;
    }

    async routeTask(task) {
        try {
            const startTime = new Date();

            const bossResponse = await this.functionCaller.getCompletion(task);
            const { selectedAgent, reasoning, modifiedTask } = bossResponse;

            if (!this.agents.has(selectedAgent)) {
                throw new Error(`Boss selected unknown agent: ${selectedAgent}`);
            }

            const agent = this.agents.get(selectedAgent);
            const finalTask = modifiedTask || task;

            let agentResponse = null;
            let executionTime = 0;

            if (this.executeTask) {
                const executionStart = new Date();
                agentResponse = await agent.run(finalTask);
                executionTime = (new Date() - executionStart) / 1000;
            }

            const totalTime = (new Date() - startTime) / 1000;

            return {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                task: {
                    original: task,
                    modified: modifiedTask || null
                },
                bossDecision: {
                    selectedAgent,
                    reasoning
                },
                execution: {
                    agentName: agent.agentName,
                    agentId: agent.id,
                    wasExecuted: this.executeTask,
                    response: agentResponse,
                    executionTime
                },
                totalTime
            };
        } catch (error) {
            logger.error(`Error routing task: ${error.message}`);
            throw error;
        }
    }

    async batchRoute(tasks = []) {
        const results = [];
        for (const task of tasks) {
            try {
                const result = await this.routeTask(task);
                results.push(result);
            } catch (error) {
                logger.error(`Error routing task: ${error.message}`);
            }
        }
        return results;
    }

    async concurrentBatchRoute(tasks = []) {
        const results = [];
        const promises = tasks.map(task => this.routeTask(task).catch(error => {
            logger.error(`Error routing task: ${error.message}`);
            return null;
        }));
        const resolvedResults = await Promise.all(promises);
        results.push(...resolvedResults.filter(result => result !== null));
        return results;
    }
}

// Example usage (commented out):
/*
import { config } from 'dotenv';
import { OpenAIChat } from '../models/openai.mjs';

const runExample = async () => {
    config();
    const apiKey = process.env.OPENAI_API_KEY;

    const model = new OpenAIChat({
        openaiApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0.1
    });

    const agents = [
        new Agent({
            agentName: "ResearchAgent",
            description: "Specializes in researching topics and providing detailed, factual information",
            systemPrompt: "You are a research specialist. Provide detailed, well-researched information about any topic, citing sources when possible.",
            llm: model
        }),
        new Agent({
            agentName: "CodeExpertAgent",
            description: "Expert in writing, reviewing, and explaining code across multiple programming languages",
            systemPrompt: "You are a coding expert. Write, review, and explain code with a focus on best practices and clean code principles.",
            llm: model
        }),
        new Agent({
            agentName: "WritingAgent",
            description: "Skilled in creative and technical writing, content creation, and editing",
            systemPrompt: "You are a writing specialist. Create, edit, and improve written content while maintaining appropriate tone and style.",
            llm: model
        })
    ];

    const router = new MultiAgentRouter({ agents, executeTask: true });

    const task = "Write a Python function to calculate fibonacci numbers";
    const result = await router.routeTask(task);

    console.log(`Selected Agent: ${result.bossDecision.selectedAgent}`);
    console.log(`Reasoning: ${result.bossDecision.reasoning}`);
    if (result.execution.response) {
        console.log(`Response Preview: ${result.execution.response.slice(0, 200)}...`);
        console.log(`Execution Time: ${result.execution.executionTime}s`);
    }
    console.log(`Total Time: ${result.totalTime}s`);
};

// Only run if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    runExample().catch(console.error);
}
*/