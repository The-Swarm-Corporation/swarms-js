import os from 'os';
import { BaseModel, Field } from 'pydantic';
import { ThreadPoolExecutor, asCompleted } from 'some-concurrent-library'; // Replace with an appropriate library if needed
import { initialize_logger } from '../utils/loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "tool_registry" });

class ToolMetadata extends BaseModel {
    name = Field(null);
    documentation = Field(null);
    time_created = Field(
        new Date().toISOString(),
        { description: "Time when the tool was added to the registry." }
    );
}

class ToolStorageSchema extends BaseModel {
    name = Field(null);
    description = Field(null);
    tools = Field([]);
    time_created = Field(
        new Date().toISOString(),
        { description: "Time when the registry was created." }
    );
}

class ToolStorage {
    /**
     * A class that represents a storage for tools.
     * 
     * @param {Object} options - The options for the storage.
     * @param {string} [options.name=null] - The name of the storage.
     * @param {string} [options.description=null] - The description of the storage.
     * @param {boolean} [options.verbose=null] - A flag to enable verbose logging.
     * @param {Array<Function>} [options.tools=null] - A list of tool functions.
     */
    constructor({ name = null, description = null, verbose = null, tools = null } = {}) {
        this.name = name;
        this.description = description;
        this.verbose = verbose;
        this.tools = tools;
        this._tools = {};
        this._settings = {};
        this.tool_storage_schema = new ToolStorageSchema({
            name,
            description,
            tools: []
        });

        // Pool
        this.pool = new ThreadPoolExecutor({ maxWorkers: os.cpus().length });
    }

    addTool(func) {
        /**
         * Adds a tool to the storage.
         * 
         * @param {Function} func - The tool function to be added.
         * @throws {Error} - If a tool with the same name already exists.
         */
        try {
            const name = func.name;
            const docs = func.toString();

            this.addToolToLog(name, docs);

            logger.info(`Adding tool: ${name}`);
            if (name in this._tools) {
                throw new Error(`Tool with name ${name} already exists.`);
            }
            this._tools[name] = func;
            logger.info(`Added tool: ${name}`);
        } catch (e) {
            logger.error(e.message);
            throw e;
        }
    }

    addManyTools(funcs) {
        /**
         * Adds multiple tools to the storage.
         * 
         * @param {Array<Function>} funcs - The list of tool functions to be added.
         */
        const futures = funcs.map(func => this.pool.submit(() => this.addTool(func)));
        for (const future of asCompleted(futures)) {
            try {
                future.result();
            } catch (e) {
                logger.error(`Error adding tool: ${e.message}`);
            }
        }
    }

    getTool(name) {
        /**
         * Retrieves a tool by its name.
         * 
         * @param {string} name - The name of the tool to retrieve.
         * @returns {Function} - The tool function.
         * @throws {Error} - If no tool with the given name is found.
         */
        try {
            logger.info(`Getting tool: ${name}`);
            if (!(name in this._tools)) {
                throw new Error(`No tool found with name: ${name}`);
            }
            return this._tools[name];
        } catch (e) {
            logger.error(e.message);
            throw e;
        }
    }

    setSetting(key, value) {
        /**
         * Sets a setting in the storage.
         * 
         * @param {string} key - The key for the setting.
         * @param {any} value - The value for the setting.
         */
        this._settings[key] = value;
        logger.info(`Setting ${key} set to ${value}`);
    }

    getSetting(key) {
        /**
         * Gets a setting from the storage.
         * 
         * @param {string} key - The key for the setting.
         * @returns {any} - The value of the setting.
         * @throws {Error} - If the setting is not found.
         */
        try {
            return this._settings[key];
        } catch (e) {
            logger.error(`Setting ${key} not found error: ${e.message}`);
            throw e;
        }
    }

    listTools() {
        /**
         * Lists all registered tools.
         * 
         * @returns {Array<string>} - A list of tool names.
         */
        return this.tool_storage_schema.model_dump_json({ indent: 4 });
    }

    addToolToLog(name, docs) {
        const log = new ToolMetadata({
            name,
            documentation: docs
        });

        this.tool_storage_schema.tools.push(log);
    }

    addMultipleToolsToLog(names, docs) {
        for (const [name, doc] of zip(names, docs)) {
            this.addToolToLog(name, doc);
        }
    }
}

function toolRegistry(storage = null) {
    /**
     * A decorator that registers a function as a tool in the storage.
     * 
     * @param {ToolStorage} storage - The storage instance to register the tool in.
     * @returns {Function} - The decorator function.
     */
    return function decorator(func) {
        const name = func.name;

        logger.info(`Registering tool: ${name}`);
        storage.addTool(func);

        function wrapper(...args) {
            try {
                const result = func(...args);
                logger.info(`Tool ${name} executed successfully`);
                return result;
            } catch (e) {
                logger.error(`Error executing tool ${name}: ${e.message}`);
                throw e;
            }
        }

        logger.info(`Registered tool: ${name}`);
        return wrapper;
    };
}

// Example usage:
// const storage = new ToolStorage({
//     name: "Tool Storage",
//     description: "A storage for tools."
// });

// @toolRegistry(storage)
// function exampleTool(a, b) {
//     /**
//      * An example tool that adds two numbers.
//      * 
//      * @param {number} a - The first number.
//      * @param {number} b - The second number.
//      * @returns {number} - The sum of the two numbers.
//      */
//     return a + b;
// }

// function sampleApiTool(a, b) {
//     /**
//      * An example tool that adds two numbers.
//      * 
//      * @param {number} a - The first number.
//      * @param {number} b - The second number.
//      * @returns {number} - The sum of the two numbers.
//      */
//     return a + b;
// }

// function useExampleTool(a, b) {
//     /**
//      * A function that uses the example tool.
//      * 
//      * @param {number} a - The first number.
//      * @param {number} b - The second number.
//      * @returns {number} - The result of the example tool.
//      */
//     const tool = storage.getTool("exampleTool");
//     return tool(a, b);
// }

// // Test the storage and querying
// if (require.main === module) {
//     storage.addManyTools([exampleTool, sampleApiTool, useExampleTool]);
//     storage.setSetting("exampleSetting", 42);
//     console.log(storage.getSetting("exampleSetting")); // Should print 42
//     console.log(storage.listTools()); // Should print the list of tools
// }