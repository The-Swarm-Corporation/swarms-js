import { Agent } from './agent.mjs';
import { BaseLLM } from '../models/base_llm.mjs';
import { BaseMultiModalModel } from '../models/base_multimodal_model.mjs';

/**
 * Unified type for agent
 * @typedef {Agent | Function | any | BaseLLM | BaseMultiModalModel} AgentType
 */

/**
 * List of agents
 * @typedef {Array<AgentType>} AgentListType
 */

// Example usage (commented out):
/*
// Example of defining an agent list
const agents = [
    new Agent({ agentName: "Agent1", description: "Example agent 1" }),
    new BaseLLM({ modelName: "ExampleLLM" }),
    new BaseMultiModalModel({ modelName: "ExampleMultiModal" }),
    () => console.log("Callable agent")
];

console.log(agents);
*/