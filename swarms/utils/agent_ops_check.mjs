import { logger } from './loguru_logger.mjs';
import { config } from 'dotenv';
import agentops from 'agentops';

config(); // Load environment variables from .env file

function tryImportAgentOps(...args) {
    try {
        logger.info("Trying to import agentops");
        agentops.init(process.env.AGENTOPS_API_KEY, ...args);
        return "agentops imported successfully.";
    } catch (error) {
        logger.error("Could not import agentops");
        return "Could not import agentops";
    }
}

function endSessionAgentOps() {
    try {
        logger.info("Trying to end session");
        agentops.end_session("Success");
        return "Session ended successfully.";
    } catch (error) {
        logger.error("Could not import agentops");
        return "Could not end session.";
    }
}

export { tryImportAgentOps, endSessionAgentOps };