import { BaseModel, Field } from 'pydantic';
import { openai_tool_executor } from './func_calling_executor.mjs';
import { function_to_str, functions_to_str } from './func_to_str.mjs';
import { process_tool_docs } from './function_util.mjs';
import { 
    get_openai_function_schema_from_func, 
    load_basemodels_if_needed 
} from './py_func_to_openai_func_str.mjs';
import { 
    base_model_to_openai_function, 
    multi_base_model_to_openai_function 
} from './pydantic_to_json.mjs';
import { initialize_logger } from '../utils/loguru_logger.mjs';
import { parse as jsonParse } from 'json5';

const logger = initialize_logger({ log_folder: "base_tool" });

class BaseTool extends BaseModel {
    constructor() {
        super();
        this.verbose = null;
        this.base_models = null;
        this.autocheck = null;
        this.auto_execute_tool = null;
        this.tools = null;
        this.tool_system_prompt = Field(
            null,
            { description: "The system prompt for the tool system." }
        );
        this.function_map = null;
        this.list_of_dicts = null;
    }

    func_to_dict(func = null, name = null, description = null, ...args) {
        try {
            return get_openai_function_schema_from_func(
                func,
                name,
                description,
                ...args
            );
        } catch (e) {
            logger.error(`An error occurred in func_to_dict: ${e}`);
            logger.error("Please check the function and ensure it is valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    load_params_from_func_for_pybasemodel(func, ...args) {
        try {
            return load_basemodels_if_needed(func, ...args);
        } catch (e) {
            logger.error(`An error occurred in load_params_from_func_for_pybasemodel: ${e}`);
            logger.error("Please check the function and ensure it is valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    base_model_to_dict(pydantic_type, output_str = false, ...args) {
        try {
            return base_model_to_openai_function(pydantic_type, output_str, ...args);
        } catch (e) {
            logger.error(`An error occurred in base_model_to_dict: ${e}`);
            logger.error("Please check the Pydantic type and ensure it is valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    multi_base_models_to_dict(return_str = false, ...args) {
        try {
            return multi_base_model_to_openai_function(this.base_models, ...args);
        } catch (e) {
            logger.error(`An error occurred in multi_base_models_to_dict: ${e}`);
            logger.error("Please check the Pydantic types and ensure they are valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    dict_to_openai_schema_str(dict) {
        try {
            return function_to_str(dict);
        } catch (e) {
            logger.error(`An error occurred in dict_to_openai_schema_str: ${e}`);
            logger.error("Please check the dictionary and ensure it is valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    multi_dict_to_openai_schema_str(dicts) {
        try {
            return functions_to_str(dicts);
        } catch (e) {
            logger.error(`An error occurred in multi_dict_to_openai_schema_str: ${e}`);
            logger.error("Please check the dictionaries and ensure they are valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    get_docs_from_callable(item) {
        try {
            return process_tool_docs(item);
        } catch (e) {
            logger.error(`An error occurred in get_docs: ${e}`);
            logger.error("Please check the item and ensure it is valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    execute_tool(...args) {
        try {
            return openai_tool_executor(
                this.list_of_dicts,
                this.function_map,
                this.verbose,
                ...args
            );
        } catch (e) {
            logger.error(`An error occurred in execute_tool: ${e}`);
            logger.error("Please check the tools and function map and ensure they are valid.");
            logger.error("If the issue persists, please seek further assistance.");
            throw e;
        }
    }

    detect_tool_input_type(input) {
        if (input instanceof BaseModel) {
            return "Pydantic";
        } else if (typeof input === 'object') {
            return "Dictionary";
        } else if (typeof input === 'function') {
            return "Function";
        } else {
            return "Unknown";
        }
    }

    dynamic_run(input) {
        const tool_input_type = this.detect_tool_input_type(input);
        let function_str;
        if (tool_input_type === "Pydantic") {
            function_str = base_model_to_openai_function(input);
        } else if (tool_input_type === "Dictionary") {
            function_str = function_to_str(input);
        } else if (tool_input_type === "Function") {
            function_str = get_openai_function_schema_from_func(input);
        } else {
            return "Unknown tool input type";
        }

        if (this.auto_execute_tool) {
            if (tool_input_type === "Function") {
                this.tools.push(input);
            }

            const function_map = Object.fromEntries(
                this.tools.map(func => [func.name, func])
            );

            return this.execute_tool(
                { tools: [function_str], function_map }
            );
        } else {
            return function_str;
        }
    }

    execute_tool_by_name(tool_name) {
        const tool = this.tools.find(tool => tool.name === tool_name);

        if (!tool) {
            throw new Error(`Tool '${tool_name}' not found`);
        }

        const func = this.function_map[tool_name];

        if (!func) {
            throw new TypeError(`Tool '${tool_name}' is not mapped to a function`);
        }

        return func(...tool.parameters);
    }

    execute_tool_from_text(text) {
        const tool = jsonParse(text);

        const tool_name = tool.name;
        const tool_params = tool.parameters || {};

        const func = this.function_map[tool_name];

        if (!func) {
            throw new TypeError(`Tool '${tool_name}' is not mapped to a function`);
        }

        return func(...tool_params);
    }

    check_str_for_functions_valid(output) {
        try {
            const data = jsonParse(output);

            if (data.type === "function" && data.function && data.function.name) {
                const function_name = data.function.name;
                if (function_name in this.function_map) {
                    return true;
                }
            }
        } catch (e) {
            logger.error("Error decoding JSON with output");
        }

        return false;
    }

    convert_funcs_into_tools() {
        if (this.tools) {
            logger.info("Tools provided make sure the functions have documentation ++ type hints, otherwise tool execution won't be reliable.");

            logger.info(`Tools provided: Accessing ${this.tools.length} tools`);

            this.convert_tool_into_openai_schema();

            this.function_map = Object.fromEntries(
                this.tools.map(tool => [tool.name, tool])
            );
        }

        return null;
    }

    convert_tool_into_openai_schema() {
        logger.info("Converting tools into OpenAI function calling schema");

        const tool_schemas = [];

        for (const tool of this.tools) {
            if (this.check_func_if_have_docs(tool) && this.check_func_if_have_type_hints(tool)) {
                const name = tool.name;
                const description = tool.description;

                logger.info(`Converting tool: ${name} into a OpenAI certified function calling schema. Add documentation and type hints.`);
                const tool_schema = get_openai_function_schema_from_func(
                    tool, { name, description }
                );

                logger.info(`Tool ${name} converted successfully into OpenAI schema`);

                tool_schemas.push(tool_schema);
            } else {
                logger.error(`Tool ${tool.name} does not have documentation or type hints, please add them to make the tool execution reliable.`);
            }
        }

        if (tool_schemas.length) {
            const combined_schema = {
                type: "function",
                functions: tool_schemas.map(schema => schema.function)
            };
            return JSON.stringify(combined_schema, null, 4);
        }

        return null;
    }

    check_func_if_have_docs(func) {
        if (func.description) {
            return true;
        } else {
            logger.error(`Function ${func.name} does not have documentation`);
            throw new Error(`Function ${func.name} does not have documentation`);
        }
    }

    check_func_if_have_type_hints(func) {
        if (func.annotations) {
            return true;
        } else {
            logger.info(`Function ${func.name} does not have type hints`);
            throw new Error(`Function ${func.name} does not have type hints`);
        }
    }
}

// Example function definitions and mappings
// function get_current_weather(location, unit = 'celsius') {
//     return `Weather in ${location} is likely sunny and 75° ${unit.charAt(0).toUpperCase() + unit.slice(1)}`;
// }

// function add(a, b) {
//     return a + b;
// }

// Example tool configurations
// const tools = [
//     {
//         type: "function",
//         function: {
//             name: "get_current_weather",
//             parameters: {
//                 properties: {
//                     location: "San Francisco, CA",
//                     unit: "fahrenheit",
//                 },
//             },
//         },
//     },
//     {
//         type: "function",
//         function: {
//             name: "add",
//             parameters: {
//                 properties: {
//                     a: 1,
//                     b: 2,
//                 },
//             },
//         },
//     }
// ];

// const function_map = {
//     get_current_weather,
//     add,
// };

// Creating and executing the advanced executor
// const tool_executor = new BaseTool({ verbose: true }).execute_tool(tools, function_map);

// try {
//     const results = tool_executor();
//     console.log(results);  // Outputs results from both functions
// } catch (e) {
//     console.error(`Error: ${e}`);
// }