import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import toml from '@iarna/toml';
import pkg from 'tiktoken';
const { TikTokenizer } = pkg;
import { logger } from '../utils/loguru_logger.mjs';
import { formatToPanel } from '../utils/formatter.mjs';
import { Conversation } from './conversation.mjs';
import { BaseTool } from '../tools/base_tool.mjs';
import { SafeStateManager, SafeLoaderUtils } from './safe_loading.mjs';
import { AGENT_SYSTEM_PROMPT_3 } from '../prompts/agent_system_prompts.mjs';
import { MULTI_MODAL_AUTO_AGENT_SYSTEM_PROMPT_1 } from '../prompts/multi_modal_autonomous_instruction_prompt.mjs';

// Utility Functions
const stopWhenRepeats = (response) => response.toLowerCase().includes('stop');
const parseDoneToken = (response) => response.includes('<DONE>');
const agentId = () => uuidv4();
const exists = (val) => val != null;

/**
 * Supported output types for the agent
 * @typedef {'string'|'str'|'list'|'json'|'dict'|'yaml'|'json_schema'} AgentOutputType
 */

/**
 * Tool usage type definition
 * @typedef {Object|Record<string, any>} ToolUsageType
 */

/**
 * Agent is the backbone to connect LLMs with tools and long term memory. Agent also provides the ability to
 * ingest any type of docs like PDFs, Txts, Markdown, Json, and etc for the agent. Here is a list of features.
 *
 * @param {any} llm - The language model to use
 * @param {string} template - The template to use
 * @param {number} max_loops - The maximum number of loops to run
 * @param {Function} stopping_condition - The stopping condition to use
 * @param {number} loop_interval - The loop interval
 * @param {number} retry_attempts - The number of retry attempts
 * @param {number} retry_interval - The retry interval
 * @param {boolean} return_history - Return the history 
 * @param {string} stopping_token - The stopping token
 * @param {boolean} dynamic_loops - Enable dynamic loops
 * @param {boolean} interactive - Enable interactive mode
 * @param {boolean} dashboard - Enable dashboard
 * @param {string} agent_name - The name of the agent
 * @param {string} agent_description - The description of the agent
 * @param {string} system_prompt - The system prompt
 * @param {Array<BaseTool>} tools - The tools to use
 * @param {boolean} dynamic_temperature_enabled - Enable dynamic temperature
 * // ... rest of the Python docstring params ...
 */
export class Agent {
    /**
     * Initialize the Agent with configuration
     * @param {Object} config - Configuration options
     */
    constructor({
        agent_id = agentId(),  // Use snake_case to match Python
        id = agentId(),
        llm = null,
        template = null,
        max_loops = 1,
        stopping_condition = null,
        loop_interval = 0,
        retry_attempts = 3,
        retry_interval = 1,
        return_history = false,
        stopping_token = null,
        dynamic_loops = false,
        interactive = false,
        dashboard = false,
        agent_name = "swarm-worker-01",
        agent_description = null,
        system_prompt = AGENT_SYSTEM_PROMPT_3,
        tools = null,
        dynamic_temperature_enabled = false,
        sop = null,
        sop_list = null,
        saved_state_path = null,
        autosave = false,
        context_length = 8192,
        user_name = "Human:",
        // ...additional parameters
    } = {}) {
        // Initialize core properties
        this.agent_id = agent_id;
        this.id = id;
        this.llm = llm;
        this.template = template;
        this.max_loops = max_loops;
        this.stopping_condition = stopping_condition;
        this.loop_interval = loop_interval;
        this.retry_attempts = retry_attempts;
        this.retry_interval = retry_interval;
        this.task = null;
        
        // Configuration properties
        this.stopping_token = stopping_token;
        this.interactive = interactive;
        this.dashboard = dashboard;
        this.return_history = return_history;
        this.dynamic_temperature_enabled = dynamic_temperature_enabled;
        this.dynamic_loops = dynamic_loops;
        this.user_name = user_name;
        this.context_length = context_length;
        this.sop = sop;
        this.sop_list = sop_list;
        this.tools = tools;
        this.system_prompt = system_prompt;
        this.agent_name = agent_name;
        this.agent_description = agent_description;
        this.saved_state_path = `${this.agent_name}_state.json`;
        this.autosave = autosave;

        // Initialize memory and components
        this.short_memory = new Conversation({
            system_prompt,
            time_enabled: true,
            user: user_name,
            rules: this.rules
        });

        this.feedback = [];
        this.executor = null; // Will be initialized when needed
        this.response_filters = [];

        // Handle tools initialization
        if (exists(tools)) {
            this.initialize_tools(tools);
        }

        // Initialize dynamic loops if enabled
        if (this.dynamic_loops) {
            logger.info("Dynamic loops enabled");
            this.max_loops = "auto";
        }

        // Initialize agent telemetry
        this.initialize_agent();
    }

