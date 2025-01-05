import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Worker } from 'worker_threads';
import yaml from 'yaml';
import { logger } from '../utils/loguru_logger.mjs';
import { Agent } from './agent.mjs';
import { Conversation } from './conversation.mjs';
import { dictToDataFrame, displayAgentsInfo, pydanticModelToDataFrame } from '../utils/pandas_utils.mjs';

/**
 * Base Swarm Class for all multi-agent systems
 */
export class BaseSwarm {
    /**
     * @param {string} [name=null] - The name of the swarm
     * @param {string} [description=null] - The description of the swarm
     * @param {Array<Agent>} [agents=null] - A list of agents
     * @param {Array<any>} [models=null] - A list of models
     * @param {number} [maxLoops=200] - The maximum number of loops to run
     * @param {Array<Function>} [callbacks=null] - A list of callback functions
     * @param {boolean} [autosave=false] - Whether to autosave the swarm state
     * @param {boolean} [logging=false] - Whether to enable logging
     * @param {boolean} [returnMetadata=false] - Whether to return metadata
     * @param {string} [metadataFilename="multiagent_structure_metadata.json"] - Filename for metadata
     * @param {Function} [stoppingFunction=null] - Function to determine when to stop
     * @param {string} [stoppingCondition="stop"] - Condition to stop the swarm
     * @param {Object} [stoppingConditionArgs=null] - Arguments for the stopping condition
     * @param {boolean} [agentOpsOn=false] - Whether to enable agent operations
     * @param {Function} [speakerSelectionFunc=null] - Function to select speakers
     * @param {string} [rules=null] - Rules for the swarm
     * @param {any} [collectiveMemorySystem=false] - Collective memory system
     * @param {boolean} [agentOpsOn=false] - Whether to enable agent operations
     * @param {any} [outputSchema=null] - Output schema
     */
    constructor({
        name = null,
        description = null,
        agents = null,
        models = null,
        maxLoops = 200,
        callbacks = null,
        autosave = false,
        logging = false,
        returnMetadata = false,
        metadataFilename = "multiagent_structure_metadata.json",
        stoppingFunction = null,
        stoppingCondition = "stop",
        stoppingConditionArgs = null,
        agentOpsOn = false,
        speakerSelectionFunc = null,
        rules = null,
        collectiveMemorySystem = false,
        outputSchema = null,
        ...args
    } = {}) {
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.models = models;
        this.maxLoops = maxLoops;
        this.callbacks = callbacks;
        this.autosave = autosave;
        this.logging = logging;
        this.returnMetadata = returnMetadata;
        this.metadataFilename = metadataFilename;
        this.stoppingFunction = stoppingFunction;
        this.stoppingCondition = stoppingCondition;
        this.stoppingConditionArgs = stoppingConditionArgs;
        this.agentOpsOn = agentOpsOn;
        this.speakerSelectionFunc = speakerSelectionFunc;
        this.rules = rules;
        this.collectiveMemorySystem = collectiveMemorySystem;
        this.outputSchema = outputSchema;

        logger.info("Reliability checks activated.");
        // Ensure that agents is exists
        if (this.agents === null) {
            logger.info("Agents must be provided.");
            throw new Error("Agents must be provided.");
        }

        // Ensure that agents is a list
        if (!Array.isArray(this.agents)) {
            logger.error("Agents must be a list.");
            throw new TypeError("Agents must be a list.");
        }

        // Initialize conversation
        this.conversation = new Conversation({
            timeEnabled: true,
            rules: this.rules,
            ...args
        });

        // Handle callbacks
        if (callbacks !== null) {
            for (const callback of this.callbacks) {
                if (typeof callback !== 'function') {
                    throw new TypeError("Callback must be callable.");
                }
            }
        }

        // Handle autosave
        if (autosave) {
            this.saveToJson(metadataFilename);
        }

        // Handle stopping function
        if (stoppingFunction !== null) {
            if (typeof stoppingFunction !== 'function') {
                throw new TypeError("Stopping function must be callable.");
            }
            if (stoppingConditionArgs === null) {
                stoppingConditionArgs = {};
            }
            this.stoppingConditionArgs = stoppingConditionArgs;
            this.stoppingCondition = stoppingCondition;
            this.stoppingFunction = stoppingFunction;
        }

        // Handle stopping condition
        if (stoppingCondition !== null) {
            if (stoppingConditionArgs === null) {
                stoppingConditionArgs = {};
            }
            this.stoppingConditionArgs = stoppingConditionArgs;
            this.stoppingCondition = stoppingCondition;
        }

        // If agentOps is enabled, try to import agentOps
        if (agentOpsOn === true) {
            for (const agent of this.agents) {
                agent.agentOpsOn = true;
            }
        }

        // Handle speaker selection function
        if (speakerSelectionFunc !== null) {
            if (typeof speakerSelectionFunc !== 'function') {
                throw new TypeError("Speaker selection function must be callable.");
            }
            this.speakerSelectionFunc = speakerSelectionFunc;
        }

        // Add the check for all the agents to see if agent ops is on!
        if (agentOpsOn === true) {
            for (const agent of this.agents) {
                agent.agentOpsOn = true;
            }
        }

        // Agents dictionary with agent name as key and agent object as value
        this.agentsDict = new Map(
            this.agents.map(agent => [agent.agentName, agent])
        );
    }

