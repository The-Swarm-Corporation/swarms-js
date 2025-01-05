import fs from 'fs';
import yaml from 'yaml';
import { BaseStructure } from './base_structure.mjs';
import { formatter } from '../utils/formatter.mjs';

/**
 * A class structure to represent a conversation in a chatbot.
 * This class is used to store the conversation history.
 * It can be used to save the conversation history to a file, load the conversation history from a file, and display the conversation history.
 */
export class Conversation extends BaseStructure {
    /**
     * @param {string} [systemPrompt=null] - System prompt for the conversation
     * @param {boolean} [timeEnabled=false] - Whether to enable timestamps for the conversation history
     * @param {boolean} [autosave=false] - Whether to autosave the conversation history to a file
     * @param {string} [saveFilepath=null] - The filepath to save the conversation history to
     * @param {object} [tokenizer=null] - Tokenizer for truncating conversation history
     * @param {number} [contextLength=8192] - Maximum context length for the conversation
     * @param {string} [rules=null] - Rules for the conversation
     * @param {string} [customRulesPrompt=null] - Custom rules prompt for the conversation
     * @param {string} [user="User:"] - User identifier
     * @param {boolean} [autoSave=true] - Whether to automatically save the conversation history
     * @param {boolean} [saveAsYaml=true] - Whether to save the conversation history as YAML
     * @param {boolean} [saveAsJsonBool=false] - Whether to save the conversation history as JSON
     */
    constructor({
        systemPrompt = null,
        timeEnabled = false,
        autosave = false,
        saveFilepath = null,
        tokenizer = null,
        contextLength = 8192,
        rules = null,
        customRulesPrompt = null,
        user = "User:",
        autoSave = true,
        saveAsYaml = true,
        saveAsJsonBool = false,
        ...args
    } = {}) {
        super(args);
        this.systemPrompt = systemPrompt;
        this.timeEnabled = timeEnabled;
        this.autosave = autosave;
        this.saveFilepath = saveFilepath;
        this.conversationHistory = [];
        this.tokenizer = tokenizer;
        this.contextLength = contextLength;
        this.rules = rules;
        this.customRulesPrompt = customRulesPrompt;
        this.user = user;
        this.autoSave = autoSave;
        this.saveAsYaml = saveAsYaml;
        this.saveAsJsonBool = saveAsJsonBool;

        // If system prompt is not null, add it to the conversation history
        if (this.systemPrompt !== null) {
            this.add("System: ", this.systemPrompt);
        }

        if (this.rules !== null) {
            this.add("User", rules);
        }

        if (customRulesPrompt !== null) {
            this.add(user || "User", customRulesPrompt);
        }

        // If tokenizer is provided, truncate the memory
        if (tokenizer !== null) {
            this.truncateMemoryWithTokenizer();
        }
    }

    /**
     * Add a message to the conversation history
     * @param {string} role - The role of the speaker
     * @param {string} content - The content of the message
     */
    add(role, content) {
        const message = this.timeEnabled
            ? {
                  role,
                  content,
                  timestamp: new Date().toISOString()
              }
            : { role, content };

        this.conversationHistory.push(message);

        if (this.autosave) {
            this.saveAsJson(this.saveFilepath);
        }
    }

    /**
     * Delete a message from the conversation history
     * @param {number} index - Index of the message to delete
     */
    delete(index) {
        this.conversationHistory.splice(index, 1);
    }

    /**
     * Update a message in the conversation history
     * @param {number} index - Index of the message to update
     * @param {string} role - Role of the speaker
     * @param {string} content - Content of the message
     */
    update(index, role, content) {
        this.conversationHistory[index] = { role, content };
    }

    /**
     * Query a message in the conversation history
     * @param {number} index - Index of the message to query
     * @returns {object} The message
     */
    query(index) {
        return this.conversationHistory[index];
    }

    /**
     * Search for a message in the conversation history
     * @param {string} keyword - Keyword to search for
     * @returns {Array<object>} List of messages containing the keyword
     */
    search(keyword) {
        return this.conversationHistory.filter(msg => msg.content.includes(keyword));
    }

    /**
     * Display the conversation history
     * @param {boolean} [detailed=false] - Whether to display detailed information
     */
    displayConversation(detailed = false) {
        this.conversationHistory.forEach(message => {
            formatter.printPanel(`${message.role}: ${message.content}\n\n`);
        });
    }

