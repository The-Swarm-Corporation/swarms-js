import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logger } from 'loguru';
import { TikTokenizer } from '../models/tiktoken_wrapper.mjs';

class CodeExecutor {
    /**
     * A class to execute Python code and return the output as a string.
     * 
     * The class also logs the input and output using loguru and stores the outputs
     * in a folder called 'artifacts'.
     * 
     * @param {Object} options - The options for the CodeExecutor.
     * @param {number} [options.maxOutputLength=1000] - The maximum length of the output.
     * @param {string} [options.artifactsDirectory="artifacts"] - The directory to store artifacts.
     * @param {string} [options.language="python3"] - The language to execute the code in.
     */
    constructor({ maxOutputLength = 1000, artifactsDirectory = "artifacts", language = "python3" } = {}) {
        this.maxOutputLength = maxOutputLength;
        this.artifactsDir = artifactsDirectory;
        this.language = language;

        fs.mkdirSync(this.artifactsDir, { recursive: true });
        this.setupLogging();
        this.tokenizer = new TikTokenizer();
    }

    setupLogging() {
        /**
         * Sets up the loguru logger with colorful output.
         */
        logger.add(path.join(this.artifactsDir, "code_execution.log"), {
            format: "{time} {level} {message}",
            level: "DEBUG"
        });
        logger.info("Logger initialized and artifacts directory set up.");
    }

    formatCode(code) {
        /**
         * Formats the given Python code using black.
         * 
         * @param {string} code - The Python code to format.
         * @returns {string} - The formatted Python code.
         * @throws {Error} - If the code cannot be formatted.
         */
        try {
            const black = require('black');
            return black.formatStr(code, { mode: black.FileMode() });
        } catch (e) {
            logger.error(`Error formatting code: ${e.message}`);
            throw new Error(`Error formatting code: ${e.message}`);
        }
    }

    execute(code) {
        /**
         * Executes the given Python code and returns the output.
         * 
         * @param {string} code - The Python code to execute.
         * @returns {Promise<string>} - The output of the executed code.
         * @throws {Error} - If there is an error during the execution of the code.
         */
        return new Promise((resolve, reject) => {
            try {
                const formattedCode = this.formatCode(code);
                logger.info(`Executing code:\n${formattedCode}`);
                exec(`${this.language} -c "${formattedCode}"`, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(`Error executing code: ${stderr}`);
                        return reject(new Error(`Error executing code: ${stderr}`));
                    }
                    let output = stdout;
                    logger.info(`Code output:\n${output}`);
                    const tokenCount = this.tokenizer.countTokens(output);
                    console.log(tokenCount);

                    if (this.maxOutputLength && tokenCount > this.maxOutputLength) {
                        logger.warning(`Output length exceeds ${this.maxOutputLength} characters. Truncating output.`);
                        output = output.slice(0, this.maxOutputLength) + "...";
                    }

                    resolve(output);
                });
            } catch (e) {
                logger.error(`Error executing code: ${e.message}`);
                reject(new Error(`Error executing code: ${e.message}`));
            }
        });
    }
}

// Example usage:
// if (require.main === module) {
//     const executor = new CodeExecutor({ maxOutputLength: 300 });
//     const code = `
// import requests
// from typing import Any

// def fetch_financial_news(api_key: str, query: str, num_articles: int) -> Any:
//     try {
//         url = f"https://newsapi.org/v2/everything?q={query}&apiKey={api_key}"
//         response = requests.get(url)
//         response.raise_for_status()
//         return response.json()
//     except requests.RequestException as e:
//         print(f"Request Error: {e}")
//         raise
//     except ValueError as e:
//         print(f"Value Error: {e}")
//         raise

// api_key = ""
// result = fetch_financial_news(api_key, query="Nvidia news", num_articles=5)
// print(result)
//     `;
//     executor.execute(code).then(result => console.log(result)).catch(err => console.error(err));
// }