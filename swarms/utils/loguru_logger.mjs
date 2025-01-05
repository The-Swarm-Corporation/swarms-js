import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

function initializeLogger(logFolder = 'logs') {
    const AGENT_WORKSPACE = 'agent_workspace';

    // Check if WORKSPACE_DIR is set, if not, set it to AGENT_WORKSPACE
    if (!process.env.WORKSPACE_DIR) {
        process.env.WORKSPACE_DIR = AGENT_WORKSPACE;
    }

    // Create a folder within the agent_workspace
    const logFolderPath = path.join(process.env.WORKSPACE_DIR, logFolder);
    if (!fs.existsSync(logFolderPath)) {
        fs.mkdirSync(logFolderPath, { recursive: true });
    }

    // Generate a unique identifier for the log file
    const uuidForLog = uuidv4();
    const logFilePath = path.join(logFolderPath, `${logFolder}_${uuidForLog}.log`);

    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} ${level}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({ filename: logFilePath })
        ],
    });

    return logger;
}

// Example usage:
// const logger = initializeLogger();
// logger.info('Logger initialized');

export { initializeLogger };