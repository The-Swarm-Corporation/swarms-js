import { Agent } from './agent.mjs';

/**
 * Format the available agents in either XML or Table format.
 * 
 * @param {Array<Agent>} agents - A list of agents to represent
 * @param {string} [name=null] - Name of the swarm
 * @param {string} [description=null] - Description of the swarm
 * @param {string} [format="XML"] - Output format ("XML" or "Table")
 * @returns {string} Formatted string containing agent information
 */
export function showcase_available_agents(
    agents,
    name = null,
    description = null,
    format = "XML"
) {
    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    const truncate = (text, maxLength = 130) => {
        return text.length > maxLength ? 
            `${text.substring(0, maxLength)}...` : 
            text;
    };

    const output = [];

    if (format.toUpperCase() === "TABLE") {
        output.push("\n| ID | Agent Name | Description |");
        output.push("|-----|------------|-------------|");
        
        agents.forEach((agent, idx) => {
            if (agent instanceof Agent) {
                const agentName = agent.agent_name || String(agent);
                const description = agent.description || agent.system_prompt || "Unknown description";
                const desc = truncate(description, 50);
                output.push(`| ${idx + 1} | ${agentName} | ${desc} |`);
            } else {
                output.push(`| ${idx + 1} | ${agent} | Unknown description |`);
            }
        });

        return output.join('\n');
    }

    // Default XML format
    output.push("<agents>");
    
    if (name) {
        output.push(`  <name>${name}</name>`);
    }
    
    if (description) {
        output.push(`  <description>${truncate(description)}</description>`);
    }

    agents.forEach((agent, idx) => {
        output.push(`  <agent id='${idx + 1}'>`);
        
        if (agent instanceof Agent) {
            const agentName = agent.agent_name || String(agent);
            const description = agent.description || 
                              agent.system_prompt || 
                              "Unknown description";
            
            output.push(`    <name>${agentName}</name>`);
            output.push(`    <description>${truncate(description)}</description>`);
        } else {
            output.push(`    <name>${agent}</name>`);
            output.push(`    <description>Unknown description</description>`);
        }
        
        output.push("  </agent>");
    });

    output.push("</agents>");
    return output.join('\n');
}

// Example usage:
/*
import { Agent } from './agent.mjs';

// Create some test agents
const agent1 = new Agent({
    agent_name: "TestAgent1",
    description: "A test agent with a description"
});

const agent2 = new Agent({
    agent_name: "TestAgent2",
    system_prompt: "A test agent with only a system prompt"
});

// Test XML format
const xmlOutput = showcase_available_agents(
    [agent1, agent2],
    "Test Swarm",
    "A test swarm of agents"
);
console.log(xmlOutput);

// Test Table format
const tableOutput = showcase_available_agents(
    [agent1, agent2],
    "Test Swarm",
    "A test swarm of agents",
    "TABLE"
);
console.log(tableOutput);
*/