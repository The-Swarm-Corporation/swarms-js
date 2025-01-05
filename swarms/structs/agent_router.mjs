import { ChromaClient } from 'chromadb';
import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('agent_router');

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
 * AgentRouter class for managing and routing between agents.
 */
export class AgentRouter {
    /**
     * Initialize the AgentRouter.
     * @param {string} collectionName - Name of the collection in the vector database
     * @param {string} persistDirectory - Directory to persist the vector database
     * @param {number} nAgents - Number of agents to return in queries
     * @param {...any} args - Additional arguments to pass to the chromadb Client
     */
    constructor(
        collectionName = "agents",
        persistDirectory = "./vector_db",
        nAgents = 1,
        ...args
    ) {
        this.collectionName = collectionName;
        this.nAgents = nAgents;
        this.persistDirectory = persistDirectory;
        this.client = new ChromaClient(...args);
        this.collection = null;
        this.agents = [];
        this.initializeCollection();
    }

    async initializeCollection() {
        try {
            this.collection = await this.client.createCollection({
                name: this.collectionName
            });
        } catch (error) {
            logger.error(`ChromaDB initialization error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add an agent to the vector database.
     * @param {Agent} agent - The agent to add
     */
    async addAgent(agent) {
        await retryWithBackoff(async () => {
            try {
                const agentText = `${agent.name} ${agent.description} ${agent.systemPrompt}`;
                await this.collection.add({
                    documents: [agentText],
                    metadatas: [{ name: agent.name }],
                    ids: [agent.name]
                });
                this.agents.push(agent);
                logger.info(`Added agent ${agent.name} to the vector database.`);
            } catch (error) {
                logger.error(`Error adding agent ${agent.name}: ${error.message}`);
                throw error;
            }
        });
    }

    /**
     * Add multiple agents to the vector database.
     * @param {Array<Agent>} agents - List of agents to add
     */
    async addAgents(agents) {
        for (const agent of agents) {
            await this.addAgent(agent);
        }
    }

    /**
     * Update agent's history in the vector database
     * @param {string} agentName - The name of the agent to update
     */
    async updateAgentHistory(agentName) {
        const agent = this.agents.find(a => a.name === agentName);
        if (agent) {
            const history = agent.shortMemory.returnHistoryAsString();
            const historyText = history.join(' ');
            const updatedText = `${agent.name} ${agent.description} ${agent.systemPrompt} ${historyText}`;

            await this.collection.update({
                ids: [agentName],
                documents: [updatedText],
                metadatas: [{ name: agentName }]
            });
            logger.info(`Updated agent ${agentName} with interaction history.`);
        } else {
            logger.warning(`Agent ${agentName} not found in the database.`);
        }
    }

    /**
     * Find the best agent for a given task
     * @param {string} task - The task description
     * @param {...any} args - Additional query arguments
     * @returns {Promise<Agent|null>} The best matching agent
     */
    async findBestAgent(task, ...args) {
        return retryWithBackoff(async () => {
            try {
                const results = await this.collection.query({
                    queryTexts: [task],
                    nResults: this.nAgents,
                    ...args
                });

                if (results.ids?.[0]?.length > 0) {
                    const bestMatchName = results.ids[0][0];
                    const bestAgent = this.agents.find(a => a.name === bestMatchName);
                    
                    if (bestAgent) {
                        logger.info(`Found best matching agent: ${bestMatchName}`);
                        return bestAgent;
                    }
                    logger.warning(`Agent ${bestMatchName} found in index but not in agents list.`);
                } else {
                    logger.warning('No matching agent found for the given task.');
                }
                return null;
            } catch (error) {
                logger.error(`Error finding best agent: ${error.message}`);
                throw error;
            }
        });
    }
}

// Example usage (commented out):
/*
import { config } from 'dotenv';
import { OpenAIChat } from '../models/openai.mjs';

const runExample = async () => {
    config();
    const apiKey = process.env.GROQ_API_KEY;

    // Initialize model
    const model = new OpenAIChat({
        openaiApiBase: "https://api.groq.com/openai/v1",
        openaiApiKey: apiKey,
        modelName: "llama-3.1-70b-versatile",
        temperature: 0.1
    });

    // Initialize vector database
    const vectorDb = new AgentRouter();

    // Define specialized system prompts
    const DATA_EXTRACTOR_PROMPT = `You are a highly specialized private equity agent focused on data extraction from various documents...`;
    
    // Initialize agent
    const dataExtractorAgent = new Agent({
        agentName: "Data-Extractor",
        systemPrompt: DATA_EXTRACTOR_PROMPT,
        llm: model,
        maxLoops: 1,
        autosave: true,
        verbose: true,
        dynamicTemperatureEnabled: true,
        savedStatePath: "data_extractor_agent.json",
        userName: "pe_firm",
        retryAttempts: 1,
        contextLength: 200000,
        outputType: "string"
    });

    // Add agent to database
    await vectorDb.addAgent(dataExtractorAgent);

    // Example task
    const task = "Analyze the financial statements of a potential acquisition target and identify key growth drivers.";
    const bestAgent = await vectorDb.findBestAgent(task);

    if (bestAgent) {
        logger.info(`Best agent for the task: ${bestAgent.name}`);
        const result = await bestAgent.run(task);
        console.log(`Task result: ${result}`);
        await vectorDb.updateAgentHistory(bestAgent.name);
    } else {
        console.log("No suitable agent found for the task.");
    }
};

// Only run if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    runExample().catch(console.error);
}
*/