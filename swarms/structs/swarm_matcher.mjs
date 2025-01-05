import { v4 as uuidv4 } from 'uuid';
import { retry } from 'async-retry';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { autoCheckAndDownloadPackage } from '../utils/auto_download_check_packages.mjs';

const logger = initializeLogger('swarm_matcher');

/**
 * SwarmType class representing a swarm type with its name, description, and optional embedding.
 */
class SwarmType {
    constructor({ name, description, embedding = null }) {
        this.name = name;
        this.description = description;
        this.embedding = embedding;
    }
}

/**
 * SwarmMatcherConfig class representing the configuration for the SwarmMatcher.
 */
class SwarmMatcherConfig {
    constructor({ modelName = 'sentence-transformers/all-MiniLM-L6-v2', embeddingDim = 512 } = {}) {
        this.modelName = modelName;
        this.embeddingDim = embeddingDim;
    }
}

/**
 * SwarmMatcher class for matching tasks to swarm types based on their descriptions.
 */
class SwarmMatcher {
    constructor(config) {
        logger.add('swarm_matcher_debug.log', { level: 'debug' });
        logger.debug('Initializing SwarmMatcher');

        this.config = config;
        this.swarmTypes = [];

        this.initializeModel();
    }

    async initializeModel() {
        try {
            const { default: torch } = await import('torch');
            const { default: transformers } = await import('transformers');

            this.tokenizer = transformers.AutoTokenizer.from_pretrained(this.config.modelName);
            this.model = transformers.AutoModel.from_pretrained(this.config.modelName);

            logger.debug('SwarmMatcher initialized successfully');
        } catch (error) {
            logger.error(`Error initializing SwarmMatcher: ${error.message}`);
            throw error;
        }
    }

    async getEmbedding(text) {
        logger.debug(`Getting embedding for text: ${text.slice(0, 50)}...`);
        try {
            const inputs = this.tokenizer(text, { return_tensors: 'pt', padding: true, truncation: true, max_length: 512 });
            const outputs = await this.model(inputs);
            const embedding = outputs.last_hidden_state.mean(dim=1).squeeze().numpy();
            logger.debug('Embedding generated successfully');
            return embedding;
        } catch (error) {
            logger.error(`Error generating embedding: ${error.message}`);
            throw error;
        }
    }

    async addSwarmType(swarmType) {
        logger.debug(`Adding swarm type: ${swarmType.name}`);
        try {
            const embedding = await this.getEmbedding(swarmType.description);
            swarmType.embedding = embedding;
            this.swarmTypes.push(swarmType);
            logger.info(`Added swarm type: ${swarmType.name}`);
        } catch (error) {
            logger.error(`Error adding swarm type ${swarmType.name}: ${error.message}`);
            throw error;
        }
    }

    async findBestMatch(task) {
        logger.debug(`Finding best match for task: ${task.slice(0, 50)}...`);
        try {
            const taskEmbedding = await this.getEmbedding(task);
            let bestMatch = null;
            let bestScore = -Infinity;

            for (const swarmType of this.swarmTypes) {
                const score = taskEmbedding.dot(swarmType.embedding);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = swarmType;
                }
            }

            logger.info(`Best match for task: ${bestMatch.name} (score: ${bestScore})`);
            return [bestMatch.name, bestScore];
        } catch (error) {
            logger.error(`Error finding best match for task: ${error.message}`);
            throw error;
        }
    }

    async autoSelectSwarm(task) {
        logger.debug(`Auto-selecting swarm for task: ${task.slice(0, 50)}...`);
        const [bestMatch, score] = await this.findBestMatch(task);
        logger.info(`Task: ${task}`);
        logger.info(`Selected Swarm Type: ${bestMatch}`);
        logger.info(`Confidence Score: ${score.toFixed(2)}`);
        return bestMatch;
    }

    async runMultiple(tasks) {
        const swarms = [];
        for (const task of tasks) {
            const output = await this.autoSelectSwarm(task);
            swarms.push(output);
        }
        return swarms;
    }

    async saveSwarmTypes(filename) {
        try {
            const data = JSON.stringify(this.swarmTypes.map(st => ({ name: st.name, description: st.description, embedding: st.embedding })), null, 2);
            await fs.promises.writeFile(filename, data);
            logger.info(`Saved swarm types to ${filename}`);
        } catch (error) {
            logger.error(`Error saving swarm types: ${error.message}`);
            throw error;
        }
    }

    async loadSwarmTypes(filename) {
        try {
            const data = await fs.promises.readFile(filename, 'utf8');
            const swarmTypesData = JSON.parse(data);
            this.swarmTypes = swarmTypesData.map(st => new SwarmType(st));
            logger.info(`Loaded swarm types from ${filename}`);
        } catch (error) {
            logger.error(`Error loading swarm types: ${error.message}`);
            throw error;
        }
    }
}

async function initializeSwarmTypes(matcher) {
    logger.debug('Initializing swarm types');
    const swarmTypes = [
        new SwarmType({
            name: 'AgentRearrange',
            description: 'Optimize agent order and rearrange flow for multi-step tasks, ensuring efficient task allocation and minimizing bottlenecks. Keywords: orchestration, coordination, pipeline optimization, task scheduling, resource allocation, workflow management, agent organization, process optimization'
        }),
        new SwarmType({
            name: 'MixtureOfAgents',
            description: 'Combine diverse expert agents for comprehensive analysis, fostering a collaborative approach to problem-solving and leveraging individual strengths. Keywords: multi-agent system, expert collaboration, distributed intelligence, collective problem solving, agent specialization, team coordination, hybrid approaches, knowledge synthesis'
        }),
        new SwarmType({
            name: 'SpreadSheetSwarm',
            description: 'Collaborative data processing and analysis in a spreadsheet-like environment, facilitating real-time data sharing and visualization. Keywords: data analysis, tabular processing, collaborative editing, data transformation, spreadsheet operations, data visualization, real-time collaboration, structured data'
        }),
        new SwarmType({
            name: 'SequentialWorkflow',
            description: 'Execute tasks in a step-by-step, sequential process workflow, ensuring a logical and methodical approach to task execution. Keywords: linear processing, waterfall methodology, step-by-step execution, ordered tasks, sequential operations, process flow, systematic approach, staged execution'
        }),
        new SwarmType({
            name: 'ConcurrentWorkflow',
            description: 'Process multiple tasks or data sources concurrently in parallel, maximizing productivity and reducing processing time. Keywords: parallel processing, multi-threading, asynchronous execution, distributed computing, concurrent operations, simultaneous tasks, parallel workflows, scalable processing'
        })
    ];

    for (const swarmType of swarmTypes) {
        await matcher.addSwarmType(swarmType);
    }
    logger.debug('Swarm types initialized');
}

async function swarmMatcher(task) {
    const config = new SwarmMatcherConfig();
    const matcher = new SwarmMatcher(config);
    await initializeSwarmTypes(matcher);

    const swarmType = await matcher.autoSelectSwarm(task);
    logger.info(swarmType);

    return swarmType;
}

// Example usage (commented out):
/*
(async () => {
    const task = 'Analyze this spreadsheet of sales data and create visualizations';
    const swarmType = await swarmMatcher(task);
    console.log(`Selected Swarm Type: ${swarmType}`);
})();
*/