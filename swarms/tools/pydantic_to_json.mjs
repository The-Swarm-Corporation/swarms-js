import { BaseModel } from 'pydantic';
import { parse as parseDocstring } from 'docstring-parser';
import { initialize_logger } from '../utils/loguru_logger.mjs';

const logger = initialize_logger("pydantic_to_json");

function removeAKey(obj, removeKey) {
    /**
     * Remove a key from a dictionary recursively
     * 
     * @param {Object} obj - The object from which to remove the key.
     * @param {string} removeKey - The key to remove.
     */
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (key === removeKey && 'type' in obj) {
                delete obj[key];
            } else {
                removeAKey(obj[key], removeKey);
            }
        }
    }
}

function checkPydanticName(pydanticType) {
    /**
     * Check the name of the Pydantic model.
     * 
     * @param {BaseModel} pydanticType - The Pydantic model type to check.
     * @returns {string} - The name of the Pydantic model.
     */
    try {
        return pydanticType.constructor.name;
    } catch (error) {
        logger.error(`The Pydantic model does not have a name. ${error}`);
        throw error;
    }
}

function baseModelToOpenAIFunction(pydanticType, outputStr = false) {
    /**
     * Convert a Pydantic model to a dictionary representation of functions.
     * 
     * @param {BaseModel} pydanticType - The Pydantic model type to convert.
     * @param {boolean} [outputStr=false] - Whether to output as a string.
     * @returns {Object} - A dictionary representation of the functions.
     */
    const schema = pydanticType.model_json_schema();

    // Fetch the name of the class
    const name = pydanticType.constructor.name;

    const docstring = parseDocstring(pydanticType.__doc__ || "");
    const parameters = Object.fromEntries(
        Object.entries(schema).filter(([k]) => !['title', 'description'].includes(k))
    );

    for (const param of docstring.params) {
        if (parameters.properties[param.arg_name] && param.description) {
            if (!parameters.properties[param.arg_name].description) {
                parameters.properties[param.arg_name].description = param.description;
            }
        }
    }

    parameters.type = "object";

    if (!schema.description) {
        schema.description = docstring.short_description || `Correctly extracted \`${name}\` with all the required parameters with correct types`;
    }

    removeAKey(parameters, "title");
    removeAKey(parameters, "additionalProperties");

    const result = {
        function_call: { name },
        functions: [{
            name,
            description: schema.description,
            parameters
        }]
    };

    return outputStr ? JSON.stringify(result) : result;
}

function multiBaseModelToOpenAIFunction(pydanticTypes = [], outputStr = false) {
    /**
     * Converts multiple Pydantic types to a dictionary of functions.
     * 
     * @param {Array<BaseModel>} pydanticTypes - A list of Pydantic types to convert.
     * @param {boolean} [outputStr=false] - Whether to output as a string.
     * @returns {Object} - A dictionary containing the converted functions.
     */
    const functions = pydanticTypes.map(pydanticType => baseModelToOpenAIFunction(pydanticType, outputStr).functions[0]);

    return {
        function_call: "auto",
        functions
    };
}