import { Agent } from './agent.mjs';

/**
 * Parse tasks from a given string.
 * @param {string} task - The task string to parse.
 * @returns {Object} Parsed tasks as a dictionary.
 */
export function parseTasks(task = null) {
    const tasks = {};
    task.split("\n").forEach(line => {
        if (line.startsWith("<agent_id>") && line.endsWith("</agent_id>")) {
            const [agentId, task] = line.slice(10, -11).split("><");
            tasks[agentId] = task;
        }
    });
    return tasks;
}

/**
 * Find an agent by ID and optionally run a task.
 * @param {string} agentId - The ID of the agent to find.
 * @param {Array<Agent>} agents - List of agents.
 * @param {string} [task=null] - Task to run if agent is found.
 * @returns {Agent|null} The found agent or null.
 */
export function findAgentById(agentId = null, agents = [], task = null, ...args) {
    for (const agent of agents) {
        if (agent.id === agentId) {
            return task ? agent.run(task, ...args) : agent;
        }
    }
    return null;
}

/**
 * Distribute tasks to agents.
 * @param {string} task - The task string to distribute.
 * @param {Array<Agent>} agents - List of agents.
 */
export function distributeTasks(task = null, agents = [], ...args) {
    const tasks = parseTasks(task);

    for (const [agentId, task] of Object.entries(tasks)) {
        const assignedAgent = findAgentById(agentId, agents);
        if (assignedAgent) {
            console.log(`Assigning task ${task} to agent ${agentId}`);
            const output = assignedAgent.run(task, ...args);
            console.log(`Output from agent ${agentId}: ${output}`);
        } else {
            console.log(`No agent found with ID ${agentId}. Task '${task}' is not assigned.`);
        }
    }
}

/**
 * Check if a specific token is present in the text.
 * @param {string} text - The text to check.
 * @param {string} [token="<DONE>"] - The token to find.
 * @returns {boolean} True if the token is found, otherwise false.
 */
export function findTokenInText(text, token = "<DONE>") {
    return text.includes(token);
}

/**
 * Extract a specific key from a JSON response.
 * @param {string} jsonResponse - The JSON response to parse.
 * @param {string} key - The key to extract.
 * @returns {string|null} The value of the key if it exists, otherwise null.
 */
export function extractKeyFromJson(jsonResponse, key) {
    const responseDict = JSON.parse(jsonResponse);
    return responseDict[key] || null;
}

/**
 * Extract a list of tokens from a text response.
 * @param {string} text - The text to parse.
 * @param {Array<string>} tokens - The tokens to extract.
 * @returns {Array<string>} The tokens that were found in the text.
 */
export function extractTokensFromText(text, tokens) {
    return tokens.filter(token => text.includes(token));
}

/**
 * Checks if a string contains Markdown code enclosed in six backticks.
 * @param {string} text - The text to check.
 * @returns {boolean} True if the text contains Markdown code enclosed in six backticks, otherwise false.
 */
export function detectMarkdown(text) {
    const pattern = /``````[\s\S]*?``````/;
    return pattern.test(text);
}

// Example usage (commented out):
/*
// Example usage:
const task = "<agent_id>1</agent_id><task>Analyze financial data</task>";
const agents = [new Agent({ id: "1", name: "Agent1" })];

distributeTasks(task, agents);
*/