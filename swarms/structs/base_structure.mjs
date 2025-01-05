import fs from 'fs';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'yaml';
import toml from 'toml';
import { logger } from '../utils/loguru_logger.mjs';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const execAsync = promisify(exec);

/**
 * Base structure.
 */
export class BaseStructure {
    /**
     * @param {string} [name=null] - The name of the structure
     * @param {string} [description=null] - The description of the structure
     * @param {boolean} [saveMetadataOn=true] - Whether to save metadata
     * @param {string} [saveArtifactPath="./artifacts"] - Path to save artifacts
     * @param {string} [saveMetadataPath="./metadata"] - Path to save metadata
     * @param {string} [saveErrorPath="./errors"] - Path to save errors
     * @param {string} [workspaceDir="./workspace"] - Workspace directory
     */
    constructor({
        name = null,
        description = null,
        saveMetadataOn = true,
        saveArtifactPath = "./artifacts",
        saveMetadataPath = "./metadata",
        saveErrorPath = "./errors",
        workspaceDir = "./workspace"
    } = {}) {
        this.name = name;
        this.description = description;
        this.saveMetadataOn = saveMetadataOn;
        this.saveArtifactPath = saveArtifactPath;
        this.saveMetadataPath = saveMetadataPath;
        this.saveErrorPath = saveErrorPath;
        this.workspaceDir = workspaceDir;
    }

    /**
     * Run the structure.
     */
    run(...args) {
        // Implementation here
    }

