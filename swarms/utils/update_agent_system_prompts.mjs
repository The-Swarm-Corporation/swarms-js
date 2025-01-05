import { Agent } from '../structs/agent.mjs';

/**
 * Update system prompts for a list of agents concurrently.
 * 
 * @param {Array<Agent|string>} agents - List of Agent objects or strings to update.
 * @param {string} prompt - The prompt text to append to each agent's system prompt.
 * @returns {Promise<Array<Agent>>} - List of updated Agent objects.
 */
async function updateSystemPrompts(agents, prompt) {
    if (!agents.length) {
        return agents;
    }

    async function updateAgentPrompt(agent) {
        if (typeof agent === 'string') {
            agent = new Agent({
                agent_name: agent,
                system_prompt: prompt
            });
        } else {
            const existingPrompt = agent.system_prompt || "";
            agent.system_prompt = `${existingPrompt}\n${prompt}`;
        }
        return agent;
    }

    const maxWorkers = Math.min(agents.length, 4);
    const promises = agents.map(agent => updateAgentPrompt(agent));
    const updatedAgents = await Promise.all(promises);

    return updatedAgents;
}

export { updateSystemPrompts };