import { config as loadEnv } from 'dotenv';
import { createLogger, transports, format } from 'winston';
import { promises as fs } from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { disableLogging } from '../utils/disable_logging.mjs';

const logger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'bootup.log' })
    ]
});

/**
 * Initialize swarms environment and configuration
 * 
 * Handles environment setup, logging configuration, telemetry,
 * and workspace initialization.
 */
async function bootup() {
    try {
        // Load environment variables
        loadEnv();

        // Configure logging
        if (process.env.SWARMS_VERBOSE_GLOBAL?.toLowerCase() === "false") {
            logger.transports.forEach(t => t.silent = true);
        }

        // Silent wandb
        process.env.WANDB_SILENT = "true";

        // Configure workspace
        const workspaceDir = path.join(process.cwd(), "agent_workspace");
        await fs.mkdir(workspaceDir, { recursive: true });
        process.env.WORKSPACE_DIR = workspaceDir;

        // Suppress warnings
        process.removeAllListeners('warning');

        // Run telemetry functions concurrently
        try {
            const worker = new Worker(new URL('../utils/disable_logging.mjs', import.meta.url));
            worker.on('message', (message) => {
                if (message === 'done') {
                    logger.info('Telemetry functions completed successfully.');
                }
            });
            worker.on('error', (error) => {
                logger.error(`Error running telemetry functions: ${error.message}`);
            });
        } catch (e) {
            logger.error(`Error running telemetry functions: ${e.message}`);
        }

    } catch (e) {
        logger.error(`Error during bootup: ${e.message}`);
        throw e;
    }
}

// Run bootup
bootup();