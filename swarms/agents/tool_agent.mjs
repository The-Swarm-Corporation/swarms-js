import { initialize_logger } from '../utils/loguru_logger.mjs';
import { lazyImportDecorator } from '../utils/lazy_loader.mjs';
import { Jsonformer } from '../tools/json_former.mjs';

const logger = initialize_logger({ log_folder: "tool_agent" });

@lazyImportDecorator
class ToolAgent {
    /**
     * Represents a tool agent that performs a specific task using a model and tokenizer.
     * 
     * @param {Object} options - The options for the tool agent.
     * @param {string} options.name - The name of the tool agent.
     * @param {string} options.description - A description of the tool agent.
     * @param {Object} options.model - The model used by the tool agent.
     * @param {Object} options.tokenizer - The tokenizer used by the tool agent.
     * @param {Object} options.jsonSchema - The JSON schema used by the tool agent.
     * @param {number} [options.maxNumberTokens=500] - The maximum number of tokens.
     * @param {Function} [options.parsingFunction=null] - The function to parse the output.
     * @param {Object} [options.llm=null] - The language model.
     * @param {...any} args - Additional arguments.
     * @param {...any} kwargs - Additional keyword arguments.
     */
    constructor({
        name = "Function Calling Agent",
        description = "Generates a function based on the input json schema and the task",
        model = null,
        tokenizer = null,
        jsonSchema = null,
        maxNumberTokens = 500,
        parsingFunction = null,
        llm = null,
        ...args
    } = {}) {
        this.name = name;
        this.description = description;
        this.model = model;
        this.tokenizer = tokenizer;
        this.jsonSchema = jsonSchema;
        this.maxNumberTokens = maxNumberTokens;
        this.parsingFunction = parsingFunction;
        this.llm = llm;
        this.args = args;
    }

    /**
     * Run the tool agent for the specified task.
     * 
     * @param {string} task - The task to be performed by the tool agent.
     * @param {...any} args - Additional arguments.
     * @param {...any} kwargs - Additional keyword arguments.
     * @returns {any} - The output of the tool agent.
     * @throws {Error} - If an error occurs during the execution of the tool agent.
     */
    async run(task, ...args) {
        try {
            logger.info(`Running ${this.name} for task: ${task}`);
            const toolAgent = new Jsonformer({
                model: this.model,
                tokenizer: this.tokenizer,
                jsonSchema: this.jsonSchema,
                llm: this.llm,
                prompt: task,
                maxNumberTokens: this.maxNumberTokens,
                ...this.args,
                ...args
            });

            const output = this.parsingFunction ? this.parsingFunction(await toolAgent.call()) : await toolAgent.call();
            return output;
        } catch (error) {
            logger.error(`Error running ${this.name} for task: ${task}`);
            throw error;
        }
    }

    /**
     * Alias for run() to maintain compatibility with different agent interfaces.
     * 
     * @param {string} task - The task to be performed by the tool agent.
     * @param {...any} args - Additional arguments.
     * @param {...any} kwargs - Additional keyword arguments.
     * @returns {any} - The output of the tool agent.
     */
    async call(task, ...args) {
        return this.run(task, ...args);
    }
}

export { ToolAgent };