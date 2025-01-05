import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.mjs';
import { BaseWorkflow } from './base_workflow.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

// Base logger initialization
const logger = initializeLogger("async_workflow");

/**
 * Agent output model for structured data
 */
class AgentOutput {
    constructor({
        agentId,
        agentName,
        taskId,
        input,
        output,
        startTime,
        endTime,
        status,
        error = null
    }) {
        this.agentId = agentId;
        this.agentName = agentName;
        this.taskId = taskId;
        this.input = input;
        this.output = output;
        this.startTime = startTime;
        this.endTime = endTime;
        this.status = status;
        this.error = error;
    }
}

/**
 * Workflow output model for structured data
 */
class WorkflowOutput {
    constructor({
        workflowId,
        workflowName,
        startTime,
        endTime,
        totalAgents,
        successfulTasks,
        failedTasks,
        agentOutputs,
        metadata = {}
    }) {
        this.workflowId = workflowId;
        this.workflowName = workflowName;
        this.startTime = startTime;
        this.endTime = endTime;
        this.totalAgents = totalAgents;
        this.successfulTasks = successfulTasks;
        this.failedTasks = failedTasks;
        this.agentOutputs = agentOutputs;
        this.metadata = metadata;
    }
}

/**
 * Enum for speaker roles
 */
const SpeakerRole = {
    COORDINATOR: "coordinator",
    CRITIC: "critic",
    EXECUTOR: "executor",
    VALIDATOR: "validator",
    DEFAULT: "default"
};

/**
 * Speaker message model
 */
class SpeakerMessage {
    constructor({
        role,
        content,
        timestamp,
        agentName,
        metadata = {}
    }) {
        this.role = role;
        this.content = content;
        this.timestamp = timestamp;
        this.agentName = agentName;
        this.metadata = metadata;
    }
}

/**
 * Group chat configuration
 */
class GroupChatConfig {
    constructor({
        maxLoops = 10,
        timeoutPerTurn = 30.0,
        requireAllSpeakers = false,
        allowConcurrent = true,
        saveHistory = true
    } = {}) {
        this.maxLoops = maxLoops;
        this.timeoutPerTurn = timeoutPerTurn;
        this.requireAllSpeakers = requireAllSpeakers;
        this.allowConcurrent = allowConcurrent;
        this.saveHistory = saveHistory;
    }
}

/**
 * Shared memory item model
 */
class SharedMemoryItem {
    constructor({
        key,
        value,
        timestamp,
        author,
        metadata = null
    }) {
        this.key = key;
        this.value = value;
        this.timestamp = timestamp;
        this.author = author;
        this.metadata = metadata;
    }
}

/**
 * Thread-safe shared memory implementation with persistence
 */
class SharedMemory {
    constructor(persistencePath = null) {
        this._memory = new Map();
        this._persistencePath = persistencePath;
        this._loadFromDisk();
    }

    /**
     * Set a value in shared memory
     */
    set(key, value, author, metadata = null) {
        const item = new SharedMemoryItem({
            key,
            value,
            timestamp: new Date(),
            author,
            metadata: metadata || {}
        });
        this._memory.set(key, item);
        this._persistToDisk();
    }

    /**
     * Get a value from shared memory
     */
    get(key) {
        const item = this._memory.get(key);
        return item ? item.value : null;
    }

    /**
     * Get value with metadata
     */
    getWithMetadata(key) {
        return this._memory.get(key);
    }

    /**
     * Persist memory to disk
     */
    async _persistToDisk() {
        if (!this._persistencePath) return;

        try {
            const data = Object.fromEntries(
                Array.from(this._memory.entries()).map(([k, v]) => [k, v])
            );
            await fs.promises.writeFile(
                this._persistencePath,
                JSON.stringify(data, null, 2)
            );
        } catch (error) {
            logger.error(`Error persisting memory: ${error.message}`);
        }
    }

