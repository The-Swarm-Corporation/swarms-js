import { retry } from 'async-retry';
import { initialize_logger } from '../utils/loguru_logger.mjs';
import { promptGeneratorSysPrompt as secondSysPrompt } from '../prompts/prompt_generator.mjs';
import { promptGeneratorSysPrompt } from '../prompts/prompt_generator_optimizer.mjs';

const logger = initialize_logger({ log_folder: "ape_agent" });

/**
 * Generates a prompt for a given task using the provided model.
 * 
 * @param {string} [task=null] - The task for which to generate a prompt.
 * @param {Object} [model=null] - The model to be used for prompt generation.
 * @param {number} [maxTokens=4000] - The maximum number of tokens in the generated prompt.
 * @param {boolean} [useSecondSysPrompt=true] - Whether to use the second system prompt.
 * @param {...any} args - Additional arguments.
 * @returns {Promise<string>} - The generated prompt.
 */
async function autoGeneratePrompt(task = null, model = null, maxTokens = 4000, useSecondSysPrompt = true, ...args) {
    return retry(async () => {
        try {
            const systemPrompt = useSecondSysPrompt ? secondSysPrompt.getPrompt() : promptGeneratorSysPrompt.getPrompt();
            const output = await model.run(systemPrompt + task, { maxTokens });
            console.log(output);
            return output;
        } catch (e) {
            logger.error(`Error generating prompt: ${e.message}`);
            throw e;
        }
    }, {
        retries: 3,
        minTimeout: 4000,
        maxTimeout: 10000
    });
}

export { autoGeneratePrompt };