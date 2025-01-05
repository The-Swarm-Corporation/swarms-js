import { v4 as uuidv4 } from 'uuid';

/**
 * Agent response model
 */
class AgentResponse {
    constructor({
        id = uuidv4(),
        timestamp = Date.now(),
        agentPosition,
        agentName,
        agentResponse
    }) {
        this.id = id;
        this.timestamp = timestamp;
        this.agentPosition = agentPosition;
        this.agentName = agentName;
        this.agentResponse = agentResponse;
    }
}

/**
 * Swarm output model
 */
class SwarmOutput {
    constructor({
        id = uuidv4(),
        timestamp = Date.now(),
        name,
        description,
        swarmType,
        agentOutputs = []
    }) {
        this.id = id;
        this.timestamp = timestamp;
        this.name = name;
        this.description = description;
        this.swarmType = swarmType;
        this.agentOutputs = agentOutputs.map(output => new AgentResponse(output));
    }
}

// Example usage (commented out):
/*
// Example usage:
const agentResponse = new AgentResponse({
    agentPosition: 1,
    agentName: "Agent1",
    agentResponse: "This is the response from Agent1"
});

const swarmOutput = new SwarmOutput({
    name: "ExampleSwarm",
    description: "An example swarm",
    swarmType: "round-robin",
    agentOutputs: [agentResponse]
});

console.log(swarmOutput);
*/