    communicate() {
        // Communicate with the swarm through the orchestrator, protocols, and the universal communication layer
    }

    run() {
        // Run the swarm
    }

    /**
     * Call self as a function
     * @param {any} task - Task to run
     * @returns {any} Result of the run
     */
    call(task, ...args) {
        try {
            return this.run(task, ...args);
        } catch (error) {
            logger.error(`Error running ${this.constructor.name}`);
            throw error;
        }
    }

    step() {
        // Step the swarm
    }

    addAgent(agent) {
        // Add an agent to the swarm
        this.agents.push(agent);
    }

    addAgents(agents) {
        // Add a list of agents to the swarm
        this.agents.push(...agents);
    }

    addAgentById(agentId) {
        // Add an agent to the swarm by id
        const agent = this.getAgentById(agentId);
        this.addAgent(agent);
    }

    removeAgent(agent) {
        // Remove an agent from the swarm
        this.agents = this.agents.filter(a => a !== agent);
    }

    getAgentByName(name) {
        // Get an agent by name
        return this.agents.find(agent => agent.name === name);
    }

    resetAllAgents() {
        // Resets the state of all agents
        for (const agent of this.agents) {
            agent.reset();
        }
    }

    broadcast(message, sender = null) {
        // Broadcast a message to all agents
    }

    reset() {
        // Reset the swarm
    }

    plan(task) {
        // Agents must individually plan using a workflow or pipeline
    }

    selfFindAgentByName(name) {
        // Find an agent by its name
        return this.agents.find(agent => agent.agentName === name);
    }

    selfFindAgentById(id) {
        // Find an agent by its id
        return this.agents.find(agent => agent.id === id);
    }

    agentExists(name) {
        // Check if an agent exists in the swarm
        return this.selfFindAgentByName(name) !== null;
    }

    directMessage(message, sender, recipient) {
        // Send a direct message to an agent
    }

    autoscaler(numAgents, agent) {
        // Autoscaler that acts like Kubernetes for autonomous agents
    }

    getAgentById(id) {
        // Locate an agent by id
        return this.agents.find(agent => agent.id === id);
    }

    assignTask(agent, task) {
        // Assign a task to an agent
        return agent.run(task);
    }

    getAllTasks(agent, task) {
        // Get all tasks
    }

    getFinishedTasks() {
        // Get all finished tasks
    }

    getPendingTasks() {
        // Get all pending tasks
    }

    pauseAgent(agent, agentId) {
        // Pause an agent
    }

    resumeAgent(agent, agentId) {
        // Resume an agent
    }

    stopAgent(agent, agentId) {
        // Stop an agent
    }

    restartAgent(agent) {
        // Restart an agent
    }

    scaleUp(numAgent) {
        // Scale up the number of agents
    }

    scaleDown(numAgent) {
        // Scale down the number of agents
    }

    scaleTo(numAgent) {
        // Scale to a specific number of agents
    }

    getAllAgents() {
        // Get all agents
        return this.agents;
    }

    getSwarmSize() {
        // Get the size of the swarm
        return this.agents.length;
    }

    getSwarmStatus() {
        // Get the status of the swarm
    }

    saveSwarmState() {
        // Save the swarm state
    }

    batchedRun(tasks, ...args) {
        // Implement batched run
        return tasks.map(task => this.run(task, ...args));
    }

    async abatchRun(tasks, ...args) {
        // Asynchronous batch run with language model
        return await Promise.all(tasks.map(task => this.arun(task, ...args)));
    }

