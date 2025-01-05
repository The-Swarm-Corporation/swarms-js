import { execSync } from 'child_process';
import { config as loadEnv } from 'dotenv';
import { initialize_logger } from '../utils/loguru_logger.mjs';
import { Agent } from '../structs/agent.mjs';
import openai from 'openai';

const logger = initialize_logger({ log_folder: "openai_assistant" });

loadEnv();

/**
 * Check if the OpenAI package is installed, and install it if not.
 * 
 * @returns {Object} - The OpenAI package.
 * @throws {Error} - If the OpenAI package installation fails.
 */
function checkOpenAIPackage() {
    try {
        return openai;
    } catch (e) {
        logger.info("OpenAI package not found. Attempting to install...");

        try {
            execSync('npm install openai', { stdio: 'inherit' });
            logger.info("OpenAI package installed successfully.");
            return openai;
        } catch (e) {
            logger.error(`Failed to install OpenAI package: ${e.message}`);
            throw new Error("OpenAI package installation failed.");
        }
    }
}

class OpenAIAssistant extends Agent {
    /**
     * OpenAI Assistant wrapper for the swarms framework.
     * Integrates OpenAI's Assistants API with the swarms architecture.
     * 
     * @example
     * const assistant = new OpenAIAssistant({
     *     name: "Math Tutor",
     *     instructions: "You are a personal math tutor.",
     *     model: "gpt-4o",
     *     tools: [{ type: "code_interpreter" }]
     * });
     * const response = assistant.run("Solve 3x + 11 = 14");
     */
    constructor({
        name,
        description = "Standard openai assistant wrapper",
        instructions = null,
        model = "gpt-4o",
        tools = [],
        file_ids = [],
        metadata = {},
        functions = [],
        ...args
    }) {
        super(...args);
        this.name = name;
        this.description = description;
        this.instructions = instructions;
        this.model = model;
        this.tools = tools;
        this.file_ids = file_ids;
        this.metadata = metadata;
        this.functions = functions;

        if (functions) {
            for (const func of functions) {
                this.tools.push({ type: "function", function: func });
            }
        }

        this.client = checkOpenAIPackage().OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.assistant = this.client.beta.assistants.create({
            name,
            instructions,
            model,
            tools: this.tools,
            metadata
        });

        this.availableFunctions = {};
    }

    /**
     * Add a function that the assistant can call.
     * 
     * @param {Function} func - The function to make available to the assistant.
     * @param {string} description - Description of what the function does.
     * @param {Object} parameters - JSON schema describing the function parameters.
     */
    addFunction(func, description, parameters) {
        const funcDict = {
            name: func.name,
            description,
            parameters
        };

        this.tools.push({ type: "function", function: funcDict });
        this.availableFunctions[func.name] = func;

        this.assistant = this.client.beta.assistants.update({
            assistantId: this.assistant.id,
            tools: this.tools
        });
    }

    /**
     * Handle any required tool calls during a run.
     * 
     * @param {Object} run - The current run object from the OpenAI API.
     * @param {string} threadId - ID of the current conversation thread.
     * @returns {Object} - Updated run object after processing tool calls.
     * @throws {Error} - If there are errors executing the tool calls.
     */
    async _handleToolCalls(run, threadId) {
        while (run.status === "requires_action") {
            const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
            const toolOutputs = [];

            for (const toolCall of toolCalls) {
                if (toolCall.type === "function") {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);

                    if (functionName in this.availableFunctions) {
                        const functionResponse = await this.availableFunctions[functionName](...functionArgs);
                        toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: String(functionResponse)
                        });
                    }
                }
            }

            run = await this.client.beta.threads.runs.submit_tool_outputs({
                threadId,
                runId: run.id,
                toolOutputs
            });

            run = await this._waitForRun(run);
        }

        return run;
    }

    /**
     * Wait for a run to complete and handle any required actions.
     * 
     * @param {Object} run - The run object to monitor.
     * @returns {Object} - The completed run object.
     * @throws {Error} - If the run fails or expires.
     */
    async _waitForRun(run) {
        while (true) {
            run = await this.client.beta.threads.runs.retrieve({
                threadId: run.thread_id,
                runId: run.id
            });

            if (run.status === "completed") {
                break;
            } else if (run.status === "requires_action") {
                run = await this._handleToolCalls(run, run.thread_id);
                if (run.status === "completed") {
                    break;
                }
            } else if (["failed", "expired"].includes(run.status)) {
                throw new Error(`Run failed with status: ${run.status}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return run;
    }

    /**
     * Ensure a thread exists for the conversation.
     * 
     * Side Effects:
     * Sets this.thread if it doesn't exist.
     */
    async _ensureThread() {
        if (!this.thread) {
            this.thread = await this.client.beta.threads.create();
        }
    }

    /**
     * Add a message to the thread.
     * 
     * @param {string} content - The text content of the message to add.
     * @param {Array<string>} [fileIds=[]] - Optional list of file IDs to attach to the message.
     */
    async addMessage(content, fileIds = []) {
        await this._ensureThread();
        await this.client.beta.threads.messages.create({
            threadId: this.thread.id,
            role: "user",
            content,
            fileIds
        });
    }

    /**
     * Get the latest assistant response from the thread.
     * 
     * @returns {string} - The latest assistant response.
     */
    async _getResponse() {
        const messages = await this.client.beta.threads.messages.list({
            threadId: this.thread.id,
            order: "desc",
            limit: 1
        });

        if (!messages.data.length) {
            return "";
        }

        const message = messages.data[0];
        return message.role === "assistant" ? message.content[0].text.value : "";
    }

    /**
     * Run a task using the OpenAI Assistant.
     * 
     * @param {string} task - The task or prompt to send to the assistant.
     * @returns {string} - The assistant's response as a string.
     */
    async run(task, ...args) {
        await this._ensureThread();
        await this.addMessage(task);

        let run = await this.client.beta.threads.runs.create({
            threadId: this.thread.id,
            assistantId: this.assistant.id,
            instructions: this.instructions
        });

        run = await this._waitForRun(run);

        return run.status === "completed" ? await this._getResponse() : "";
    }

    /**
     * Alias for run() to maintain compatibility with different agent interfaces.
     * 
     * @param {string} task - The task or prompt to send to the assistant.
     * @returns {string} - The assistant's response as a string.
     */
    async call(task, ...args) {
        return this.run(task, ...args);
    }
}

export { OpenAIAssistant };