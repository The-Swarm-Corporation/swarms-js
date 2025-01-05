import { BaseModel } from 'pydantic';
import { parse as jsonParse, stringify as jsonStringify } from 'json5';

function baseModelToJson(model, indent = 3) {
    /**
     * Converts the JSON schema of a base model to a formatted JSON string.
     * 
     * @param {BaseModel} model - The base model for which to generate the JSON schema.
     * @param {number} [indent=3] - The number of spaces to use for indentation.
     * @returns {string} - The JSON schema of the base model as a formatted JSON string.
     */
    const out = model.model_json_schema();
    return strToJson(out, indent);
}

function extractJsonFromStr(response) {
    /**
     * Extracts a JSON object from a string.
     * 
     * @param {string} response - The string containing the JSON object.
     * @returns {Object} - The extracted JSON object.
     * @throws {Error} - If the string does not contain a valid JSON object.
     */
    const jsonStart = response.indexOf("{");
    const jsonEnd = response.lastIndexOf("}");
    return jsonParse(response.slice(jsonStart, jsonEnd + 1));
}

function strToJson(response, indent = 3) {
    /**
     * Converts a string representation of JSON to a JSON object.
     * 
     * @param {string} response - The string representation of JSON.
     * @param {number} [indent=3] - The number of spaces to use for indentation in the JSON output.
     * @returns {string} - The JSON object as a string.
     */
    return jsonStringify(response, null, indent);
}