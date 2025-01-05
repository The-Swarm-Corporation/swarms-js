import { v4 as uuidv4 } from 'uuid';
import { Counter } from 'collections';
import { DateTime } from 'luxon';
import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { autoCheckAndDownloadPackage } from '../utils/auto_download_check_packages.mjs';
import { Conversation } from './conversation.mjs';

const logger = initializeLogger('tree_swarm');

/**
 * Pydantic Models for Logging
 */
class AgentLogInput {
    constructor({ agentName, task }) {
        this.logId = uuidv4();
        this.agentName = agentName;
        this.task = task;
        this.timestamp = DateTime.utc().toISO();
    }
}

class AgentLogOutput {
    constructor({ agentName, result }) {
        this.logId = uuidv4();
        this.agentName = agentName;
        this.result = result;
        this.timestamp = DateTime.utc().toISO();
    }
}

class TreeLog {
    constructor({ treeName, task, selectedAgent, result }) {
        this.logId = uuidv4();
        this.treeName = treeName;
        this.task = task;
        this.selectedAgent = selectedAgent;
        this.timestamp = DateTime.utc().toISO();
        this.result = result;
    }
}

/**
 * A simplified keyword extraction function using basic word splitting instead of NLTK tokenization.
 */
function extractKeywords(prompt, topN = 5) {
    const words = prompt.toLowerCase().split(/\W+/);
    const filteredWords = words.filter(word => word.length > 0);
    const wordCounts = new Counter(filteredWords);
    return wordCounts.mostCommon(topN).map(([word]) => word);
}

/**
 * A specialized Agent class that contains information about the system prompt's
 * locality and allows for dynamic chaining of agents in trees.
 */
class TreeAgent extends Agent {
    constructor({ name, description, systemPrompt, modelName = 'gpt-4o', agentName, ...args }) {
        super({ name, description, systemPrompt, modelName, agentName, ...args });

        try {
            this.sentenceTransformers = require('sentence-transformers');
        } catch (error) {
            autoCheckAndDownloadPackage('sentence-transformers', 'pip');
            this.sentenceTransformers = require('sentence-transformers');
        }

        this.embeddingModel = new this.sentenceTransformers.SentenceTransformer('all-MiniLM-L6-v2');
        this.systemPromptEmbedding = this.embeddingModel.encode(systemPrompt, { convertToTensor: true });
        this.relevantKeywords = extractKeywords(systemPrompt);
        this.distance = null;
    }

    calculateDistance(otherAgent) {
        const similarity = this.sentenceTransformers.util.pytorchCosSim(this.systemPromptEmbedding, otherAgent.systemPromptEmbedding).item();
        return 1 - similarity;
    }

    runTask(task, img = null, ...args) {
        const inputLog = new AgentLogInput({ agentName: this.agentName, task });
        logger.info(`Running task on ${this.agentName}: ${task}`);
        logger.debug(`Input Log: ${JSON.stringify(inputLog)}`);

        const result = this.run(task, img, ...args);

        const outputLog = new AgentLogOutput({ agentName: this.agentName, result });
        logger.info(`Task result from ${this.agentName}: ${result}`);
        logger.debug(`Output Log: ${JSON.stringify(outputLog)}`);

        return result;
    }

    isRelevantForTask(task, threshold = 0.7) {
        const keywordMatch = this.relevantKeywords.some(keyword => task.toLowerCase().includes(keyword.toLowerCase()));

        if (!keywordMatch) {
            const taskEmbedding = this.embeddingModel.encode(task, { convertToTensor: true });
            const similarity = this.sentenceTransformers.util.pytorchCosSim(this.systemPromptEmbedding, taskEmbedding).item();
            logger.info(`Semantic similarity between task and ${this.agentName}: ${similarity.toFixed(2)}`);
            return similarity >= threshold;
        }

        return true;
    }
}

/**
 * Initializes a tree of agents.
 */
class Tree {
    constructor(treeName, agents) {
        this.treeName = treeName;
        this.agents = agents;
        this.calculateAgentDistances();
    }

    calculateAgentDistances() {
        logger.info(`Calculating distances between agents in tree '${this.treeName}'`);
        this.agents.forEach((agent, i) => {
            agent.distance = i > 0 ? agent.calculateDistance(this.agents[i - 1]) : 0;
        });
        this.agents.sort((a, b) => a.distance - b.distance);
    }

    findRelevantAgent(task) {
        logger.info(`Searching relevant agent in tree '${this.treeName}' for task: ${task}`);
        return this.agents.find(agent => agent.isRelevantForTask(task)) || null;
    }

    logTreeExecution(task, selectedAgent, result) {
        const treeLog = new TreeLog({ treeName: this.treeName, task, selectedAgent: selectedAgent.agentName, result });
        logger.info(`Tree '${this.treeName}' executed task with agent '${selectedAgent.agentName}'`);
        logger.debug(`Tree Log: ${JSON.stringify(treeLog)}`);
    }
}

/**
 * Initializes the structure with multiple trees of agents.
 */
class ForestSwarm {
    constructor({ name = 'default-forest-swarm', description = 'Standard forest swarm', trees = [], sharedMemory = null, rules = null, ...args }) {
        this.name = name;
        this.description = description;
        this.trees = trees;
        this.sharedMemory = sharedMemory;
        this.saveFilePath = `forest_swarm_${uuidv4()}.json`;
        this.conversation = new Conversation({ timeEnabled: true, autoSave: true, saveFilePath: this.saveFilePath, rules });
    }

    findRelevantTree(task) {
        logger.info(`Searching for the most relevant tree for task: ${task}`);
        return this.trees.find(tree => tree.findRelevantAgent(task)) || null;
    }

    run(task, img = null, ...args) {
        try {
            logger.info(`Running task across MultiAgentTreeStructure: ${task}`);
            const relevantTree = this.findRelevantTree(task);
            if (relevantTree) {
                const agent = relevantTree.findRelevantAgent(task);
                if (agent) {
                    const result = agent.runTask(task, img, ...args);
                    relevantTree.logTreeExecution(task, agent, result);
                    return result;
                }
            } else {
                logger.error('Task could not be completed: No relevant agent or tree found.');
                return 'No relevant agent found to handle this task.';
            }
        } catch (error) {
            logger.error(`Error detected in the ForestSwarm, check your inputs and try again ;) ${error}`);
        }
    }
}

// Example Usage (commented out):
/*
const agentsTree1 = [
    new TreeAgent({ systemPrompt: 'Stock Analysis Agent', agentName: 'Stock Analysis Agent' }),
    new TreeAgent({ systemPrompt: 'Financial Planning Agent', agentName: 'Financial Planning Agent' }),
    new TreeAgent({ systemPrompt: 'Retirement Strategy Agent', agentName: 'Retirement Strategy Agent' })
];

const agentsTree2 = [
    new TreeAgent({ systemPrompt: 'Tax Filing Agent', agentName: 'Tax Filing Agent' }),
    new TreeAgent({ systemPrompt: 'Investment Strategy Agent', agentName: 'Investment Strategy Agent' }),
    new TreeAgent({ systemPrompt: 'ROTH IRA Agent', agentName: 'ROTH IRA Agent' })
];

const tree1 = new Tree('Financial Tree', agentsTree1);
const tree2 = new Tree('Investment Tree', agentsTree2);

const multiAgentStructure = new ForestSwarm({ trees: [tree1, tree2] });

const task = 'Our company is incorporated in Delaware, how do we do our taxes for free?';
const output = multiAgentStructure.run(task);
console.log(output);
*/