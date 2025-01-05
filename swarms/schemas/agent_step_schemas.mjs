import { BaseModel, Field } from 'pydantic';
import { v4 as uuidv4 } from 'uuid';
import { AgentChatCompletionResponse } from './base_schemas.mjs';

function getCurrentTime() {
    return new Date().toISOString();
}

class Step extends BaseModel {
    step_id = Field(() => uuidv4(), { description: "The ID of the task step.", examples: ["6bb1801a-fd80-45e8-899a-4dd723cc602e"] });
    time = Field(() => getCurrentTime(), { description: "The time taken to complete the task step." });
    response = Field(null, { default: null });
}

class ManySteps extends BaseModel {
    agent_id = Field(null, { description: "The ID of the agent.", examples: ["financial-agent-1"] });
    agent_name = Field(null, { description: "The ID of the agent.", examples: ["financial-agent-1"] });
    task = Field(null, { description: "The name of the task.", examples: ["Write to file"] });
    max_loops = Field(null, { description: "The number of steps in the task.", examples: [3] });
    run_id = Field(() => uuidv4(), { description: "The ID of the task this step belongs to.", examples: ["50da533e-3904-4401-8a07-c49adf88b5eb"] });
    steps = Field([], { description: "The steps of the task." });
    full_history = Field(null, { description: "The full history of the task.", examples: ["I am going to use the write_to_file command and write Washington to a file called output.txt <write_to_file('output.txt', 'Washington')"] });
    total_tokens = Field(null, { description: "The total number of tokens generated.", examples: [7894] });
    stopping_token = Field(null, { description: "The token at which the task stopped." });
    interactive = Field(null, { description: "The interactive status of the task.", examples: [true] });
    dynamic_temperature_enabled = Field(null, { description: "The dynamic temperature status of the task.", examples: [true] });
}

export { Step, ManySteps };