import { Agent } from '../structs/agent.mjs';
import { initialize_logger } from './loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "swarm_reliability_checks" });

/**
 * Performs reliability checks on swarm configuration parameters.
 * 
 * @param {Array<Agent|Function>} agents - List of Agent objects or callables that will be executed.
 * @param {number} maxLoops - Maximum number of execution loops.
 * @param {string} [name=null] - Name identifier for the swarm.
 * @param {string} [description=null] - Description of the swarm's purpose.
 * @param {string} [flow=null] - Flow parameter for the swarm.
 * @throws {TypeError|ValueError} - If any parameters fail validation checks.
 */
function reliabilityCheck(agents, maxLoops, name = null, description = null, flow = null) {
    logger.info("Initializing swarm reliability checks");

    // Type checking
    if (!Array.isArray(agents)) {
        throw new TypeError("agents parameter must be a list");
    }

    if (typeof maxLoops !== 'number') {
        throw new TypeError("maxLoops must be an integer");
    }

    // Validate agents
    if (agents.length === 0) {
        throw new Error("Agents list cannot be empty");
    }

    agents.forEach((agent, i) => {
        if (!(agent instanceof Agent || typeof agent === 'function')) {
            throw new TypeError(`Agent at index ${i} must be an Agent instance or Callable`);
        }
    });

    // Validate maxLoops
    if (maxLoops <= 0) {
        throw new Error("maxLoops must be greater than 0");
    }

    if (maxLoops > 1000) {
        logger.warning("Large maxLoops value detected. This may impact performance.");
    }

    // Validate name
    if (name === null) {
        throw new Error("name parameter is required");
    }
    if (typeof name !== 'string') {
        throw new TypeError("name must be a string");
    }
    if (name.trim().length === 0) {
        throw new Error("name cannot be empty or just whitespace");
    }

    // Validate description
    if (description === null) {
        throw new Error("description parameter is required");
    }
    if (typeof description !== 'string') {
        throw new TypeError("description must be a string");
    }
    if (description.trim().length === 0) {
        throw new Error("description cannot be empty or just whitespace");
    }

    // Validate flow
    if (flow === null) {
        throw new Error("flow parameter is required");
    }
    if (typeof flow !== 'string') {
        throw new TypeError("flow must be a string");
    }

    logger.info("All reliability checks passed successfully");
}

export { reliabilityCheck };