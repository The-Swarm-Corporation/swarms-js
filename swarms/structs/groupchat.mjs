import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('groupchat');

/**
 * Agent response model
 */
class AgentResponse {
    constructor({
        agentName,
        role,
        message,
        timestamp = new Date(),
        turnNumber,
        precedingContext = []
    }) {
        this.agentName = agentName;
        this.role = role;
        this.message = message;
        this.timestamp = timestamp;
        this.turnNumber = turnNumber;
        this.precedingContext = precedingContext;
    }
}

/**
 * Chat turn model
 */
class ChatTurn {
    constructor({
        turnNumber,
        responses = [],
        task,
        timestamp = new Date()
    }) {
        this.turnNumber = turnNumber;
        this.responses = responses;
        this.task = task;
        this.timestamp = timestamp;
    }
}

/**
 * Chat history model
 */
class ChatHistory {
    constructor({
        turns = [],
        totalMessages = 0,
        name,
        description,
        startTime = new Date()
    }) {
        this.turns = turns;
        this.totalMessages = totalMessages;
        this.name = name;
        this.description = description;
        this.startTime = startTime;
    }
}

/**
 * Round robin speaker function.
 * Each agent speaks in turn, in a circular order.
 */
function roundRobin(history, agent) {
    return true;
}

/**
 * Expertise based speaker function.
 * An agent speaks if their system prompt is in the last message.
 */
function expertiseBased(history, agent) {
    return history.length ? history[history.length - 1].toLowerCase().includes(agent.systemPrompt.toLowerCase()) : true;
}

/**
 * Random selection speaker function.
 * An agent speaks randomly.
 */
function randomSelection(history, agent) {
    return Math.random() < 0.5;
}

/**
 * Custom speaker function with complex logic.
 */
function customSpeaker(history, agent) {
    if (!history.length) return true;

    const lastMessage = history[history.length - 1].toLowerCase();
    const expertiseRelevant = agent.description.toLowerCase().split(' ').some(keyword => lastMessage.includes(keyword));
    const mentioned = lastMessage.includes(agent.agentName.toLowerCase());
    const notRecentSpeaker = !history.slice(-3).some(msg => msg.includes(agent.agentName));

    return expertiseRelevant || mentioned || notRecentSpeaker;
}

/**
 * Most recent speaker function.
 * An agent speaks if they are the last speaker.
 */
function mostRecent(history, agent) {
    return history.length ? history[history.length - 1].startsWith(agent.agentName) : true;
}

/**
 * GroupChat class to enable multiple agents to communicate in a synchronous group chat.
 */
export class GroupChat {
    /**
     * @param {string} name - Name of the group chat
     * @param {string} description - Description of the purpose of the group chat
     * @param {Array<Agent>} agents - A list of agents participating in the chat
     * @param {Function} speakerFn - The function to determine which agent should speak next
     * @param {number} maxLoops - Maximum number of turns in the chat
     */
    constructor({
        name = "GroupChat",
        description = "A group chat for multiple agents",
        agents = [],
        speakerFn = roundRobin,
        maxLoops = 10
    } = {}) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.speakerFn = speakerFn;
        this.maxLoops = maxLoops;
        this.chatHistory = new ChatHistory({
            name,
            description
        });
    }

    /**
     * Get the response from an agent synchronously.
     */
    async _getResponseSync(agent, prompt, turnNumber) {
        try {
            const chatInfo = `Chat Name: ${this.name}\nChat Description: ${this.description}\nAgents in Chat: ${this.agents.map(a => a.agentName).join(', ')}`;
            const context = `You are ${agent.agentName}\nConversation History:\n${chatInfo}\nOther agents: ${this.agents.filter(a => a !== agent).map(a => a.agentName).join(', ')}\nPrevious messages: ${this.getFullChatHistory()}`;
            const message = await agent.run(context + prompt);
            return new AgentResponse({
                agentName: agent.agentName,
                role: agent.systemPrompt,
                message,
                turnNumber,
                precedingContext: this.getRecentMessages(3)
            });
        } catch (error) {
            logger.error(`Error from ${agent.agentName}: ${error.message}`);
            return new AgentResponse({
                agentName: agent.agentName,
                role: agent.systemPrompt,
                message: `Error generating response: ${error.message}`,
                turnNumber,
                precedingContext: []
            });
        }
    }

    /**
     * Get the full chat history formatted for agent context.
     */
    getFullChatHistory() {
        return this.chatHistory.turns.flatMap(turn => turn.responses.map(response => `${response.agentName}: ${response.message}`)).join('\n');
    }

    /**
     * Get the most recent messages in the chat.
     */
    getRecentMessages(n = 3) {
        return this.chatHistory.turns.slice(-n).flatMap(turn => turn.responses.map(response => `${response.agentName}: ${response.message}`));
    }

    /**
     * Run the group chat.
     */
    async run(task) {
        try {
            logger.info(`Starting chat '${this.name}' with task: ${task}`);

            for (let turn = 0; turn < this.maxLoops; turn++) {
                const currentTurn = new ChatTurn({
                    turnNumber: turn,
                    task
                });

                for (const agent of this.agents) {
                    if (this.speakerFn(this.getRecentMessages(), agent)) {
                        const response = await this._getResponseSync(agent, task, turn);
                        currentTurn.responses.push(response);
                        this.chatHistory.totalMessages++;
                        logger.debug(`Turn ${turn, agent.agentName} responded`);
                    }
                }

                this.chatHistory.turns.push(currentTurn);
            }

            return this.chatHistory;
        } catch (error) {
            logger.error(`Error in chat: ${error.message}`);
            throw error;
        }
    }

    /**
     * Run the group chat with a batch of tasks.
     */
    async batchedRun(tasks) {
        return Promise.all(tasks.map(task => this.run(task)));
    }

    /**
     * Run the group chat with a batch of tasks concurrently using a thread pool.
     */
    async concurrentRun(tasks) {
        const results = await Promise.allSettled(tasks.map(task => this.run(task)));
        return results.map(result => result.value);
    }
}

// Example usage (commented out):
/*
import { config } from 'dotenv';
import { OpenAIChat } from '../models/openai.mjs';

config();
const apiKey = process.env.OPENAI_API_KEY;

// Create an instance of the OpenAIChat class
const model = new OpenAIChat({
    openaiApiKey: apiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.1
});

// Example agents
const agent1 = new Agent({
    agentName: "Financial-Analysis-Agent",
    systemPrompt: "You are a financial analyst specializing in investment strategies.",
    llm: model,
    maxLoops: 1,
    autosave: false,
    dashboard: false,
    verbose: true,
    dynamicTemperatureEnabled: true,
    userName: "swarms_corp",
    retryAttempts: 1,
    contextLength: 200000,
    outputType: "string",
    streamingOn: false
});

const agent2 = new Agent({
    agentName: "Tax-Adviser-Agent",
    systemPrompt: "You are a tax adviser who provides clear and concise guidance on tax-related queries.",
    llm: model,
    maxLoops: 1,
    autosave: false,
    dashboard: false,
    verbose: true,
    dynamicTemperatureEnabled: true,
    userName: "swarms_corp",
    retryAttempts: 1,
    contextLength: 200000,
    outputType: "string",
    streamingOn: false
});

const agents = [agent1, agent2];

const chat = new GroupChat({
    name: "Investment Advisory",
    description: "Financial and tax analysis group",
    agents,
    speakerFn: expertiseBased
});

const history = await chat.run("How to optimize tax strategy for investments?");
console.log(JSON.stringify(history, null, 2));
*/