    /**
     * Load memory from disk
     */
    async _loadFromDisk() {
        if (!this._persistencePath) return;

        try {
            if (await fs.promises.access(this._persistencePath).catch(() => false)) {
                const data = JSON.parse(
                    await fs.promises.readFile(this._persistencePath, 'utf8')
                );
                this._memory = new Map(
                    Object.entries(data).map(([k, v]) => [k, new SharedMemoryItem(v)])
                );
            }
        } catch (error) {
            logger.error(`Error loading memory: ${error.message}`);
        }
    }
}

/**
 * Speaker configuration model
 */
class SpeakerConfig {
    constructor({
        role,
        agent,
        priority = 0,
        concurrent = true,
        timeout = 30.0,
        required = false
    }) {
        this.role = role;
        this.agent = agent;
        this.priority = priority;
        this.concurrent = concurrent;
        this.timeout = timeout;
        this.required = required;
    }
}

/**
 * Manages speaker interactions and group chat functionality
 */
class SpeakerSystem {
    constructor(defaultTimeout = 30.0) {
        this.speakers = new Map();
        this.messageHistory = [];
        this.defaultTimeout = defaultTimeout;
    }

    /**
     * Add a speaker to the system
     */
    addSpeaker(config) {
        this.speakers.set(config.role, config);
    }

    /**
     * Remove a speaker from the system
     */
    removeSpeaker(role) {
        this.speakers.delete(role);
    }

    /**
     * Execute a speaker's task
     */
    async _executeSpeaker(config, inputData, context = null) {
        try {
            const result = await Promise.race([
                config.agent.run(inputData),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), config.timeout * 1000)
                )
            ]);

            return new SpeakerMessage({
                role: config.role,
                content: result,
                timestamp: new Date(),
                agentName: config.agent.agentName,
                metadata: { context: context || {} }
            });
        } catch (error) {
            return new SpeakerMessage({
                role: config.role,
                content: null,
                timestamp: new Date(),
                agentName: config.agent.agentName,
                metadata: { error: error.message }
            });
        }
    }
}

/**
 * Enhanced asynchronous workflow with advanced speaker system
 */
export class AsyncWorkflow extends BaseWorkflow {
    /**
     * @param {string} name - Workflow name
     * @param {Array<Agent>} agents - List of agents
     * @param {number} maxWorkers - Maximum concurrent workers
     * @param {boolean} dashboard - Enable dashboard
     * @param {boolean} autosave - Enable autosave
     * @param {boolean} verbose - Enable verbose logging
     * @param {string} logPath - Path to log file
     * @param {string} sharedMemoryPath - Path for shared memory persistence
     * @param {boolean} enableGroupChat - Enable group chat functionality
     * @param {GroupChatConfig} groupChatConfig - Group chat configuration
     */
    constructor({
        name = "AsyncWorkflow",
        agents = null,
        maxWorkers = 5,
        dashboard = false,
        autosave = false,
        verbose = false,
        logPath = "workflow.log",
        sharedMemoryPath = "shared_memory.json",
        enableGroupChat = false,
        groupChatConfig = null,
        ...kwargs
    } = {}) {
        super({ agents, ...kwargs });
        
        this.workflowId = uuidv4();
        this.name = name;
        this.agents = agents || [];
        this.maxWorkers = maxWorkers;
        this.dashboard = dashboard;
        this.autosave = autosave;
        this.verbose = verbose;
        this.taskPool = [];
        this.results = [];
        
        this.sharedMemory = new SharedMemory(sharedMemoryPath);
        this.speakerSystem = new SpeakerSystem();
        this.enableGroupChat = enableGroupChat;
        this.groupChatConfig = groupChatConfig || new GroupChatConfig();
        
        this._setupLogging(logPath);
        this.metadata = {};
    }

    /**
     * Configure rotating file logger
     */
    _setupLogging(logPath) {
        // Note: Implement appropriate logging setup for Node.js
        this.logger = logger;
        if (this.verbose) {
            logger.level = 'debug';
        }
    }