    /**
     * Initialize the agent and validate parameters
     */
    initialize_agent() {
        try {
            logger.info(`Initializing Autonomous Agent ${this.agent_name}...`);
            this.check_parameters();
            logger.info(`${this.agent_name} Initialized Successfully.`);
            logger.info(`Autonomous Agent ${this.agent_name} Activated, all systems operational.`);

            if (this.dashboard) {
                this.print_dashboard();
            }
        } catch (error) {
            logger.error(`Error initializing agent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize tools for the agent
     * @param {Array} tools - Array of tool functions
     */
    initialize_tools(tools) {
        try {
            logger.info("Initializing tools - ensure functions have proper documentation and type hints");
            
            // Add tool system prompt to memory
            this.short_memory.add("system", this.tool_system_prompt);
            
            logger.info(`Tools provided: Accessing ${tools.length} tools`);
            
            // Initialize tool structure
            this.tool_struct = new BaseTool({
                tools,
                base_models: this.list_base_models,
                tool_system_prompt: this.tool_system_prompt
            });

            // Convert tools to OpenAI schema
            const tool_dict = this.tool_struct.convert_tool_into_openai_schema();
            this.short_memory.add("system", tool_dict);

            // Create function mapping
            this.function_map = Object.fromEntries(
                tools.map(tool => [tool.name, tool])
            );
        } catch (error) {
            logger.error(`Error initializing tools: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check required parameters
     * @throws {Error} If required parameters are missing
     */
    check_parameters() {
        if (!this.llm) {
            throw new Error("Language model is required. Choose a model or create a class with run(task) method.");
        }
        if (!this.max_loops) {
            throw new Error("Max loops is required");
        }
        if (!this.max_tokens) {
            throw new Error("Max tokens is required");
        }
        if (!this.context_length) {
            throw new Error("Context length is required");
        }
    }

    /**
     * Run the agent with a given task
     * @param {string} task - Task to be performed
     * @param {string} img - Optional image input
     * @param {boolean} is_last - Whether this is the last task
     * @param {boolean} print_task - Whether to print the task
     * @returns {Promise<any>} Task result
     */
    async _run(task, img = null, is_last = false, print_task = false) {
        try {
            await this.check_if_no_prompt_then_autogenerate(task);
            this.short_memory.add(this.user_name, task);

            if (this.plan_enabled) {
                await this.plan(task);
            }

            let loop_count = 0;
            const all_responses = [];

            // Query long-term memory if available
            if (this.long_term_memory) {
                await this.memory_query(task);
            }

            if (print_task) {
                logger.info(`Task Request for ${this.agent_name}: ${task}`);
            }

            while (this.max_loops === "auto" || loop_count < this.max_loops) {
                loop_count++;
                this.print_loop_count(loop_count);

                if (this.dynamic_temperature_enabled) {
                    this.adjust_dynamic_temperature();
                }

                const task_prompt = await this.short_memory.return_history_as_string();
                const response = await this.execute_with_retry(task_prompt, img);
                
                if (response) {
                    all_responses.push(response);
                }

                if (await this.should_stop_execution(response)) {
                    break;
                }

                if (this.interactive) {
                    const should_continue = await this.handle_interactive_mode();
                    if (!should_continue) break;
                }

                await this.handle_loop_delay();
            }

            return this.format_output(all_responses);
        } catch (error) {
            await this._handle_run_error(error);
        }
    }

    /**
     * Execute task with retry logic
     */
    async execute_with_retry(task_prompt, img) {
        let attempt = 0;
        while (attempt < this.retry_attempts) {
            try {
                if (this.long_term_memory && this.rag_every_loop) {
                    await this.memory_query(task_prompt);
                }

                const response = await this.call_llm(task_prompt, img);
                const parsed_response = this.llm_output_parser(response);

                await this.handle_response(parsed_response);
                return parsed_response;

            } catch (error) {
                attempt++;
                if (attempt === this.retry_attempts) throw error;
                await new Promise(resolve => setTimeout(resolve, this.retry_interval * 1000));
            }
        }
    }

    /**
     * Handle the response from the LLM
     */
    async handle_response(response) {
        if (this.streaming_on) {
            await this.stream_response(response);
        } else {
            logger.info(`${this.agent_name}: ${response}`);
        }

        if (this.tools) {
            await this.execute_tools(response);
        }

        this.short_memory.add(this.agent_name, response);

        if (this.evaluator) {
            const evaluation = await this.evaluator(response);
            this.short_memory.add("Evaluator", evaluation);
        }

        if (this.sentiment_analyzer) {
            await this.analyze_sentiment(response);
        }
    }

    /**
     * Format the output based on output type
     */
    format_output(responses) {
        const cleaned_responses = responses.filter(Boolean);
        
        switch (this.output_type) {
            case "string":
            case "str":
                return cleaned_responses.join('\n');
            case "list":
                return cleaned_responses;
            case "json":
                return JSON.stringify(this.agent_output, null, 2);
            case "dict":
                return this.agent_output;
            case "yaml":
                return yaml.dump(this.agent_output);
            default:
                throw new Error(`Invalid output type: ${this.output_type}`);
        }
    }

    /**
     * Check if execution should stop
     */
    async should_stop_execution(response) {
        return (
            (this.stopping_condition && await this.stopping_condition(response)) ||
            (this.stopping_func && await this.stopping_func(response))
        );
    }

    /**
     * Handle interactive mode
     */
    async handle_interactive_mode() {
        const user_input = await this.get_interactive_input();
        if (user_input.toLowerCase() === this.custom_exit_command.toLowerCase()) {
            return false;
        }
        this.short_memory.add(this.user_name, user_input);
        return true;
    }

    /**
     * Get interactive input from user
     */
    async get_interactive_input() {
        return new Promise(resolve => {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            readline.question('You: ', answer => {
                readline.close();
                resolve(answer);
            });
        });
    }

    /**
     * Print loop count
     */
    print_loop_count(count) {
        logger.info(`\nLoop ${count} of ${this.max_loops}`);
    }

    /**
     * Handle loop delay
     */
    async handle_loop_delay() {
        if (this.loop_interval) {
            await new Promise(resolve => setTimeout(resolve, this.loop_interval * 1000));
        }
    }

    /**
     * Adjust dynamic temperature
     */
    adjust_dynamic_temperature() {
        if (this.llm?.temperature !== undefined) {
            this.llm.temperature = Math.random();
        } else {
            this.llm.temperature = 0.5;
        }
    }

    /**
     * Memory query functionality
     */
    async memory_query(task) {
        try {
            if (!this.long_term_memory) return;
            
            logger.info(`Querying RAG for: ${task}`);
            const results = await this.long_term_memory.query(task);
            const formatted_results = `Documents Available: ${String(results)}`;
            
            await this.short_memory.add("Database", formatted_results);
        } catch (error) {
            logger.error(`Memory query error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save agent state
     */
    async save(file_path = null) {
        try {
            const resolved_path = file_path || 
                               this.saved_state_path || 
                               `${this.workspace_dir}/${this.agent_name}_state.json`;

            await SafeStateManager.save_state(this, resolved_path);
            
            if (this.long_term_memory) {
                const memory_path = resolved_path.replace('.json', '_memory.json');
                await this.long_term_memory.save(memory_path);
            }
            
            logger.info(`Successfully saved agent state to: ${resolved_path}`);
        } catch (error) {
            logger.error(`Save state error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load agent state
     */
    async load(file_path) {
        try {
            await SafeStateManager.load_state(this, file_path);
            await this._reinitialize_after_load();
            logger.info(`Successfully loaded agent state from: ${file_path}`);
        } catch (error) {
            logger.error(`Load state error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle artifacts creation and saving
     */
    async handle_artifacts(text, output_path, file_extension) {
        try {
            // Ensure extension starts with dot
            file_extension = file_extension.startsWith('.') ? file_extension : `.${file_extension}`;
            
            // Create default filename if needed
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = output_path.includes('.') ? 
                           output_path : 
                           `${output_path}/artifact_${timestamp}${file_extension}`;

            // Create directory if it doesn't exist
            await fs.promises.mkdir(path.dirname(filename), { recursive: true });

            // Save artifact
            const content = file_extension === '.yaml' ? 
                          yaml.dump(text) : 
                          JSON.stringify(text, null, 2);

            await fs.promises.writeFile(filename, content);
            logger.info(`Successfully saved artifact to ${filename}`);

        } catch (error) {
            logger.error(`Artifact handling error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse LLM output to appropriate format
     */
    llm_output_parser(response) {
        try {
            if (typeof response === 'object') {
                if (response.choices?.[0]?.message?.content) {
                    return response.choices[0].message.content;
                }
                return JSON.stringify(response);
            }
            return String(response);
        } catch (error) {
            logger.error(`LLM output parsing error: ${error.message}`);
            return String(response);
        }
    }

    /**
     * Stream response with token delay
     */
    async stream_response(response, delay = 0.001) {
        if (!response) throw new Error('Response is required');

        try {
            for (const token of response.split(' ')) {
                process.stdout.write(token + ' ');
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
            console.log();
        } catch (error) {
            logger.error(`Streaming error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check available tokens and context length
     */
    check_available_tokens() {
        if (!this.tokenizer) return 0;
        
        const tokens_used = this.tokenizer.count_tokens(
            this.short_memory.return_history_as_string()
        );
        
        const available = this.context_length - tokens_used;
        logger.info(`Tokens available: ${available}`);
        return available;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            if (this.autosave) {
                logger.info('Performing final save before cleanup');
                await this.save();
            }
            
            if (this.executor) {
                await this.executor.shutdown();
            }

            logger.info('Cleanup completed successfully');
        } catch (error) {
            logger.error(`Cleanup error: ${error.message}`);
        }
    }

    /**
     * Convert agent state to dictionary
     */
    to_dict() {
        const state = {};
        for (const [key, value] of Object.entries(this)) {
            state[key] = this._serialize_value(value);
        }
        return state;
    }

    /**
     * Serialize value for storage
     */
    _serialize_value(value) {
        if (typeof value === 'function') {
            return {
                type: 'function',
                name: value.name,
                description: value.description || null
            };
        }
        if (value && typeof value === 'object') {
            if (value.to_dict) return value.to_dict();
            if (Array.isArray(value)) return value.map(v => this._serialize_value(v));
            return Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, this._serialize_value(v)])
            );
        }
        return value;
    }

    /**
     * Execute tools with response
     */
    async execute_tools(response) {
        try {
            logger.info("Executing tools...");
            const output = await this.tool_struct.parse_and_execute_json(
                this.tools,
                response,
                { parse_md: true }
            );

            const string_output = String(output);
            logger.info(`Tool Output: ${string_output}`);
            this.short_memory.add("Tool Executor", string_output);
            return string_output;
        } catch (error) {
            logger.error(`Tool execution error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Analyze sentiment of response
     */
    async analyze_sentiment(response) {
        try {
            const sentiment = await this.sentiment_analyzer(response);
            logger.info(`Sentiment: ${sentiment}`);

            if (this.sentiment_threshold) {
                if (sentiment > this.sentiment_threshold) {
                    logger.info(`Sentiment ${sentiment} above threshold ${this.sentiment_threshold}`);
                } else {
                    logger.info(`Sentiment ${sentiment} below threshold ${this.sentiment_threshold}`);
                }
            }

            this.short_memory.add(this.agent_name, String(sentiment));
        } catch (error) {
            logger.error(`Sentiment analysis error: ${error.message}`);
        }
    }

    /**
     * Check if auto_generate_prompt is enabled and generates a prompt by combining agent name,
     * description and system prompt if available. Falls back to task if all other fields are missing.
     * 
     * Args:
     *     task (str, optional): The task to use as a fallback if name, description and system prompt are missing.
     */
    async check_if_no_prompt_then_autogenerate(task) {
        if (!this.auto_generate_prompt) return;

        const components = [
            this.agent_name,
            this.agent_description,
            this.system_prompt
        ].filter(Boolean);

        if (!components.length && task) {
            logger.warning("No agent details found. Using task as fallback for prompt generation.");
            this.system_prompt = await this.llm.run(`Generate a system prompt for: ${task}`);
        } else {
            const combined = components.join(" ");
            logger.info(`Auto-generating prompt from: ${components.join(', ')}`);
            this.system_prompt = await this.llm.run(`Generate a system prompt based on: ${combined}`);
        }

        this.short_memory.add("system", this.system_prompt);
        logger.info("Auto-generated prompt successfully.");
    }

    /**
     * Handle SOP operations
     */
    async handle_sop_ops() {
        if (this.sop_list?.length) {
            this.sop = this.sop_list.join('\n');
            await this.short_memory.add(this.user_name, this.sop);
        }

        if (this.sop) {
            await this.short_memory.add(this.user_name, this.sop);
        }

        logger.info("SOP uploaded into memory");
    }

    /**
     * Call LLM with proper error handling
     */
    async call_llm(task, ...args) {
        if (typeof task !== 'string') {
            throw new TypeError("Task must be a string");
        }

        if (!task.trim()) {
            throw new Error("Task cannot be empty");
        }

        if (!this.llm) {
            throw new TypeError("LLM object cannot be None");
        }

        try {
            const output = await this.llm.run(task, ...args);
            return output;
        } catch (error) {
            logger.error(`Error calling LLM: ${error.message}`);
            throw error;
        }
    }

    /**
     * Showcase agent configuration
     */
    showcase_config() {
        const config_dict = this.to_dict();
        
        // Format config values for display
        Object.entries(config_dict).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                config_dict[key] = value.map(String).join(", ");
            } else if (value && typeof value === 'object') {
                config_dict[key] = Object.entries(value)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
            } else {
                config_dict[key] = String(value);
            }
        });

        return formatToPanel(
            `Agent: ${this.agent_name} Configuration`,
            config_dict
        );
    }

    /**
     * Log agent data to external service
     */
    async log_agent_data() {
        try {
            const response = await fetch("https://swarms.world/api/get-agents/log-agents", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-f24a13ed139f757d99cdd9cdcae710fccead92681606a97086d9711f69d44869'
                },
                body: JSON.stringify({
                    data: this.to_dict()
                })
            });

            return await response.json();
        } catch (error) {
            logger.error(`Error logging agent data: ${error.message}`);
        }
    }

    /**
     * Run agent with error handling
     */
    async run(task, img = null, device = "cpu", device_id = 0, all_cores = true, scheduled_run_date = null) {
        const use_cluster_ops = !this.do_not_use_cluster_ops;
        device = device || this.device;
        device_id = device_id || this.device_id;
        all_cores = all_cores || this.all_cores;

        if (scheduled_run_date) {
            while (new Date() < scheduled_run_date) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        try {
            if (!use_cluster_ops) {
                return await this._run(task, img);
            }

            return await exec_callable_with_clusterops({
                device,
                device_id,
                all_cores,
                all_gpus: this.all_gpus,
                func: this._run.bind(this),
                task,
                img
            });

        } catch (error) {
            await this._handle_run_error(error);
        }
    }

    /**
     * Run agent async with proper error handling
     */
    async arun(task, img = null, is_last = false, device = "cpu", device_id = 1, all_cores = true) {
        try {
            return await this.run(task, img, is_last, device, device_id, all_cores);
        } catch (error) {
            await this._handle_run_error(error);
        }
    }

    /**
     * Handle document ingestion
     */
    async ingest_docs(docs) {
        try {
            for (const doc of docs) {
                const data = await data_to_text(doc);
                await this.short_memory.add(this.user_name, data);
            }
        } catch (error) {
            logger.error(`Error ingesting docs: ${error.message}`);
        }
    }

    /**
     * Process documents from folder
     */
    async get_docs_from_doc_folders() {
        try {
            logger.info("Getting docs from doc folders");
            const files = await fs.promises.readdir(this.docs_folder);
            
            let all_text = "";
            for (const file of files) {
                const file_path = path.join(this.docs_folder, file);
                const text = await data_to_text(file_path);
                all_text += "\nContent from ${file}:\n${text}\n";
            }

            await this.short_memory.add(this.user_name, all_text);
        } catch (error) {
            logger.error(`Error processing doc folders: ${error.message}`);
            throw error;
        }
    }

    /**
     * Token management utilities
     */
    check_tokens() {
        const tokens_used = this.tokenizer.count_tokens(
            this.short_memory.return_history_as_string()
        );
        const available = this.check_available_tokens();

        logger.info(
            `Tokens available: ${available} ` +
            `Context Length: ${this.context_length} ` +
            `Tokens in memory: ${tokens_used}`
        );

        return available;
    }

    /**
     * Model state management
     */
    async model_dump_json() {
        logger.info(`Saving ${this.agent_name} model to JSON in ${this.workspace_dir}`);
        
        await create_file_in_folder(
            this.workspace_dir,
            `${this.agent_name}.json`,
            this.to_json()
        );

        return `Model saved to ${this.workspace_dir}/${this.agent_name}.json`;
    }

    async model_dump_yaml() {
        logger.info(`Saving ${this.agent_name} model to YAML in ${this.workspace_dir}`);
        
        await create_file_in_folder(
            this.workspace_dir,
            `${this.agent_name}.yaml`,
            this.to_yaml()
        );

        return `Model saved to ${this.workspace_dir}/${this.agent_name}.yaml`;
    }

    /**
     * Format conversions
     */
    to_json(indent = 4) {
        return JSON.stringify(this.to_dict(), null, indent);
    }

    to_yaml(indent = 4) {
        return yaml.dump(this.to_dict(), { indent });
    }

    to_toml() {
        return toml.stringify(this.to_dict());
    }

    /**
     * Add a task to the memory
     */
    async add_task_to_memory(task) {
        return await this.short_memory.add(this.user_name, task);
    }

    /**
     * Print formatted history and memory
     */
    print_history_and_memory() {
        const history = this.short_memory.get_str();
        return formatToPanel(history, `${this.agent_name} History`);
    }

    /**
     * Truncate history to fit context
     */
    truncate_history(max_tokens) {
        // Implementation needed
    }

    /**
     * Setup dynamic prompt
     */
    _dynamic_prompt_setup() {
        // Implementation needed
    }

    /**
     * Run agent asynchronously and concurrently
     */
    async run_async_concurrent(tasks) {
        // Implementation needed
    }

    /**
     * Construct dynamic prompt
     */
    construct_dynamic_prompt() {
        // Implementation needed
    }
}

// Example usage (commented out):
/*
import { config } from 'dotenv';
import { OpenAIChat } from '../models/openai.mjs';

const runExample = async () => {
    config();
    
    const agent = new Agent({
        llm: new OpenAIChat({
            openaiApiBase: "https://api.groq.com/openai/v1",
            openaiApiKey: process.env.GROQ_API_KEY,
            modelName: "llama-3.1-70b-versatile",
            temperature: 0.1
        }),
        agentName: "TestAgent",
        autoGeneratePrompt: true,
        dynamicTemperatureEnabled: true,
        maxLoops: 3
    });

    const response = await agent.run("Analyze the current market trends");
    console.log(response);

    // Showcase configuration
    agent.showcaseConfig();

    // Cleanup
    await agent.cleanup();
};

if (import.meta.url === new URL(import.meta.url).href) {
    runExample().catch(console.error);
}
*/