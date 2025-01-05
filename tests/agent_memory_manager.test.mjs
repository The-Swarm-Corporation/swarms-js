import { MemoryManager, MemoryConfig, MemoryMetadata, MemoryEntry } from '../swarms/structs/agent_memory_manager.mjs';
import { initializeLogger } from '../swarms/utils/loguru_logger.mjs';
import fs from 'fs';
import YAML from 'yaml';

jest.mock('tiktoken', () => {
  return {
    TikTokenizer: jest.fn().mockImplementation(() => {
      return {
        countTokens: jest.fn().mockReturnValue(5),
      };
    }),
  };
});
jest.mock('../swarms/utils/loguru_logger.mjs', () => {
  return {
    initializeLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
    }),
  };
});
jest.mock('fs');
jest.mock('yaml');

// Mock fs.promises
fs.promises = {
  writeFile: jest.fn(),
};

const logger = initializeLogger();

describe('MemoryManager', () => {
    let memoryManager;
    let config;
    let tokenizerMock;

    beforeEach(() => {
        config = new MemoryConfig();
        tokenizerMock = new (require('tiktoken').TikTokenizer)();
        memoryManager = new MemoryManager(config, tokenizerMock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createMemoryEntry', () => {
        test('should create a memory entry with correct metadata', () => {
            const content = 'test content';
            const role = 'user';
            const agentName = 'agent';
            const sessionId = 'session-1';

            const entry = memoryManager.createMemoryEntry(content, role, agentName, sessionId);

            expect(entry.content).toBe(content);
            expect(entry.metadata).toBeInstanceOf(MemoryMetadata);
            expect(entry.metadata.role).toBe(role);
            expect(entry.metadata.agentName).toBe(agentName);
            expect(entry.metadata.sessionId).toBe(sessionId);
            expect(entry.metadata.tokenCount).toBe(5);
        });
    });

    describe('addMemory', () => {
        test('should add a memory entry to shortTermMemory', () => {
            const content = 'test content';
            const role = 'user';
            const agentName = 'agent';
            const sessionId = 'session-1';

            memoryManager.addMemory(content, role, agentName, sessionId);

            expect(memoryManager.shortTermMemory.length).toBe(1);
            expect(memoryManager.shortTermMemory[0].content).toBe(content);
        });

        test('should add a system message to systemMessages', () => {
            const content = 'system message';
            const role = 'system';
            const agentName = 'agent';
            const sessionId = 'session-1';

            memoryManager.addMemory(content, role, agentName, sessionId, true);

            expect(memoryManager.systemMessages.length).toBe(1);
            expect(memoryManager.systemMessages[0].content).toBe(content);
        });

        test('should archive old memories if threshold is reached', () => {
            memoryManager.shouldArchive = jest.fn().mockReturnValue(true);
            memoryManager.archiveOldMemories = jest.fn();

            memoryManager.addMemory('test content', 'user', 'agent', 'session-1');

            expect(memoryManager.archiveOldMemories).toHaveBeenCalled();
        });
    });

    describe('getCurrentTokenCount', () => {
        test('should return the total token count of shortTermMemory', () => {
            memoryManager.addMemory('test content', 'user', 'agent', 'session-1');
            memoryManager.addMemory('another content', 'user', 'agent', 'session-1');

            expect(memoryManager.getCurrentTokenCount()).toBe(10);
        });
    });

    describe('getSystemMessagesTokenCount', () => {
        test('should return the total token count of systemMessages', () => {
            memoryManager.addMemory('system message', 'system', 'agent', 'session-1', true);
            memoryManager.addMemory('another system message', 'system', 'agent', 'session-1', true);

            expect(memoryManager.getSystemMessagesTokenCount()).toBe(10);
        });
    });

    describe('shouldArchive', () => {
        test('should return true if current token usage exceeds threshold', () => {
            memoryManager.getCurrentTokenCount = jest.fn().mockReturnValue(4000);

            expect(memoryManager.shouldArchive()).toBe(true);
        });

        test('should return false if autoArchive is disabled', () => {
            memoryManager.config.autoArchive = false;

            expect(memoryManager.shouldArchive()).toBe(false);
        });
    });

    describe('saveMemorySnapshot', () => {
        test('should save memory snapshot to a file', async () => {
            const filePath = 'memory.json';
            const writeFileMock = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue();

            await memoryManager.saveMemorySnapshot(filePath);

            expect(writeFileMock).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(`Saved memory snapshot to ${filePath}`);
        });

        test('should throw an error if saving fails', async () => {
            const filePath = 'memory.json';
            const error = new Error('Failed to save');
            jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(error);

            await expect(memoryManager.saveMemorySnapshot(filePath)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalledWith(`Error saving memory snapshot: ${error.message}`);
        });
    });
});
