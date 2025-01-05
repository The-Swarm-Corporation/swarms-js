import { BaseSwarm } from './base_swarm.mjs';
import { Agent } from './agent.mjs';
import { logger } from '../utils/loguru_logger.mjs';

/**
 * Represents a company with a hierarchical organizational structure.
 */
export class Company extends BaseSwarm {
    /**
     * @param {Array<Array<Agent>>} orgChart - The organization chart representing the hierarchy of agents
     * @param {string} [sharedInstructions=null] - Shared instructions for the company
     * @param {Agent} [ceo=null] - The CEO of the company
     * @param {Array<Agent>} [agents=[]] - List of agents in the company
     * @param {Object} [agentInteractions={}] - Dictionary of agent interactions
     */
    constructor({
        orgChart,
        sharedInstructions = null,
        ceo = null,
        agents = [],
        agentInteractions = {}
    } = {}) {
        super();
        this.orgChart = orgChart;
        this.sharedInstructions = sharedInstructions;
        this.ceo = ceo;
        this.agents = agents;
        this.agentInteractions = agentInteractions;

        this._parseOrgChart(this.orgChart);
    }

    /**
     * Adds an agent to the company.
     * @param {Agent} agent - The agent to be added
     * @throws {Error} If an agent with the same ID already exists in the company
     */
    add(agent) {
        try {
            if (this.agents.some(existingAgent => existingAgent.id === agent.id)) {
                throw new Error(`Agent with id ${agent.id} already exists in the company.`);
            }
            this.agents.push(agent);
        } catch (error) {
            logger.error(`[ERROR][CLASS: Company][METHOD: add] ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieves an agent from the company by name.
     * @param {string} agentName - The name of the agent to retrieve
     * @returns {Agent} The retrieved agent
     * @throws {Error} If an agent with the specified name does not exist in the company
     */
    get(agentName) {
        try {
            const agent = this.agents.find(agent => agent.name === agentName);
            if (!agent) {
                throw new Error(`Agent with name ${agentName} does not exist in the company.`);
            }
            return agent;
        } catch (error) {
            logger.error(`[ERROR][CLASS: Company][METHOD: get] ${error.message}`);
            throw error;
        }
    }

    /**
     * Removes an agent from the company.
     * @param {Agent} agent - The agent to be removed
     */
    remove(agent) {
        try {
            this.agents = this.agents.filter(existingAgent => existingAgent !== agent);
        } catch (error) {
            logger.error(`[ERROR][CLASS: Company][METHOD: remove] ${error.message}`);
            throw error;
        }
    }

    /**
     * Parses the organization chart and adds agents to the company.
     * @param {Array<Array<Agent>>} orgChart - The organization chart representing the hierarchy of agents
     * @throws {Error} If more than one CEO is found in the org chart or if an invalid agent is encountered
     */
    _parseOrgChart(orgChart) {
        try {
            for (const node of orgChart) {
                if (node instanceof Agent) {
                    if (this.ceo) {
                        throw new Error("Only one CEO is allowed");
                    }
                    this.ceo = node;
                    this.add(node);
                } else if (Array.isArray(node)) {
                    for (const agent of node) {
                        if (!(agent instanceof Agent)) {
                            throw new Error("Invalid agent in org chart");
                        }
                        this.add(agent);
                    }

                    for (let i = 0; i < node.length - 1; i++) {
                        for (let j = i + 1; j < node.length; j++) {
                            this._initInteraction(node[i], node[j]);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`[ERROR][CLASS: Company][METHOD: _parseOrgChart] ${error.message}`);
            throw error;
        }
    }

    /**
     * Initializes the interaction between two agents.
     * @param {Agent} agent1 - The first agent involved in the interaction
     * @param {Agent} agent2 - The second agent involved in the interaction
     */
    _initInteraction(agent1, agent2) {
        if (!this.agentInteractions[agent1.name]) {
            this.agentInteractions[agent1.name] = [];
        }
        this.agentInteractions[agent1.name].push(agent2.name);
    }

    /**
     * Run the company
     */
    run() {
        for (const [agentName, interactionAgents] of Object.entries(this.agentInteractions)) {
            const agent = this.get(agentName);
            for (const interactionAgent of interactionAgents) {
                const taskDescription = `Task for ${agentName} to interact with ${interactionAgent}`;
                console.log(`${taskDescription} is being executed`);
                agent.run(taskDescription);
            }
        }
    }
}

// Example usage:
/*
import { Agent } from './agent.mjs';
import { Company } from './company.mjs';

const ceo = new Agent({ name: "CEO", id: "1" });
const manager1 = new Agent({ name: "Manager1", id: "2" });
const manager2 = new Agent({ name: "Manager2", id: "3" });
const employee1 = new Agent({ name: "Employee1", id: "4" });
const employee2 = new Agent({ name: "Employee2", id: "5" });

const orgChart = [
    ceo,
    [manager1, manager2],
    [employee1, employee2]
];

const company = new Company({ orgChart });
company.run();
*/