    /**
     * Save data to file.
     * @param {any} data - Data to save
     * @param {string} filePath - Path to save the file
     */
    saveToFile(data, filePath) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    /**
     * Load data from file.
     * @param {string} filePath - Path to load the file from
     * @returns {any} Loaded data
     */
    loadFromFile(filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    /**
     * Save metadata to file.
     * @param {object} metadata - Metadata to save
     */
    saveMetadata(metadata) {
        if (this.saveMetadataOn) {
            const filePath = path.join(this.saveMetadataPath, `${this.name}_metadata.json`);
            this.saveToFile(metadata, filePath);
        }
    }

    /**
     * Load metadata from file.
     * @returns {object} Loaded metadata
     */
    loadMetadata() {
        const filePath = path.join(this.saveMetadataPath, `${this.name}_metadata.json`);
        return this.loadFromFile(filePath);
    }

    /**
     * Log error to file.
     * @param {string} errorMessage - Error message to log
     */
    logError(errorMessage) {
        const filePath = path.join(this.saveErrorPath, `${this.name}_errors.log`);
        fs.appendFileSync(filePath, `${errorMessage}\n`);
    }

    /**
     * Save artifact to file.
     * @param {any} artifact - Artifact to save
     * @param {string} artifactName - Name of the artifact
     */
    saveArtifact(artifact, artifactName) {
        const filePath = path.join(this.saveArtifactPath, `${artifactName}.json`);
        this.saveToFile(artifact, filePath);
    }

    /**
     * Load artifact from file.
     * @param {string} artifactName - Name of the artifact
     * @returns {any} Loaded artifact
     */
    loadArtifact(artifactName) {
        const filePath = path.join(this.saveArtifactPath, `${artifactName}.json`);
        return this.loadFromFile(filePath);
    }

    /**
     * Get current timestamp.
     * @returns {string} Current timestamp
     */
    _currentTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Log event to file.
     * @param {string} event - Event to log
     * @param {string} [eventType="INFO"] - Type of event
     */
    logEvent(event, eventType = "INFO") {
        const timestamp = this._currentTimestamp();
        const logMessage = `[${timestamp}] [${eventType}] ${event}\n`;
        const filePath = path.join(this.saveMetadataPath, `${this.name}_events.log`);
        fs.appendFileSync(filePath, logMessage);
    }

    /**
     * Run the structure asynchronously.
     */
    async runAsync(...args) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.run(...args));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save metadata to file asynchronously.
     * @param {object} metadata - Metadata to save
     */
    async saveMetadataAsync(metadata) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.saveMetadata(metadata));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load metadata from file asynchronously.
     * @returns {object} Loaded metadata
     */
    async loadMetadataAsync() {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.loadMetadata());
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Log error to file asynchronously.
     * @param {string} errorMessage - Error message to log
     */
    async logErrorAsync(errorMessage) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.logError(errorMessage));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save artifact to file asynchronously.
     * @param {any} artifact - Artifact to save
     * @param {string} artifactName - Name of the artifact
     */
    async saveArtifactAsync(artifact, artifactName) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.saveArtifact(artifact, artifactName));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load artifact from file asynchronously.
     * @param {string} artifactName - Name of the artifact
     * @returns {any} Loaded artifact
     */
    async loadArtifactAsync(artifactName) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.loadArtifact(artifactName));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Log event to file asynchronously.
     * @param {string} event - Event to log
     * @param {string} [eventType="INFO"] - Type of event
     */
    async logEventAsync(event, eventType = "INFO") {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.logEvent(event, eventType));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Save data to file asynchronously.
     * @param {any} data - Data to save
     * @param {string} filePath - Path to save the file
     */
    async saveToFileAsync(data, filePath) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.saveToFile(data, filePath));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Load data from file asynchronously.
     * @param {string} filePath - Path to load the file from
     * @returns {any} Loaded data
     */
    async loadFromFileAsync(filePath) {
        return await new Promise((resolve, reject) => {
            try {
                resolve(this.loadFromFile(filePath));
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Run the structure in a thread.
     */
    runInThread(...args) {
        return new Promise((resolve, reject) => {
            const thread = new Worker(() => {
                try {
                    resolve(this.run(...args));
                } catch (error) {
                    reject(error);
                }
            });
            thread.postMessage({});
        });
    }

    /**
     * Save metadata to file in a thread.
     * @param {object} metadata - Metadata to save
     */
    saveMetadataInThread(metadata) {
        return new Promise((resolve, reject) => {
            const thread = new Worker(() => {
                try {
                    resolve(this.saveMetadata(metadata));
                } catch (error) {
                    reject(error);
                }
            });
            thread.postMessage({});
        });
    }

    /**
     * Run the structure concurrently.
     */
    async runConcurrent(...args) {
        return await this.runAsync(...args);
    }

    /**
     * Compress data.
     * @param {any} data - Data to compress
     * @returns {Buffer} Compressed data
     */
    async compressData(data) {
        return await gzipAsync(JSON.stringify(data));
    }

    /**
     * Decompress data.
     * @param {Buffer} data - Data to decompress
     * @returns {any} Decompressed data
     */
    async decompressData(data) {
        return JSON.parse((await gunzipAsync(data)).toString());
    }

    /**
     * Run batched data.
     * @param {Array<any>} batchedData - Batched data to run
     * @param {number} [batchSize=10] - Batch size
     * @returns {Array<any>} Results of batched data
     */
    async runBatched(batchedData, batchSize = 10, ...args) {
        const results = [];
        for (let i = 0; i < batchedData.length; i += batchSize) {
            const batch = batchedData.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(data => this.runAsync(data, ...args)));
            results.push(...batchResults);
        }
        return results;
    }

    /**
     * Load config from file.
     * @param {string} [config=null] - Path to config file
     * @returns {object} Loaded config
     */
    loadConfig(config = null) {
        return this.loadFromFile(config);
    }

    /**
     * Backup data to file.
     * @param {any} data - Data to backup
     * @param {string} [backupPath=null] - Path to backup file
     */
    backupData(data, backupPath = null) {
        const timestamp = this._currentTimestamp();
        const backupFilePath = path.join(backupPath, `${timestamp}.json`);
        this.saveToFile(data, backupFilePath);
    }

    /**
     * Monitor resource usage.
     */
    monitorResources() {
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        const cpuUsage = process.cpuUsage().user / 1000;
        this.logEvent(`Resource usage - Memory: ${memoryUsage.toFixed(2)} MB, CPU: ${cpuUsage.toFixed(2)} ms`);
    }

    /**
     * Run the structure with resource monitoring.
     */
    runWithResources(...args) {
        this.monitorResources();
        return this.run(...args);
    }

    /**
     * Run batched data with resource monitoring.
     * @param {Array<any>} batchedData - Batched data to run
     * @param {number} [batchSize=10] - Batch size
     * @returns {Array<any>} Results of batched data
     */
    async runWithResourcesBatched(batchedData, batchSize = 10, ...args) {
        this.monitorResources();
        return await this.runBatched(batchedData, batchSize, ...args);
    }

    /**
     * Serialize callable attributes.
     * @param {Function} attrValue - Callable attribute
     * @returns {object} Serialized callable attribute
     */
    _serializeCallable(attrValue) {
        return {
            name: attrValue.name || attrValue.constructor.name,
            doc: attrValue.toString()
        };
    }

    /**
     * Serialize an individual attribute.
     * @param {string} attrName - Attribute name
     * @param {any} attrValue - Attribute value
     * @returns {any} Serialized attribute value
     */
    _serializeAttr(attrName, attrValue) {
        try {
            if (typeof attrValue === 'function') {
                return this._serializeCallable(attrValue);
            } else if (attrValue && typeof attrValue.toDict === 'function') {
                return attrValue.toDict();
            } else {
                JSON.stringify(attrValue);
                return attrValue;
            }
        } catch (error) {
            return `<Non-serializable: ${typeof attrValue}>`;
        }
    }

    /**
     * Convert class attributes to dictionary.
     * @returns {object} Dictionary representation of class attributes
     */
    toDict() {
        return Object.fromEntries(
            Object.entries(this).map(([key, value]) => [key, this._serializeAttr(key, value)])
        );
    }

    /**
     * Convert class attributes to JSON.
     * @param {number} [indent=4] - Indentation level
     * @returns {string} JSON representation of class attributes
     */
    toJson(indent = 4) {
        return JSON.stringify(this.toDict(), null, indent);
    }

    /**
     * Convert class attributes to YAML.
     * @param {number} [indent=4] - Indentation level
     * @returns {string} YAML representation of class attributes
     */
    toYaml(indent = 4) {
        return yaml.stringify(this.toDict(), { indent });
    }

    /**
     * Convert class attributes to TOML.
     * @returns {string} TOML representation of class attributes
     */
    toToml() {
        return toml.stringify(this.toDict());
    }

    // function commented_out_function(x) {
    //     return x * 2;
    // }
}

// Example usage:
/*
const baseStructure = new BaseStructure({
    name: "ExampleStructure",
    description: "An example base structure"
});

// Save metadata
baseStructure.saveMetadata({ key: "value" });

// Load metadata
const metadata = baseStructure.loadMetadata();
console.log(metadata);

// Log error
baseStructure.logError("An error occurred");

// Save artifact
baseStructure.saveArtifact({ key: "value" }, "exampleArtifact");

// Load artifact
const artifact = baseStructure.loadArtifact("exampleArtifact");
console.log(artifact);

// Run asynchronously
baseStructure.runAsync().then(() => {
    console.log("Run completed");
}).catch(console.error);
*/