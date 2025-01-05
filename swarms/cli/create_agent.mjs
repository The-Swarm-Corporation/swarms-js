import { Agent } from '../structs/agent.mjs';

/**
 * This function creates an Agent instance and runs a task on it.
 * 
 * @param {string} name - The name of the agent.
 * @param {string} systemPrompt - The system prompt for the agent.
 * @param {string} modelName - The name of the model used by the agent.
 * @param {number} maxLoops - The maximum number of loops the agent can run.
 * @param {string} task - The task to be run by the agent.
 * @param {string} img - The image associated with the task.
 * @param {...any} args - Variable length arguments.
 * @param {...any} kwargs - Keyword arguments.
 * @returns {Promise<any>} - The output of the task run by the agent.
 */
async function runAgentByName(name, systemPrompt, modelName, maxLoops, task, img, ...args) {
    try {
        const agent = new Agent({
            agent_name: name,
            system_prompt: systemPrompt,
            model_name: modelName,
            max_loops: maxLoops,
        });

        const output = await agent.run({ task, img, ...args });
        return output;
    } catch (e) {
        console.error(`An error occurred: ${e.message}`);
        return null;
    }
}

export { runAgentByName };