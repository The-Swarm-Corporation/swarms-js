import { Agent } from './agent.mjs';
import { Conversation } from './conversation.mjs';
import { createFile } from '../utils/file_processing.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('majority_voting');

/**
 * Extracts the last Python code block from the given text.
 * @param {string} text - The text to search for Python code blocks.
 * @returns {string|null} The last Python code block found in the text, or null if no code block is found.
 */
function extractLastPythonCodeBlock(text) {
    const pattern = /```[pP]ython(.*?)```/gs;
    const matches = [...text.matchAll(pattern)];
    return matches.length ? matches[matches.length - 1][1].trim() : null;
}

/**
 * Parses the code completion response from the agent and extracts the last Python code block.
 * @param {string} agentResponse - The response from the agent.
 * @param {string} question - The original question.
 * @returns {Array} A tuple containing the parsed Python code and a boolean indicating success.
 */
function parseCodeCompletion(agentResponse, question) {
    let pythonCode = extractLastPythonCodeBlock(agentResponse);
    if (!pythonCode) {
        if (!agentResponse.includes("impl]")) {
            pythonCode = agentResponse;
        } else {
            pythonCode = agentResponse.split("\n").reduce((code, line) => {
                if (line.includes("impl]")) code += line + "\n";
                return code;
            }, "");
        }
    }
    if (!pythonCode.includes("def")) {
        pythonCode = question + pythonCode;
    }
    return [pythonCode, true];
}

/**
 * Finds the most frequent element in a list based on a comparison function.
 * @param {Array} clist - The list of elements to search.
 * @param {Function} [cmpFunc=null] - The comparison function used to determine the frequency of elements.
 * @returns {Array} A tuple containing the most frequent element and its frequency.
 */
function mostFrequent(clist, cmpFunc = null) {
    const counter = new Map();
    let maxCount = 0;
    let mostFrequentItem = clist[0];

    clist.forEach(item => {
        const count = (counter.get(item) || 0) + 1;
        counter.set(item, count);
        if (count > maxCount) {
            maxCount = count;
            mostFrequentItem = item;
        }
    });

    return [mostFrequentItem, maxCount];
}

/**
 * Performs majority voting on a list of answers and returns the most common answer.
 * @param {Array<string>} answers - A list of answers.
 * @returns {string} The most common answer in the list.
 */
function majorityVoting(answers) {
    const counter = new Map();
    answers.forEach(answer => {
        counter.set(answer, (counter.get(answer) || 0) + 1);
    });
    return [...counter.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/**
 * Class representing a majority voting system for agents.
 */
export class MajorityVoting {
    /**
     * @param {string} name - The name of the majority voting system
     * @param {string} description - The description of the majority voting system
     * @param {Array<Agent>} agents - A list of agents to be used in the majority voting system
     * @param {Function} [outputParser=majorityVoting] - A function used to parse the output of the agents
     * @param {boolean} [autosave=false] - Whether to autosave the conversation to a file
     * @param {boolean} [verbose=false] - Whether to enable verbose logging
     */
    constructor({
        name = "MajorityVoting",
        description = "A majority voting system for agents",
        agents = [],
        outputParser = majorityVoting,
        autosave = false,
        verbose = false,
        ...args
    } = {}) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.outputParser = outputParser;
        this.autosave = autosave;
        this.verbose = verbose;
        this.conversation = new Conversation({ timeEnabled: true, ...args });

        if (this.autosave) {
            createFile(JSON.stringify(this.conversation), "majority_voting.json");
        }

        logger.info("Initializing majority voting system");
        logger.info(`Number of agents: ${this.agents.length}`);
        logger.info(`Agents: ${this.agents.map(agent => agent.agentName).join(', ')}`);
    }

    /**
     * Runs the majority voting system and returns the majority vote.
     * @param {string} task - The task to be performed by the agents
     * @returns {Array} The majority vote
     */
    async run(task, ...args) {
        logger.info("Running agents concurrently");

        const results = await Promise.all(
            this.agents.map(agent => agent.run(task, ...args))
        );

        results.forEach((response, index) => {
            const agent = this.agents[index];
            this.conversation.add(agent.agentName, response);
            logger.info(`[Agent][Name: ${agent.agentName}][Response: ${response}]`);
        });

        const responses = this.conversation.conversationHistory
            .filter(message => message.role === "agent")
            .map(message => message.content);

        const majorityVote = this.outputParser(responses, ...args);
        return majorityVote;
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';
import { MajorityVoting } from './majority_voting.mjs';

const agents = [
    new Agent({ agentName: "GPT-3" }),
    new Agent({ agentName: "Codex" }),
    new Agent({ agentName: "Tabnine" })
];

const majorityVoting = new MajorityVoting({
    agents,
    autosave: true,
    verbose: true
});

const result = await majorityVoting.run("What is the capital of France?");
console.log(result);
*/