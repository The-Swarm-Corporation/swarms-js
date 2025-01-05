import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('swarm_registry');

/**
 * SwarmRegistry class for managing a registry of swarms.
 */
export class SwarmRegistry {
    constructor() {
        this.swarmPool = [];
    }

    /**
     * Adds a swarm to the registry.
     * @param {Function} swarm - The swarm to add to the registry.
     */
    add(swarm) {
        this.swarmPool.push(swarm);
        logger.info(`Added swarm '${swarm.name}' to the registry.`);
    }

    /**
     * Queries the registry for a swarm by name.
     * @param {string} swarmName - The name of the swarm to query.
     * @returns {Function} The swarm function corresponding to the given name.
     */
    query(swarmName) {
        if (!this.swarmPool.length) {
            throw new Error("No swarms found in registry");
        }

        if (!swarmName) {
            throw new Error("No swarm name provided.");
        }

        for (const swarm of this.swarmPool) {
            if (swarm.name === swarmName) {
                const name = swarm.name;
                const description = swarm.description || "No description available";
                const agentCount = swarm.agents?.length || 0;
                const taskCount = swarm.tasks?.length || 0;

                const log = `Swarm: ${name}\nDescription: ${description}\nAgents: ${agentCount}\nTasks: ${taskCount}`;
                logger.info(log);

                return swarm;
            }
        }

        throw new Error(`Swarm '${swarmName}' not found in registry.`);
    }

    /**
     * Removes a swarm from the registry by name.
     * @param {string} swarmName - The name of the swarm to remove.
     */
    remove(swarmName) {
        const index = this.swarmPool.findIndex(swarm => swarm.name === swarmName);
        if (index !== -1) {
            this.swarmPool.splice(index, 1);
            logger.info(`Removed swarm '${swarmName}' from the registry.`);
        } else {
            throw new Error(`Swarm '${swarmName}' not found in registry.`);
        }
    }

    /**
     * Lists the names of all swarms in the registry.
     * @returns {Array<string>} A list of swarm names.
     */
    listSwarms() {
        if (!this.swarmPool.length) {
            throw new Error("No swarms found in registry.");
        }

        this.swarmPool.forEach(swarm => {
            const name = swarm.name;
            const description = swarm.description || "No description available";
            const agentCount = swarm.agents?.length || 0;
            const taskCount = swarm.tasks?.length || 0;

            const log = `Swarm: ${name}\nDescription: ${description}\nAgents: ${agentCount}\nTasks: ${taskCount}`;
            logger.info(log);
        });

        return this.swarmPool.map(swarm => swarm.name);
    }

    /**
     * Runs a swarm by name with the given arguments.
     * @param {string} swarmName - The name of the swarm to run.
     * @param {...any} args - Variable length argument list.
     * @returns {any} The result of running the swarm.
     */
    run(swarmName, ...args) {
        const swarm = this.query(swarmName);
        return swarm(...args);
    }

    /**
     * Adds a list of swarms to the registry.
     * @param {Array<Function>} swarms - A list of swarms to add to the registry.
     * @returns {Array<Function>} The updated swarm pool.
     */
    addListOfSwarms(swarms) {
        swarms.forEach(swarm => this.add(swarm));
        return this.swarmPool;
    }

    /**
     * Queries the registry for multiple swarms by name.
     * @param {Array<string>} swarmNames - A list of swarm names to query.
     * @returns {Array<Function>} A list of swarm functions corresponding to the given names.
     */
    queryMultipleOfSwarms(swarmNames) {
        return swarmNames.map(swarmName => this.query(swarmName));
    }

    /**
     * Removes a list of swarms from the registry by name.
     * @param {Array<string>} swarmNames - A list of swarm names to remove.
     * @returns {Array<Function>} The updated swarm pool.
     */
    removeListOfSwarms(swarmNames) {
        swarmNames.forEach(swarmName => this.remove(swarmName));
        return this.swarmPool;
    }

    /**
     * Runs a list of swarms by name with the given arguments.
     * @param {Array<string>} swarmNames - A list of swarm names to run.
     * @param {...any} args - Variable length argument list.
     * @returns {Array<any>} A list of results of running the swarms.
     */
    runMultipleOfSwarms(swarmNames, ...args) {
        return swarmNames.map(swarmName => this.run(swarmName, ...args));
    }
}

/**
 * Decorator to add a function to the registry.
 * @param {SwarmRegistry} swarmRegistry - The swarm registry instance.
 * @returns {Function} The decorated function.
 */
export function swarmRegistryDecorator(swarmRegistry) {
    return function (func) {
        swarmRegistry.add(func);
        logger.info(`Added swarm '${func.name}' to the registry.`);
        return func;
    };
}

// Example usage (commented out):
/*
const registry = new SwarmRegistry();

function exampleSwarm() {
    console.log("Running example swarm");
}

registry.add(exampleSwarm);
registry.run("exampleSwarm");
*/