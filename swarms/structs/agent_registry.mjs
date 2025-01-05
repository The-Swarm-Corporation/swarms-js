import { Agent } from './agent.mjs';
import { logger } from '../utils/loguru_logger.mjs';

/**
 * Schema for agent configuration
 */
class AgentConfigSchema {
    constructor({
        uuid,
        name = null,
        description = null,
        config = null
    }) {
        this.uuid = uuid;
        this.name = name;
        this.description = description;
        this.timeAdded = new Date().toISOString();
        this.config = config;
    }
}

/**
 * Schema for agent registry
 */
class AgentRegistrySchema {
    constructor({
        name,
        description,
        agents = []
    }) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.timeRegistryCreated = new Date().toISOString();
        this.numberOfAgents = agents.length;
    }
}

/**
 * A class for managing a registry of agents
 */
export class AgentRegistry {
    /**
     * @param {string} name - The name of the registry
     * @param {string} description - A description of the registry
     * @param {Array<Agent>} agents - Initial list of agents
     * @param {boolean} returnJson - Whether to return data in JSON format
     * @param {boolean} autoSave - Whether to automatically save changes
     */
    constructor(
        name = "Agent Registry",
        description = "A registry for managing agents.",
        agents = null,
        returnJson = true,
        autoSave = false
    ) {
        this.name = name;
        this.description = description;
        this.returnJson = returnJson;
        this.autoSave = autoSave;
        this.agents = new Map();
        
        this.agentRegistry = new AgentRegistrySchema({
            name: this.name,
            description: this.description,
            agents: [],
            numberOfAgents: agents?.length || 0
        });

        if (agents) {
            this.addMany(agents);
        }
    }

    /**
     * Adds a new agent to the registry
     * @param {Agent} agent - The agent to add
     * @throws {Error} If agent name already exists
     */
    async add(agent) {
        const name = agent.agentName;
        
        await this.agentToPyModel(agent);

        if (this.agents.has(name)) {
            const error = `Agent with name ${name} already exists.`;
            logger.error(error);
            throw new Error(error);
        }

        try {
            this.agents.set(name, agent);
            logger.info(`Agent ${name} added successfully.`);
        } catch (error) {
            logger.error(`Validation error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Adds multiple agents to the registry
     * @param {Array<Agent>} agents - List of agents to add
     */
    async addMany(agents) {
        await Promise.all(agents.map(agent => this.add(agent)));
    }

    /**
     * Deletes an agent from the registry
     * @param {string} agentName - Name of agent to delete
     */
    delete(agentName) {
        try {
            if (!this.agents.delete(agentName)) {
                throw new Error(`Agent ${agentName} not found`);
            }
            logger.info(`Agent ${agentName} deleted successfully.`);
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates an existing agent
     * @param {string} agentName - Name of agent to update
     * @param {Agent} newAgent - New agent data
     */
    updateAgent(agentName, newAgent) {
        if (!this.agents.has(agentName)) {
            const error = `Agent with name ${agentName} does not exist.`;
            logger.error(error);
            throw new Error(error);
        }

        try {
            this.agents.set(agentName, newAgent);
            logger.info(`Agent ${agentName} updated successfully.`);
        } catch (error) {
            logger.error(`Validation error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieves an agent from the registry
     * @param {string} agentName - Name of agent to retrieve
     * @returns {Agent} The requested agent
     */
    get(agentName) {
        try {
            const agent = this.agents.get(agentName);
            if (!agent) {
                throw new Error(`Agent ${agentName} not found`);
            }
            logger.info(`Agent ${agentName} retrieved successfully.`);
            return agent;
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Lists all agent names
     * @returns {Array<string>} List of agent names
     */
    listAgents() {
        try {
            const agentNames = Array.from(this.agents.keys());
            logger.info("Listing all agents.");
            return agentNames;
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Returns all agents
     * @returns {Array<Agent>} List of all agents
     */
    returnAllAgents() {
        try {
            const agents = Array.from(this.agents.values());
            logger.info("Returning all agents.");
            return agents;
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Queries agents based on a condition
     * @param {Function} condition - Function that takes an agent and returns boolean
     * @returns {Array<Agent>} List of matching agents
     */
    query(condition = null) {
        try {
            if (!condition) {
                return this.returnAllAgents();
            }
            
            const agents = Array.from(this.agents.values())
                .filter(condition);
            logger.info("Querying agents with condition.");
            return agents;
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Finds an agent by name
     * @param {string} agentName - Name of agent to find
     * @returns {Promise<Agent|null>} The found agent or null
     */
    async findAgentByName(agentName) {
        try {
            return this.get(agentName);
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Converts agent to registry schema
     * @param {Agent} agent - Agent to convert
     */
    async agentToPyModel(agent) {
        const agentName = agent.agentName;
        const agentDescription = agent.description || "No description provided";

        const schema = new AgentConfigSchema({
            uuid: agent.id,
            name: agentName,
            description: agentDescription,
            config: agent.toDict()
        });

        logger.info(`Agent ${agentName} converted to schema model.`);
        this.agentRegistry.agents.push(schema);
    }
}

// Example usage:
/*
import { Agent } from '../agent.mjs';

const registry = new AgentRegistry();

const agent = new Agent({
    agentName: "test-agent",
    description: "A test agent"
});

// Add single agent
await registry.add(agent);

// Add multiple agents
await registry.addMany([agent1, agent2]);

// Query agents
const matchingAgents = registry.query(agent => agent.description.includes("test"));

// Find agent by name
const foundAgent = await registry.findAgentByName("test-agent");

// List all agents
const agentNames = registry.listAgents();
*/