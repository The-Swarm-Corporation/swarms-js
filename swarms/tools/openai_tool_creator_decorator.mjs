import { get_openai_function_schema_from_func } from './py_func_to_openai_func_str.mjs';
import { logger } from '../utils/loguru_logger.mjs';

/**
 * A decorator function that generates an OpenAI function schema.
 * 
 * @param {Object} options - The options for the decorator.
 * @param {string} [options.name=null] - The name of the OpenAI function.
 * @param {string} [options.description=null] - The description of the OpenAI function.
 * @param {boolean} [options.return_dict=true] - Whether to return the schema as a dictionary.
 * @param {boolean} [options.verbose=true] - Whether to enable verbose logging.
 * @param {boolean} [options.return_string=false] - Whether to return the schema as a string.
 * @param {boolean} [options.return_yaml=false] - Whether to return the schema as YAML.
 * @returns {Function} - The decorator function.
 */
function tool({
    name = null,
    description = null,
    return_dict = true,
    verbose = true,
    return_string = false,
    return_yaml = false
} = {}) {
    return function decorator(func) {
        return function wrapper(...args) {
            try {
                // Log the function call
                logger.info(`Creating Tool: ${func.name}`);

                // Assert that the arguments are of the correct type
                if (name !== null && typeof name !== 'string') throw new Error("name must be a string");
                if (description !== null && typeof description !== 'string') throw new Error("description must be a string");
                if (typeof return_dict !== 'boolean') throw new Error("return_dict must be a boolean");
                if (typeof verbose !== 'boolean') throw new Error("verbose must be a boolean");

                // Call the function
                func(...args);

                // Get the openai function schema
                const tool_name = name || func.name;
                const schema = get_openai_function_schema_from_func(func, { name: tool_name, description });

                // Return the schema
                if (return_dict) {
                    return schema;
                } else if (return_string) {
                    return JSON.stringify(schema);
                } else if (return_yaml) {
                    // schema = YamlModel().dict_to_yaml(schema);
                    return schema;
                } else {
                    return schema;
                }
            } catch (e) {
                // Log the error
                logger.error(`Error: ${e.message}`);
                throw e;
            }
        };
    };
}