    /**
     * Export the conversation history to a file
     * @param {string} filename - Filename to export to
     */
    exportConversation(filename) {
        fs.writeFileSync(
            filename,
            this.conversationHistory.map(msg => `${msg.role}: ${msg.content}\n`).join('')
        );
    }

    /**
     * Import a conversation history from a file
     * @param {string} filename - Filename to import from
     */
    importConversation(filename) {
        const lines = fs.readFileSync(filename, 'utf8').split('\n');
        lines.forEach(line => {
            const [role, content] = line.split(': ', 2);
            this.add(role, content.trim());
        });
    }

    /**
     * Count the number of messages by role
     * @returns {object} Counts of messages by role
     */
    countMessagesByRole() {
        return this.conversationHistory.reduce(
            (counts, msg) => {
                counts[msg.role] = (counts[msg.role] || 0) + 1;
                return counts;
            },
            { system: 0, user: 0, assistant: 0, function: 0 }
        );
    }

    /**
     * Return the conversation history as a string
     * @returns {string} The conversation history
     */
    returnHistoryAsString() {
        return this.conversationHistory.map(msg => `${msg.role}: ${msg.content}\n\n`).join('');
    }

    /**
     * Save the conversation history as a JSON file
     * @param {string} [filename=null] - Filename to save to
     */
    saveAsJson(filename = null) {
        if (filename !== null) {
            fs.writeFileSync(filename, JSON.stringify(this.conversationHistory, null, 2));
        }
    }

    /**
     * Load the conversation history from a JSON file
     * @param {string} filename - Filename to load from
     */
    loadFromJson(filename) {
        this.conversationHistory = JSON.parse(fs.readFileSync(filename, 'utf8'));
    }

    /**
     * Search for a keyword in the conversation history
     * @param {string} keyword - Keyword to search for
     * @returns {Array<object>} List of messages containing the keyword
     */
    searchKeywordInConversation(keyword) {
        return this.conversationHistory.filter(msg => msg.content.includes(keyword));
    }

    /**
     * Pretty print the conversation history
     * @param {Array<object>} messages - Messages to print
     */
    prettyPrintConversation(messages) {
        const roleToColor = {
            system: 'red',
            user: 'green',
            assistant: 'blue',
            tool: 'magenta'
        };

        messages.forEach(message => {
            const color = roleToColor[message.role] || 'white';
            formatter.printPanel(`${message.role}: ${message.content}\n`, color);
        });
    }

    /**
     * Truncate the conversation history based on the total number of tokens using a tokenizer
     */
    truncateMemoryWithTokenizer() {
        let totalTokens = 0;
        const truncatedHistory = [];

        for (const message of this.conversationHistory) {
            const tokens = this.tokenizer.countTokens(message.content);
            totalTokens += tokens;

            if (totalTokens <= this.contextLength) {
                truncatedHistory.push(message);
            } else {
                const remainingTokens = this.contextLength - (totalTokens - tokens);
                const truncatedContent = message.content.slice(0, remainingTokens);
                truncatedHistory.push({ role: message.role, content: truncatedContent });
                break;
            }
        }

        this.conversationHistory = truncatedHistory;
    }

    /**
     * Clear the conversation history
     */
    clear() {
        this.conversationHistory = [];
    }

    /**
     * Convert the conversation history to JSON
     * @returns {string} JSON representation of the conversation history
     */
    toJson() {
        return JSON.stringify(this.conversationHistory, null, 2);
    }

    /**
     * Convert the conversation history to a dictionary
     * @returns {Array<object>} Dictionary representation of the conversation history
     */
    toDict() {
        return this.conversationHistory;
    }

    /**
     * Convert the conversation history to YAML
     * @returns {string} YAML representation of the conversation history
     */
    toYaml() {
        return yaml.stringify(this.conversationHistory);
    }

    /**
     * Get the visible messages for a given agent and turn
     * @param {Agent} agent - The agent
     * @param {number} turn - The turn number
     * @returns {Array<object>} List of visible messages
     */
    getVisibleMessages(agent, turn) {
        const prevMessages = this.conversationHistory.filter(msg => msg.turn < turn);
        return prevMessages.filter(msg => msg.visible_to === 'all' || msg.visible_to.includes(agent.agentName));
    }
}

// Example usage:
// const conversation = new Conversation();
// conversation.add("user", "Hello, how are you?");
// conversation.add("assistant", "I am doing well, thanks.");
// console.log(conversation.toJson());
// console.log(conversation.toDict());
// console.log(conversation.toYaml());