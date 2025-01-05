import { Agent } from '../swarms/structs/agent.mjs';
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../swarms/utils/loguru_logger.mjs';
import { Conversation } from '../swarms/structs/conversation.mjs';
import { BaseTool } from '../swarms/tools/base_tool.mjs';
import { AGENT_SYSTEM_PROMPT_3 } from '../swarms/prompts/agent_system_prompts.mjs';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));
jest.mock('../swarms/utils/loguru_logger.mjs', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));
jest.mock('../swarms/structs/conversation.mjs', () => ({
  Conversation: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    return_history_as_string: jest.fn(() => 'mock-history'),
  })),
}));
jest.mock('../swarms/tools/base_tool.mjs', () => ({
  BaseTool: jest.fn().mockImplementation(() => ({
    convert_tool_into_openai_schema: jest.fn(() => 'mock-schema'),
  })),
}));

describe('Agent', () => {
  let agent;

  beforeEach(() => {
    agent = new Agent({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with default values', () => {
    expect(agent.agent_id).toBe('mock-uuid');
    expect(agent.id).toBe('mock-uuid');
    expect(agent.llm).toBeNull();
    expect(agent.template).toBeNull();
    expect(agent.max_loops).toBe(1);
    expect(agent.stopping_condition).toBeNull();
    expect(agent.loop_interval).toBe(0);
    expect(agent.retry_attempts).toBe(3);
    expect(agent.retry_interval).toBe(1);
    expect(agent.return_history).toBe(false);
    expect(agent.stopping_token).toBeNull();
    expect(agent.dynamic_loops).toBe(false);
    expect(agent.interactive).toBe(false);
    expect(agent.dashboard).toBe(false);
    expect(agent.agent_name).toBe('swarm-worker-01');
    expect(agent.agent_description).toBeNull();
    expect(agent.system_prompt).toBe(AGENT_SYSTEM_PROMPT_3);
    expect(agent.tools).toBeNull();
    expect(agent.dynamic_temperature_enabled).toBe(false);
    expect(agent.sop).toBeNull();
    expect(agent.sop_list).toBeNull();
    expect(agent.saved_state_path).toBe('swarm-worker-01_state.json');
    expect(agent.autosave).toBe(false);
    expect(agent.context_length).toBe(8192);
    expect(agent.user_name).toBe('Human:');
  });

  test('should initialize tools if provided', () => {
    const tools = [new BaseTool()];
    agent = new Agent({ tools });
    expect(agent.tools).toBe(tools);
    expect(agent.initialize_tools).toHaveBeenCalledWith(tools);
  });

  test('should add task to memory', async () => {
    const task = 'Test task';
    await agent.add_task_to_memory(task);
    expect(agent.short_memory.add).toHaveBeenCalledWith('Human:', task);
  });

  test('should handle response', async () => {
    const response = 'Test response';
    await agent.handle_response(response);
    expect(logger.info).toHaveBeenCalledWith('swarm-worker-01: Test response');
    expect(agent.short_memory.add).toHaveBeenCalledWith('swarm-worker-01', response);
  });

  test('should save agent state', async () => {
    await agent.save();
    expect(logger.info).toHaveBeenCalledWith('Successfully saved agent state to: swarm-worker-01_state.json');
  });

  test('should load agent state', async () => {
    await agent.load('mock-path');
    expect(logger.info).toHaveBeenCalledWith('Successfully loaded agent state from: mock-path');
  });

  test('should call LLM with proper error handling', async () => {
    agent.llm = { run: jest.fn().mockResolvedValue('LLM response') };
    const response = await agent.call_llm('Test task');
    expect(response).toBe('LLM response');
  });

  test('should handle artifacts creation and saving', async () => {
    const text = 'Test artifact';
    const output_path = 'mock-path';
    const file_extension = '.json';
    await agent.handle_artifacts(text, output_path, file_extension);
    expect(logger.info).toHaveBeenCalledWith('Successfully saved artifact to mock-path/artifact_2023-10-10T10-10-10.000Z.json');
  });
});