    /**
     * Add all agents as default concurrent speakers
     */
    addDefaultSpeakers() {
        for (const agent of this.agents) {
            const config = new SpeakerConfig({
                role: SpeakerRole.DEFAULT,
                agent: agent,
                concurrent: true,
                timeout: 30.0,
                required: false
            });
            this.speakerSystem.addSpeaker(config);
        }
    }

    /**
     * Run all concurrent speakers in parallel
     */
    async runConcurrentSpeakers(task, context = null) {
        const concurrentTasks = Array.from(this.speakerSystem.speakers.values())
            .filter(config => config.concurrent)
            .map(config => this.speakerSystem._executeSpeaker(config, task, context));

        const results = await Promise.allSettled(concurrentTasks);
        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(msg => msg instanceof SpeakerMessage);
    }

    /**
     * Run non-concurrent speakers in sequence
     */
    async runSequentialSpeakers(task, context = null) {
        const results = [];
        const sortedSpeakers = Array.from(this.speakerSystem.speakers.values())
            .filter(config => !config.concurrent)
            .sort((a, b) => a.priority - b.priority);

        for (const config of sortedSpeakers) {
            const result = await this.speakerSystem._executeSpeaker(config, task, context);
            results.push(result);
        }
        return results;
    }

    /**
     * Run a group chat discussion among speakers
     */
    async runGroupChat(initialMessage, context = null) {
        if (!this.enableGroupChat) {
            throw new Error("Group chat is not enabled for this workflow");
        }

        const messages = [];
        let currentTurn = 0;

        while (currentTurn < this.groupChatConfig.maxLoops) {
            const turnContext = {
                turn: currentTurn,
                history: messages,
                ...(context || {})
            };

            const turnMessages = this.groupChatConfig.allowConcurrent ?
                await this.runConcurrentSpeakers(
                    currentTurn === 0 ? initialMessage : messages[messages.length - 1].content,
                    turnContext
                ) :
                await this.runSequentialSpeakers(
                    currentTurn === 0 ? initialMessage : messages[messages.length - 1].content,
                    turnContext
                );

            messages.push(...turnMessages);

            if (this._shouldEndGroupChat(messages)) {
                break;
            }

            currentTurn++;
        }

        if (this.groupChatConfig.saveHistory) {
            this.speakerSystem.messageHistory.push(...messages);
        }

        return messages;
    }

    /**
     * Execute a single agent task with enhanced error handling and monitoring
     */
    async _executeAgentTask(agent, task) {
        const startTime = new Date();
        const taskId = uuidv4();

        try {
            logger.info(`Agent ${agent.agentName} starting task ${taskId}: ${task}`);
            const result = await agent.run(task);
            const endTime = new Date();
            
            logger.info(`Agent ${agent.agentName} completed task ${taskId}`);

            return new AgentOutput({
                agentId: String(agent.id),
                agentName: agent.agentName,
                taskId,
                input: task,
                output: result,
                startTime,
                endTime,
                status: "success"
            });
        } catch (error) {
            const endTime = new Date();
            logger.error(`Error in agent ${agent.agentName} task ${taskId}: ${error.message}`);

            return new AgentOutput({
                agentId: String(agent.id),
                agentName: agent.agentName,
                taskId,
                input: task,
                output: null,
                startTime,
                endTime,
                status: "error",
                error: error.message
            });
        }
    }