    async arun(task = null, ...args) {
        // Asynchronous run
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.run(task, ...args));
            } catch (error) {
                reject(error);
            }
        });
    }

    loop(task = null, ...args) {
        // Loop through the swarm
        for (let i = 0; i < this.maxLoops; i++) {
            this.run(task, ...args);
        }
    }

    async aloop(task = null, ...args) {
        // Asynchronous loop through the swarm
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.loop(task, ...args));
            } catch (error) {
                reject(error);
            }
        });
    }

    runAsync(task = null, ...args) {
        // Run the swarm asynchronously
        return this.arun(task, ...args);
    }

    runBatchAsync(tasks, ...args) {
        // Run the swarm asynchronously
        return this.abatchRun(tasks, ...args);
    }

    runBatch(tasks, ...args) {
        // Run the swarm asynchronously
        return this.batchedRun(tasks, ...args);
    }

    selectAgentByName(agentName) {
        // Select an agent through their name
        return this.agents.find(agent => agent.name === agentName);
    }

    taskAssignmentById(task, agentId, ...args) {
        // Assign a task to an agent by their agent id
        const agent = this.selectAgent(agentId);
        return agent.run(task, ...args);
    }

    taskAssignmentByName(task, agentName, ...args) {
        // Assign a task to an agent by their agent name
        const agent = this.selectAgentByName(agentName);
        return agent.run(task, ...args);
    }

    concurrentRun(task) {
        // Synchronously run the task on all agents and collect responses
        return Promise.all(this.agents.map(agent => agent.run(task)));
    }

    addLlm(agent) {
        // Add an agent to the swarm
        this.agents.push(agent);
    }

    removeLlm(agent) {
        // Remove an agent from the swarm
        this.agents = this.agents.filter(a => a !== agent);
    }

    runAll(task = null, ...args) {
        // Run all agents
        return this.agents.map(agent => agent.run(task, ...args));
    }

    runOnAllAgents(task = null, ...args) {
        // Run on all agents
        return Promise.all(this.agents.map(agent => agent.run(task, ...args)));
    }

    addSwarmEntry(swarm) {
        // Add the information of a joined Swarm to the registry
    }

    addAgentEntry(agent) {
        // Add the information of an Agent to the registry
    }

    retrieveSwarmInformation(swarmId) {
        // Retrieve the information of a specific Swarm from the registry
    }

    retrieveJoinedAgents(agentId) {
        // Retrieve the information the Agents which have joined the registry
    }

    joinSwarm(fromEntity, toEntity) {
        // Add a relationship between a Swarm and an Agent or other Swarm to the registry
    }

    metadata() {
        // Get the metadata of the multi-agent structure
        return {
            agents: this.agents,
            callbacks: this.callbacks,
            autosave: this.autosave,
            logging: this.logging,
            conversation: this.conversation
        };
    }

    saveToJson(filename) {
        // Save the current state of the multi-agent structure to a JSON file
        fs.writeFileSync(filename, JSON.stringify(this, null, 2));
    }

    loadFromJson(filename) {
        // Load the state of the multi-agent structure from a JSON file
        Object.assign(this, JSON.parse(fs.readFileSync(filename, 'utf8')));
    }

    saveToYaml(filename) {
        // Save the current state of the multi-agent structure to a YAML file
        fs.writeFileSync(filename, yaml.stringify(this));
    }

    loadFromYaml(filename) {
        // Load the state of the multi-agent structure from a YAML file
        Object.assign(this, yaml.parse(fs.readFileSync(filename, 'utf8')));
    }

    toString() {
        return `${this.constructor.name}(${JSON.stringify(this)})`;
    }

    toDict() {
        return Object.fromEntries(
            Object.entries(this).map(([key, value]) => [key, value])
        );
    }

    toJson(indent = 4) {
        return JSON.stringify(this.toDict(), null, indent);
    }

    toYaml(indent = 4) {
        return yaml.stringify(this.toDict(), { indent });
    }

    toToml() {
        return toml.stringify(this.toDict());
    }

    // function commented_out_function(x) {
    //     return x * 2;
    // }
}

// Example usage:
/*
const baseSwarm = new BaseSwarm({
    name: "ExampleSwarm",
    description: "An example base swarm"
});

// Save metadata
baseSwarm.saveToJson("metadata.json");

// Load metadata
baseSwarm.loadFromJson("metadata.json");

// Log error
baseSwarm.logError("An error occurred");

// Save artifact
baseSwarm.saveArtifact({ key: "value" }, "exampleArtifact");

// Load artifact
const artifact = baseSwarm.loadArtifact("exampleArtifact");
console.log(artifact);

// Run asynchronously
baseSwarm.runAsync().then(() => {
    console.log("Run completed");
}).catch(console.error);
*/