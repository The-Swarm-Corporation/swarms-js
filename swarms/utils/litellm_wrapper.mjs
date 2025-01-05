import { execSync } from 'child_process';

let completion;
try {
    completion = require('litellm').completion;
} catch (e) {
    execSync('npm install litellm', { stdio: 'inherit' });
    completion = require('litellm').completion;
    require('litellm').set_verbose = true;
    require('litellm').ssl_verify = false;
}

class LiteLLM {
    /**
     * This class represents a LiteLLM.
     * It is used to interact with the LLM model for various tasks.
     * 
     * @param {Object} options - The options for the LiteLLM.
     * @param {string} [options.modelName="gpt-4o"] - The name of the model to use.
     * @param {string} [options.systemPrompt=null] - The system prompt to use.
     * @param {boolean} [options.stream=false] - Whether to stream the output.
     * @param {number} [options.temperature=0.5] - The temperature for the model.
     * @param {number} [options.maxTokens=4000] - The maximum number of tokens to generate.
     * @param {boolean} [options.sslVerify=false] - Whether to verify SSL certificates.
     */
    constructor({
        modelName = "gpt-4o",
        systemPrompt = null,
        stream = false,
        temperature = 0.5,
        maxTokens = 4000,
        sslVerify = false
    } = {}) {
        this.modelName = modelName;
        this.systemPrompt = systemPrompt;
        this.stream = stream;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.sslVerify = sslVerify;
    }

    _prepareMessages(task) {
        /**
         * Prepare the messages for the given task.
         * 
         * @param {string} task - The task to prepare messages for.
         * @returns {Array<Object>} - A list of messages prepared for the task.
         */
        const messages = [];

        if (this.systemPrompt) {
            messages.push({ role: "system", content: this.systemPrompt });
        }

        messages.push({ role: "user", content: task });

        return messages;
    }

    async run(task, ...args) {
        /**
         * Run the LLM model for the given task.
         * 
         * @param {string} task - The task to run the model for.
         * @param {...any} args - Additional arguments to pass to the model.
         * @returns {Promise<string>} - The content of the response from the model.
         */
        try {
            const messages = this._prepareMessages(task);

            const response = await completion({
                model: this.modelName,
                messages,
                stream: this.stream,
                temperature: this.temperature,
                maxTokens: this.maxTokens,
                ...args
            });

            const content = response.choices[0].message.content;
            return content;
        } catch (error) {
            console.error(error);
        }
    }

    async call(task, ...args) {
        /**
         * Call the LLM model for the given task.
         * 
         * @param {string} task - The task to run the model for.
         * @param {...any} args - Additional arguments to pass to the model.
         * @returns {Promise<string>} - The content of the response from the model.
         */
        return this.run(task, ...args);
    }
}

export { LiteLLM };