import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';
import pkg from 'tiktoken';
const { TikTokenizer } = pkg;
import { initializeLogger } from '../utils/loguru_logger.mjs';
import fs from 'fs';

const logger = initializeLogger();

/**
 * Metadata for memory entries
 */
class MemoryMetadata {
    constructor({
        timestamp = Date.now() / 1000,
        role = null,
        agentName = null,
        sessionId = null,
        memoryType = null,
        tokenCount = null,
        messageId = uuidv4()
    } = {}) {
        this.timestamp = timestamp;
        this.role = role;
        this.agentName = agentName;
        this.sessionId = sessionId;
        this.memoryType = memoryType;
        this.tokenCount = tokenCount;
        this.messageId = messageId;
    }
}

/**
 * Single memory entry with content and metadata
 */
class MemoryEntry {
    constructor({
        content = null,
        metadata = null
    } = {}) {
        this.content = content;
        this.metadata = metadata;
    }
}

/**
 * Configuration for memory manager
 */
export class MemoryConfig {
    constructor({
        maxShortTermTokens = 4096,
        maxEntries = null,
        systemMessagesTokenBuffer = 1000,
        enableLongTermMemory = false,
        autoArchive = true,
        archiveThreshold = 0.8
    } = {}) {
        this.maxShortTermTokens = maxShortTermTokens;
        this.maxEntries = maxEntries;
        this.systemMessagesTokenBuffer = systemMessagesTokenBuffer;
        this.enableLongTermMemory = enableLongTermMemory;
        this.autoArchive = autoArchive;
        this.archiveThreshold = archiveThreshold;
    }
}

/**
 * Manages both short-term and long-term memory for an agent
 */
export class MemoryManager {
    /**
     * @param {MemoryConfig} config - Configuration for memory management
     * @param {object} tokenizer - Tokenizer for token counting
     * @param {object} longTermMemory - Storage for long-term memory
     */
    constructor(
        config,
        tokenizer = null,
        longTermMemory = null
    ) {
        this.config = config;
        this.tokenizer = tokenizer || new TikTokenizer();
        this.longTermMemory = longTermMemory;

        this.shortTermMemory = [];
        this.systemMessages = [];
        this.totalTokensProcessed = 0;
        this.archivedEntriesCount = 0;
    }

    /**
     * Create a new memory entry with metadata
     */
    createMemoryEntry(content, role, agentName, sessionId, memoryType = "short_term") {
        const metadata = new MemoryMetadata({
            timestamp: Date.now() / 1000,
            role,
            agentName,
            sessionId,
            memoryType,
            tokenCount: this.tokenizer.countTokens(content)
        });
        return new MemoryEntry({ content, metadata });
    }

    /**
     * Add a new memory entry to appropriate storage
     */
    addMemory(content, role, agentName, sessionId, isSystem = false) {
        const entry = this.createMemoryEntry(
            content,
            role,
            agentName,
            sessionId,
            isSystem ? "system" : "short_term"
        );

        if (isSystem) {
            this.systemMessages.push(entry);
        } else {
            this.shortTermMemory.push(entry);
        }

        if (this.shouldArchive()) {
            this.archiveOldMemories();
        }

        this.totalTokensProcessed += entry.metadata.tokenCount;
    }

    // ... Convert remaining methods ...
    getCurrentTokenCount() {
        return this.shortTermMemory.reduce(
            (sum, entry) => sum + entry.metadata.tokenCount,
            0
        );
    }

    getSystemMessagesTokenCount() {
        return this.systemMessages.reduce(
            (sum, entry) => sum + entry.metadata.tokenCount,
            0
        );
    }

    shouldArchive() {
        if (!this.config.autoArchive) return false;
        const currentUsage = this.getCurrentTokenCount() / this.config.maxShortTermTokens;
        return currentUsage >= this.config.archiveThreshold;
    }

    // Add the missing getMemoryStats method
    getMemoryStats() {
        return {
            totalTokensProcessed: this.totalTokensProcessed,
            archivedEntriesCount: this.archivedEntriesCount,
            currentTokenCount: this.getCurrentTokenCount(),
            systemMessagesTokenCount: this.getSystemMessagesTokenCount(),
        };
    }

    /**
     * Save current memory state to file
     */
    async saveMemorySnapshot(filePath) {
        try {
            const data = {
                timestamp: new Date().toISOString(),
                config: this.config,
                systemMessages: this.systemMessages,
                shortTermMemory: this.shortTermMemory,
                stats: this.getMemoryStats()
            };

            const content = filePath.endsWith('.yaml') 
                ? YAML.stringify(data)
                : JSON.stringify(data, null, 2);

            await fs.promises.writeFile(filePath, content);
            logger.info(`Saved memory snapshot to ${filePath}`);

        } catch (error) {
            logger.error(`Error saving memory snapshot: ${error.message}`);
            throw error;
        }
    }

    // ... Additional method implementations following same patterns ...
}

export { MemoryMetadata, MemoryEntry };

// Example usage:
/*
const config = new MemoryConfig({
    maxShortTermTokens: 4096,
    enableLongTermMemory: true
});

const memoryManager = new MemoryManager(config);

// Add a memory
memoryManager.addMemory(
    "Hello world",
    "user",
    "test-agent",
    "session-1"
);

// Get memory stats
const stats = memoryManager.getMemoryStats();
console.log(stats);

// Save snapshot
await memoryManager.saveMemorySnapshot("memory.json");
*/