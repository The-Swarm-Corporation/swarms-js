import { BaseModel, Field } from 'pydantic';
import { validate } from 'some-validation-library'; // Replace with an appropriate library if needed

class AgentSchema extends BaseModel {
    llm = Field(null, { description: "The language model to use" });
    max_tokens = Field(null, { description: "The maximum number of tokens", ge: 1 });
    context_window = Field(null, { description: "The context window size", ge: 1 });
    user_name = Field(null, { description: "The user name" });
    agent_name = Field(null, { description: "The name of the agent" });
    system_prompt = Field(null, { description: "The system prompt" });
    template = Field(null, { default: null });
    max_loops = Field(null, { default: 1, ge: 1 });
    stopping_condition = Field(null, { default: null });
    loop_interval = Field(null, { default: 0, ge: 0 });
    retry_attempts = Field(null, { default: 3, ge: 0 });
    retry_interval = Field(null, { default: 1, ge: 0 });
    return_history = Field(null, { default: false });
    stopping_token = Field(null, { default: null });
    dynamic_loops = Field(null, { default: false });
    interactive = Field(null, { default: false });
    dashboard = Field(null, { default: false });
    agent_description = Field(null, { default: null });
    tools = Field(null, { default: null });
    dynamic_temperature_enabled = Field(null, { default: false });
    sop = Field(null, { default: null });
    sop_list = Field(null, { default: null });
    saved_state_path = Field(null, { default: null });
    autosave = Field(null, { default: false });
    self_healing_enabled = Field(null, { default: false });
    code_interpreter = Field(null, { default: false });
    multi_modal = Field(null, { default: false });
    pdf_path = Field(null, { default: null });
    list_of_pdf = Field(null, { default: null });
    tokenizer = Field(null, { default: null });
    long_term_memory = Field(null, { default: null });
    preset_stopping_token = Field(null, { default: false });
    traceback = Field(null, { default: null });
    traceback_handlers = Field(null, { default: null });
    streaming_on = Field(null, { default: false });
    docs = Field(null, { default: null });
    docs_folder = Field(null, { default: null });
    verbose = Field(null, { default: false });
    parser = Field(null, { default: null });
    best_of_n = Field(null, { default: null });
    callback = Field(null, { default: null });
    metadata = Field(null, { default: null });
    callbacks = Field(null, { default: null });
    logger_handler = Field(null, { default: null });
    search_algorithm = Field(null, { default: null });
    logs_to_filename = Field(null, { default: null });
    evaluator = Field(null, { default: null });
    output_json = Field(null, { default: false });
    stopping_func = Field(null, { default: null });
    custom_loop_condition = Field(null, { default: null });
    sentiment_threshold = Field(null, { default: null });
    custom_exit_command = Field(null, { default: "exit" });
    sentiment_analyzer = Field(null, { default: null });
    limit_tokens_from_string = Field(null, { default: null });
    custom_tools_prompt = Field(null, { default: null });
    tool_schema = Field(null, { default: null });
    output_type = Field(null, { default: null });
    function_calling_type = Field(null, { default: "json" });
    output_cleaner = Field(null, { default: null });
    function_calling_format_type = Field(null, { default: "OpenAI" });
    list_base_models = Field(null, { default: null });
    metadata_output_type = Field(null, { default: "json" });
    state_save_file_type = Field(null, { default: "json" });
    chain_of_thoughts = Field(null, { default: false });
    algorithm_of_thoughts = Field(null, { default: false });
    tree_of_thoughts = Field(null, { default: false });
    tool_choice = Field(null, { default: "auto" });
    execute_tool = Field(null, { default: false });
    rules = Field(null, { default: null });
    planning = Field(null, { default: false });
    planning_prompt = Field(null, { default: null });
    device = Field(null, { default: null });
    custom_planning_prompt = Field(null, { default: null });
    memory_chunk_size = Field(null, { default: 2000, ge: 0 });
    agent_ops_on = Field(null, { default: false });
    log_directory = Field(null, { default: null });
    project_path = Field(null, { default: null });
    tool_system_prompt = Field(null, { default: "tool_sop_prompt()" });
    top_p = Field(null, { default: 0.9, ge: 0, le: 1 });
    top_k = Field(null, { default: null });
    frequency_penalty = Field(null, { default: 0.0, ge: 0, le: 1 });
    presence_penalty = Field(null, { default: 0.0, ge: 0, le: 1 });
    temperature = Field(null, { default: 0.1, ge: 0, le: 1 });

    static checkListItemsNotNone(v) {
        if (v === null) {
            throw new Error("List items must not be None");
        }
        return v;
    }

    static checkOptionalCallableNotNone(v) {
        if (v !== null && typeof v !== 'function') {
            throw new Error(`${v} must be a callable`);
        }
        return v;
    }
}

// Example of how to use the schema
// const agentData = {
//     llm: "OpenAIChat",
//     max_tokens: 4096,
//     context_window: 8192,
//     user_name: "Human",
//     agent_name: "test-agent",
//     system_prompt: "Custom system prompt",
// };

// const agent = new AgentSchema(agentData);
// console.log(agent);

export { AgentSchema };