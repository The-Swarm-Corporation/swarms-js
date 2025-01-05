import fs from 'fs';
import path from 'path';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('workspace-manager');

/**
 * Manages the workspace directory and settings for the application.
 * This class is responsible for setting up the workspace directory, logging configuration,
 * and retrieving environment variables for telemetry and API key.
 */
export class WorkspaceManager {
    /**
     * @param {string} [workspaceDir="agent_workspace"] - The path to the workspace directory.
     * @param {boolean} [useTelemetry=true] - A flag indicating whether to use telemetry.
     * @param {string} [apiKey=null] - The API key for the application.
     */
    constructor({
        workspaceDir = "agent_workspace",
        useTelemetry = true,
        apiKey = null
    } = {}) {
        this.workspaceDir = workspaceDir;
        this.useTelemetry = useTelemetry;
        this.apiKey = apiKey;
        this.workspacePath = path.resolve(this.workspaceDir);
    }

    /**
     * Create a new .env file with default WORKSPACE_DIR.
     * @param {string} envFilePath - The path to the .env file.
     */
    _createEnvFile(envFilePath) {
        fs.writeFileSync(envFilePath, "WORKSPACE_DIR=agent_workspace\n");
        logger.info("Created a new .env file with default WORKSPACE_DIR.");
    }

    /**
     * Append WORKSPACE_DIR to .env if it doesn't exist.
     * @param {string} envFilePath - The path to the .env file.
     */
    _appendToEnvFile(envFilePath) {
        const content = fs.readFileSync(envFilePath, 'utf8');
        if (!content.includes("WORKSPACE_DIR")) {
            fs.appendFileSync(envFilePath, "WORKSPACE_DIR=agent_workspace\n");
            logger.info("Appended WORKSPACE_DIR to .env file.");
        }
    }

    /**
     * Get the workspace directory from environment variable or default.
     * @param {string} [workspaceDir=null] - The path to the workspace directory.
     * @returns {string} The path to the workspace directory.
     */
    _getWorkspaceDir(workspaceDir = null) {
        return workspaceDir || process.env.WORKSPACE_DIR || "agent_workspace";
    }

    /**
     * Get telemetry status from environment variable or default.
     * @param {boolean} [useTelemetry=null] - A flag indicating whether to use telemetry.
     * @returns {boolean} The status of telemetry usage.
     */
    _getTelemetryStatus(useTelemetry = null) {
        return useTelemetry !== null ? useTelemetry : (process.env.USE_TELEMETRY || "true").toLowerCase() === "true";
    }

    /**
     * Get API key from environment variable or default.
     * @param {string} [apiKey=null] - The API key for the application.
     * @returns {string|null} The API key or null if not set.
     */
    _getApiKey(apiKey = null) {
        return apiKey || process.env.SWARMS_API_KEY;
    }

    /**
     * Initialize the workspace directory if it doesn't exist.
     */
    _initWorkspace() {
        if (!fs.existsSync(this.workspacePath)) {
            fs.mkdirSync(this.workspacePath, { recursive: true });
        }
        logger.info("Workspace directory initialized.");
    }

    /**
     * Get the workspace path.
     * @returns {string} The path to the workspace directory.
     */
    get getWorkspacePath() {
        return this.workspacePath;
    }

    /**
     * Get telemetry status.
     * @returns {boolean} The status of telemetry usage.
     */
    get getTelemetryStatus() {
        return this.useTelemetry;
    }

    /**
     * Get API key.
     * @returns {string|null} The API key or null if not set.
     */
    get getApiKey() {
        return this.apiKey;
    }

    /**
     * Run the workspace manager to initialize settings.
     */
    run() {
        try {
            const envFilePath = path.resolve('.env');
            if (!fs.existsSync(envFilePath)) {
                this._createEnvFile(envFilePath);
            } else {
                this._appendToEnvFile(envFilePath);
            }

            this.workspaceDir = this._getWorkspaceDir(this.workspaceDir);
            this.workspacePath = path.resolve(this.workspaceDir);

            this.useTelemetry = this._getTelemetryStatus(this.useTelemetry);
            this.apiKey = this._getApiKey(this.apiKey);

            this._initWorkspace();
        } catch (error) {
            logger.error(`Error initializing WorkspaceManager: ${error.message}`);
            throw error;
        }
    }
}

// Example usage (commented out):
/*
const manager = new WorkspaceManager();
manager.run();
console.log(manager.getWorkspacePath);
console.log(manager.getTelemetryStatus);
console.log(manager.getApiKey);
*/