    /**
     * Enhanced workflow execution with speaker system integration
     */
    async run(task) {
        if (!this.agents.length) {
            throw new Error("No agents provided to the workflow");
        }

        const startTime = new Date();

        try {
            // Run speakers first if enabled
            let speakerOutputs = [];
            if (this.enableGroupChat) {
                speakerOutputs = await this.runGroupChat(task);
            } else {
                const concurrentOutputs = await this.runConcurrentSpeakers(task);
                const sequentialOutputs = await this.runSequentialSpeakers(task);
                speakerOutputs = [...concurrentOutputs, ...sequentialOutputs];
            }

            // Store speaker outputs in shared memory
            this.sharedMemory.set(
                "speaker_outputs",
                speakerOutputs.map(msg => msg.toJSON()),
                "workflow"
            );

            // Execute all agent tasks concurrently
            const agentPromises = this.agents.map(agent => 
                this._executeAgentTask(agent, task)
            );
            
            const agentOutputs = await Promise.all(agentPromises);
            const endTime = new Date();

            // Calculate success/failure counts
            const successfulTasks = agentOutputs.filter(
                output => output.status === "success"
            ).length;
            
            const failedTasks = agentOutputs.length - successfulTasks;

            return new WorkflowOutput({
                workflowId: this.workflowId,
                workflowName: this.name,
                startTime,
                endTime,
                totalAgents: this.agents.length,
                successfulTasks,
                failedTasks,
                agentOutputs,
                metadata: {
                    maxWorkers: this.maxWorkers,
                    sharedMemoryKeys: Array.from(this.sharedMemory._memory.keys()),
                    groupChatEnabled: this.enableGroupChat,
                    totalSpeakerMessages: speakerOutputs.length,
                    speakerOutputs: speakerOutputs.map(msg => msg.toJSON())
                }
            });

        } catch (error) {
            logger.error(`Critical workflow error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save workflow results to disk
     */
    async _saveResults(startTime, endTime) {
        if (!this.autosave) return;

        const outputDir = "workflow_outputs";
        await fs.promises.mkdir(outputDir, { recursive: true });

        const filename = `${outputDir}/workflow_${this.workflowId}_${endTime.toISOString().replace(/[:.]/g, '_')}.json`;

        try {
            const data = {
                workflow_id: this.workflowId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                results: this.results.map(result => {
                    if (result?.toJSON) return result.toJSON();
                    if (result?.toString) return result.toString();
                    return String(result);
                }),
                speaker_history: this.speakerSystem.messageHistory.map(msg => msg.toJSON()),
                metadata: this.metadata
            };

            await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
            logger.info(`Workflow results saved to ${filename}`);
        } catch (error) {
            logger.error(`Error saving workflow results: ${error.message}`);
        }
    }

    /**
     * Cleanup workflow resources
     */
    async cleanup() {
        try {
            // Persist final state if autosave enabled
            if (this.autosave) {
                const endTime = new Date();
                await this._saveResults(
                    this.results[0]?.startTime || endTime,
                    endTime
                );
            }

            // Clear shared memory
            this.sharedMemory._memory.clear();
            
            logger.info("Workflow cleanup completed successfully");
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate workflow configuration
     */
    _validateConfig() {
        if (this.maxWorkers < 1) {
            throw new Error("maxWorkers must be at least 1");
        }

        if (this.enableGroupChat && !this.speakerSystem.speakers.size) {
            throw new Error("Group chat enabled but no speakers configured");
        }

        for (const config of this.speakerSystem.speakers.values()) {
            if (config.timeout <= 0) {
                throw new Error(`Invalid timeout for speaker ${config.role}`);
            }
        }
    }

    /**
     * Determine if group chat should end based on messages
     */
    _shouldEndGroupChat(messages) {
        if (!messages.length) return true;

        if (this.groupChatConfig.requireAllSpeakers) {
            const participatingRoles = new Set(messages.map(msg => msg.role));
            const requiredRoles = new Set(
                Array.from(this.speakerSystem.speakers.values())
                    .filter(config => config.required)
                    .map(config => config.role)
            );
            
            return Array.from(requiredRoles).every(role => participatingRoles.has(role));
        }
        
        return false;
    }

    /**
     * Context manager for task execution with proper cleanup
     */
    async withTaskContext(taskFn) {
        const startTime = new Date();
        try {
            return await taskFn();
        } finally {
            const endTime = new Date();
            if (this.autosave) {
                await this._saveResults(startTime, endTime);
            }
        }
    }

    /**
     * Log step metadata
     */
    logStepMetadata(loop, task, response) {
        const stepId = `step_${loop}_${uuidv4()}`;
        const stepLog = new Step({
            stepId,
            time: Date.now() / 1000,
            tokens: this.tokenizer.countTokens(task) + this.tokenizer.countTokens(response),
            response: new AgentChatCompletionResponse({
                id: this.workflowId,
                agentName: this.name,
                object: "chat.completion",
                choices: new ChatCompletionResponseChoice({
                    index: loop,
                    input: task,
                    message: new ChatMessageResponse({
                        role: this.name,
                        content: response
                    })
                })
            })
        });

        this.stepPool.push(stepLog);
        return stepId;
    }

    /**
     * Update tool usage information for a specific step
     */
    updateToolUsage(stepId, toolName, toolArgs, toolResponse) {
        for (const step of this.stepPool) {
            if (step.stepId === stepId) {
                step.response.toolCalls.push({
                    tool: toolName,
                    arguments: toolArgs,
                    response: String(toolResponse)
                });
                break;
            }
        }
    }
}

// Utility functions
export function createDefaultWorkflow(agents, name = "DefaultWorkflow", enableGroupChat = false) {
    const workflow = new AsyncWorkflow({
        name,
        agents,
        maxWorkers: agents.length,
        dashboard: true,
        autosave: true,
        verbose: true,
        enableGroupChat,
        groupChatConfig: new GroupChatConfig({
            maxLoops: 5,
            allowConcurrent: true,
            requireAllSpeakers: false
        })
    });

    workflow.addDefaultSpeakers();
    return workflow;
}

export async function runWorkflowWithRetry(workflow, task, maxRetries = 3, retryDelay = 1.0) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await workflow.run(task);
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            logger.warning(
                `Attempt ${attempt + 1} failed, retrying in ${retryDelay} seconds: ${error.message}`
            );
            await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
            retryDelay *= 2; // Exponential backoff
        }
    }
}

/**
 * Create a set of specialized agents for financial analysis
 */
async function createSpecializedAgents() {
    // Base model configuration
    const model = new OpenAIChat({
        modelName: "gpt-4",
        // ...other model settings
    });

    // Financial Analysis Agent
    const financialAgent = new Agent({
        agentName: "Financial-Analysis-Agent",
        agentDescription: "Personal finance advisor agent",
        systemPrompt: FINANCIAL_AGENT_SYS_PROMPT +
            "Output the <DONE> token when you're done creating a portfolio of etfs, index, funds, and more for AI",
        maxLoops: 1,
        llm: model,
        dynamicTemperatureEnabled: true,
        userName: "Kye",
        retryAttempts: 3,
        contextLength: 8192,
        returnStepMeta: false,
        outputType: "str",
        autoGeneratePrompt: false,
        maxTokens: 4000,
        stoppingToken: "<DONE>",
        savedStatePath: "financial_agent.json",
        interactive: false
    });

    // Risk Assessment Agent
    const riskAgent = new Agent({
        agentName: "Risk-Assessment-Agent",
        agentDescription: "Investment risk analysis specialist",
        systemPrompt: "Analyze investment risks and provide risk scores. Output <DONE> when analysis is complete.",
        maxLoops: 1,
        llm: model,
        dynamicTemperatureEnabled: true,
        userName: "Kye",
        retryAttempts: 3,
        contextLength: 8192,
        outputType: "str",
        maxTokens: 4000,
        stoppingToken: "<DONE>",
        savedStatePath: "risk_agent.json",
        interactive: false
    });

    // Market Research Agent
    const researchAgent = new Agent({
        agentName: "Market-Research-Agent",
        agentDescription: "AI and tech market research specialist",
        systemPrompt: "Research AI market trends and growth opportunities. Output <DONE> when research is complete.",
        maxLoops: 1,
        llm: model,
        dynamicTemperatureEnabled: true,
        userName: "Kye",
        retryAttempts: 3,
        contextLength: 8192,
        outputType: "str",
        maxTokens: 4000,
        stoppingToken: "<DONE>",
        savedStatePath: "research_agent.json",
        interactive: false
    });

    return [financialAgent, riskAgent, researchAgent];
}

/**
 * Main example implementation
 */
async function main() {
    try {
        // Create specialized agents
        const agents = await createSpecializedAgents();

        // Create workflow with group chat enabled
        const workflow = createDefaultWorkflow(
            agents,
            "AI-Investment-Analysis-Workflow",
            true
        );

        // Configure speaker roles
        workflow.speakerSystem.addSpeaker(new SpeakerConfig({
            role: SpeakerRole.COORDINATOR,
            agent: agents[0],  // Financial agent as coordinator
            priority: 1,
            concurrent: false,
            required: true
        }));

        workflow.speakerSystem.addSpeaker(new SpeakerConfig({
            role: SpeakerRole.CRITIC,
            agent: agents[1],  // Risk agent as critic
            priority: 2,
            concurrent: true
        }));

        workflow.speakerSystem.addSpeaker(new SpeakerConfig({
            role: SpeakerRole.EXECUTOR,
            agent: agents[2],  // Research agent as executor
            priority: 2,
            concurrent: true
        }));

        // Investment analysis task
        const investmentTask = `
            Create a comprehensive investment analysis for a $40k portfolio focused on AI growth opportunities:
            1. Identify high-growth AI ETFs and index funds
            2. Analyze risks and potential returns
            3. Create a diversified portfolio allocation
            4. Provide market trend analysis
            Present the results in a structured markdown format.
        `;

        // Run workflow with retry
        const result = await runWorkflowWithRetry(workflow, investmentTask, 3);

        console.log("\nWorkflow Results:");
        console.log("================");

        // Process and display agent outputs
        for (const output of result.agentOutputs) {
            console.log(`\nAgent: ${output.agentName}`);
            console.log("-".repeat(output.agentName.length + 8));
            console.log(output.output);
        }

        // Display group chat history if enabled
        if (workflow.enableGroupChat) {
            console.log("\nGroup Chat Discussion:");
            console.log("=====================");
            for (const msg of workflow.speakerSystem.messageHistory) {
                console.log(`\n${msg.role} (${msg.agentName}):`);
                console.log(msg.content);
            }
        }

        // Display shared insights
        if (result.metadata.sharedMemoryKeys?.length) {
            console.log("\nShared Insights:");
            console.log("===============");
            for (const key of result.metadata.sharedMemoryKeys) {
                const value = workflow.sharedMemory.get(key);
                if (value) {
                    console.log(`\n${key}:`);
                    console.log(value);
                }
            }
        }

    } catch (error) {
        console.error(`Workflow failed: ${error.message}`);
    } finally {
        await workflow.cleanup();
    }
}

// Only run the example if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    main().catch(console.error);
}

export {
    AsyncWorkflow,
    createDefaultWorkflow,
    runWorkflowWithRetry,
    createSpecializedAgents,
    SpeakerRole,
    SpeakerConfig,
    GroupChatConfig
};

/* Example usage (commented out):
// Example of specialized agents creation and workflow execution in JavaScript
async function main() {
    try {
        // Create specialized agents
        const agents = await createSpecializedAgents();

        // Create workflow with group chat enabled
        const workflow = createDefaultWorkflow(
            agents,
            "AI-Investment-Analysis-Workflow",
            true
        );

        // Configure speaker roles with Financial, Risk, and Research agents
        const speakerConfigs = [
            {
                role: SpeakerRole.COORDINATOR,
                agent: agents[0],  // Financial agent as coordinator
                priority: 1,
                concurrent: false,
                required: true
            },
            {
                role: SpeakerRole.CRITIC,
                agent: agents[1],  // Risk agent as critic
                priority: 2,
                concurrent: true
            },
            {
                role: SpeakerRole.EXECUTOR,
                agent: agents[2],  // Research agent as executor
                priority: 2,
                concurrent: true
            }
        ];

        // Add all speakers to the workflow
        speakerConfigs.forEach(config => 
            workflow.speakerSystem.addSpeaker(new SpeakerConfig(config))
        );

        // Define the investment analysis task
        const investmentTask = `
            Create a comprehensive investment analysis for a $40k portfolio focused on AI growth opportunities:
            1. Identify high-growth AI ETFs and index funds
            2. Analyze risks and potential returns
            3. Create a diversified portfolio allocation
            4. Provide market trend analysis
            Present the results in a structured markdown format.
        `;

        // Run workflow with retry
        const result = await runWorkflowWithRetry(workflow, investmentTask, 3);

        // Display workflow results
        console.log("\nWorkflow Results:");
        console.log("================");

        // Process and display agent outputs
        for (const output of result.agentOutputs) {
            console.log(`\nAgent: ${output.agentName}`);
            console.log("-".repeat(output.agentName.length + 8));
            console.log(output.output);
        }

        // Display group chat history if enabled
        if (workflow.enableGroupChat) {
            console.log("\nGroup Chat Discussion:");
            console.log("=====================");
            for (const msg of workflow.speakerSystem.messageHistory) {
                console.log(`\n${msg.role} (${msg.agentName}):`);
                console.log(msg.content);
            }
        }

        // Display shared insights
        const sharedMemoryKeys = result.metadata.sharedMemoryKeys;
        if (sharedMemoryKeys?.length) {
            console.log("\nShared Insights:");
            console.log("===============");
            for (const key of sharedMemoryKeys) {
                const value = workflow.sharedMemory.get(key);
                if (value) {
                    console.log(`\n${key}:`);
                    console.log(value);
                }
            }
        }

    } catch (error) {
        console.error(`Workflow failed: ${error.message}`);
    } finally {
        await workflow.cleanup();
    }
}

// Run example if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
    main().catch(console.error);
}

// Example agent configurations:
const FINANCIAL_AGENT_CONFIG = {
    agentName: "Financial-Analysis-Agent",
    agentDescription: "Personal finance advisor agent",
    systemPrompt: FINANCIAL_AGENT_SYS_PROMPT +
        "Output the <DONE> token when you're done creating a portfolio of etfs, index, funds, and more for AI",
    maxLoops: 1,
    dynamicTemperatureEnabled: true,
    userName: "Kye",
    retryAttempts: 3,
    contextLength: 8192,
    returnStepMeta: false,
    outputType: "str",
    autoGeneratePrompt: false,
    maxTokens: 4000,
    stoppingToken: "<DONE>",
    savedStatePath: "financial_agent.json",
    interactive: false
};

const RISK_AGENT_CONFIG = {
    agentName: "Risk-Assessment-Agent",
    agentDescription: "Investment risk analysis specialist",
    systemPrompt: "Analyze investment risks and provide risk scores. Output <DONE> when analysis is complete.",
    maxLoops: 1,
    dynamicTemperatureEnabled: true,
    userName: "Kye",
    retryAttempts: 3,
    contextLength: 8192,
    outputType: "str",
    maxTokens: 4000,
    stoppingToken: "<DONE>",
    savedStatePath: "risk_agent.json",
    interactive: false
};

const MARKET_RESEARCH_CONFIG = {
    agentName: "Market-Research-Agent",
    agentDescription: "AI and tech market research specialist",
    systemPrompt: "Research AI market trends and growth opportunities. Output <DONE> when research is complete.",
    maxLoops: 1,
    dynamicTemperatureEnabled: true,
    userName: "Kye",
    retryAttempts: 3,
    contextLength: 8192,
    outputType: "str",
    maxTokens: 4000,
    stoppingToken: "<DONE>",
    savedStatePath: "research_agent.json",
    interactive: false
};
*/