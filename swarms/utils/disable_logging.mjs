import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger, transports, format } from 'winston';

/**
 * Disables the LangChain deprecation warning.
 */
function disableLangchain() {
    // Ignore LangChainDeprecationWarning
    process.env.NODE_NO_WARNINGS = '1';
}

/**
 * Sets the logging level for a specific logger to 'error'.
 * 
 * @param {string} loggerName - The name of the logger to modify.
 */
function setLoggerLevel(loggerName) {
    const logger = createLogger({
        level: 'error',
        transports: [
            new transports.Console(),
            new transports.File({ filename: 'error.log' })
        ]
    });
    logger.error(`Logger ${loggerName} set to error level`);
}

/**
 * Disables logging for specific modules and sets up file and stream handlers.
 * Runs in a separate thread to avoid blocking the main thread.
 */
async function disableLogging() {
    process.env.WORKSPACE_DIR = "agent_workspace";

    // Disable tensorflow warnings
    process.env.TF_CPP_MIN_LOG_LEVEL = "3";

    // Set the logging level for the entire module
    const logger = createLogger({
        level: 'error',
        format: format.combine(
            format.timestamp(),
            format.json()
        ),
        transports: [
            new transports.Console(),
            new transports.File({ filename: 'error.log' })
        ]
    });

    const loggerNames = [
        "tensorflow",
        "h5py",
        "numexpr",
        "git",
        "wandb.docker.auth",
        "langchain",
        "distutils",
        "urllib3",
        "elasticsearch",
        "packaging"
    ];

    // Set the level for each logger concurrently
    await Promise.all(loggerNames.map(setLoggerLevel));

    // Remove all existing handlers
    logger.clear();

    // Get the workspace directory from the environment variables
    const workspaceDir = process.env.WORKSPACE_DIR;

    // Check if the workspace directory exists, if not, create it
    try {
        await fs.access(workspaceDir);
    } catch {
        await fs.mkdir(workspaceDir, { recursive: true });
    }

    // Create a file handler to log errors to the file
    logger.add(new transports.File({
        filename: path.join(workspaceDir, 'error.txt'),
        level: 'error'
    }));

    // Create a stream handler to log errors to the terminal
    logger.add(new transports.Console({
        level: 'error'
    }));

    disableLangchain();
}

/**
 * Starts the disableLogging function in a separate thread to avoid blocking the main thread.
 */
function startDisableLoggingInThread() {
    const worker = new Worker(new URL(import.meta.url));
    worker.postMessage('start');
    return worker;
}

export { disableLogging, startDisableLoggingInThread };