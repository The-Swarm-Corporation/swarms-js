import { execSync } from 'child_process';
import { createLogger, transports, format } from 'winston';
import { BaseModel } from 'pydantic';

const logger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'pandas_utils.log' })
    ]
});

let pandas;
try {
    pandas = require('pandas');
} catch (e) {
    logger.error("Failed to import pandas");
    execSync('npm install pandas', { stdio: 'inherit' });
    pandas = require('pandas');
}

/**
 * Displays information about all agents in a list using a DataFrame.
 * 
 * @param {Array<Agent>} agents - List of Agent instances.
 */
function displayAgentsInfo(agents) {
    const agentData = agents.map(agent => {
        try {
            return {
                ID: agent.id,
                Name: agent.agent_name,
                Description: agent.description,
                max_loops: agent.max_loops,
                SystemPrompt: agent.system_prompt,
                LLMModel: agent.llm.model_name
            };
        } catch (e) {
            logger.error(`Failed to extract information from agent ${agent}: ${e.message}`);
            return null;
        }
    }).filter(agent => agent !== null);

    try {
        const df = pandas.DataFrame(agentData);
        console.log(df.toString());
    } catch (e) {
        logger.error(`Failed to create or print DataFrame: ${e.message}`);
    }
}

/**
 * Converts a dictionary into a pandas DataFrame.
 * 
 * @param {Object} data - Dictionary to convert.
 * @returns {DataFrame} - A pandas DataFrame representation of the dictionary.
 */
function dictToDataFrame(data) {
    try {
        return pandas.json_normalize(data);
    } catch (e) {
        logger.error(`Failed to convert dictionary to DataFrame: ${e.message}`);
        return null;
    }
}

/**
 * Converts a Pydantic Base Model into a pandas DataFrame.
 * 
 * @param {BaseModel} model - Pydantic Base Model to convert.
 * @returns {DataFrame} - A pandas DataFrame representation of the Pydantic model.
 */
function pydanticModelToDataFrame(model) {
    const modelDict = model.dict();
    return dictToDataFrame(modelDict);
}

export { displayAgentsInfo, dictToDataFrame, pydanticModelToDataFrame };