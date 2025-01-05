import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { inspect } from 'util';
import { logger } from '../utils/loguru_logger.mjs';

class SafeLoaderUtils {
    /**
     * Detect if an object is a class instance (excluding built-in types).
     * @param {any} obj - Object to check
     * @returns {boolean} True if object is a class instance
     */
    static isClassInstance(obj) {
        if (obj === null || obj === undefined) return false;
        const objType = typeof obj;
        return objType === 'object' && obj.constructor && obj.constructor.name !== 'Object';
    }

    /**
     * Check if a value is of a safe, serializable type.
     * @param {any} value - Value to check
     * @returns {boolean} True if the value is safe to serialize
     */
    static isSafeType(value) {
        const safeTypes = ['boolean', 'number', 'string', 'undefined'];
        if (safeTypes.includes(typeof value) || value === null) return true;
        if (Array.isArray(value)) return value.every(SafeLoaderUtils.isSafeType);
        if (value instanceof Date || value instanceof uuidv4) return true;
        if (typeof value === 'object') {
            return Object.entries(value).every(([k, v]) => typeof k === 'string' && SafeLoaderUtils.isSafeType(v));
        }
        try {
            JSON.stringify(value);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get all attributes of a class, including inherited ones.
     * @param {any} obj - Object to inspect
     * @returns {Set<string>} Set of attribute names
     */
    static getClassAttributes(obj) {
        const attributes = new Set();
        let current = obj;
        while (current) {
            Object.getOwnPropertyNames(current).forEach(attr => attributes.add(attr));
            current = Object.getPrototypeOf(current);
        }
        return attributes;
    }

    /**
     * Create a dictionary of safe values from an object's state.
     * @param {any} obj - Object to create state dict from
     * @returns {Object<string, any>} Dictionary of safe values
     */
    static createStateDict(obj) {
        const stateDict = {};
        SafeLoaderUtils.getClassAttributes(obj).forEach(attr => {
            if (!attr.startsWith('_')) {
                const value = obj[attr];
                if (SafeLoaderUtils.isSafeType(value)) {
                    stateDict[attr] = value;
                }
            }
        });
        return stateDict;
    }

    /**
     * Automatically detect and preserve all class instances in an object.
     * @param {any} obj - Object to preserve instances from
     * @returns {Object<string, any>} Dictionary of preserved instances
     */
    static preserveInstances(obj) {
        const preserved = {};
        SafeLoaderUtils.getClassAttributes(obj).forEach(attr => {
            if (!attr.startsWith('_')) {
                const value = obj[attr];
                if (SafeLoaderUtils.isClassInstance(value)) {
                    preserved[attr] = value;
                }
            }
        });
        return preserved;
    }
}

class SafeStateManager {
    /**
     * Save an object's state to a file, automatically handling complex objects.
     * @param {any} obj - Object to save state from
     * @param {string} filePath - Path to save state to
     */
    static async saveState(obj, filePath) {
        try {
            const stateDict = SafeLoaderUtils.createStateDict(obj);
            await fs.promises.mkdir(filePath, { recursive: true });
            await fs.promises.writeFile(filePath, JSON.stringify(stateDict, null, 2));
            logger.info(`Successfully saved state to: ${filePath}`);
        } catch (error) {
            logger.error(`Error saving state: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load state into an object while preserving class instances.
     * @param {any} obj - Object to load state into
     * @param {string} filePath - Path to load state from
     */
    static async loadState(obj, filePath) {
        try {
            if (!await fs.promises.access(filePath).then(() => true).catch(() => false)) {
                throw new Error(`State file not found: ${filePath}`);
            }
            const preserved = SafeLoaderUtils.preserveInstances(obj);
            const stateDict = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
            Object.entries(stateDict).forEach(([key, value]) => {
                if (!key.startsWith('_') && !preserved[key] && SafeLoaderUtils.isSafeType(value)) {
                    obj[key] = value;
                }
            });
            Object.entries(preserved).forEach(([key, value]) => {
                obj[key] = value;
            });
            logger.info(`Successfully loaded state from: ${filePath}`);
        } catch (error) {
            logger.error(`Error loading state: ${error.message}`);
            throw error;
        }
    }
}

// Example decorator for easy integration
// function safeStateMethods(cls) {
//     cls.prototype.save = function(filePath) {
//         return SafeStateManager.saveState(this, filePath);
//     };
//     cls.prototype.load = function(filePath) {
//         return SafeStateManager.loadState(this, filePath);
//     };
//     return cls;
// }

// Example usage (commented out):
/*
class ExampleClass {
    constructor() {
        this.name = "Example";
        this.value = 42;
        this.date = new Date();
    }
}

const example = new ExampleClass();
await SafeStateManager.saveState(example, './example_state.json');
await SafeStateManager.loadState(example, './example_state.json');
console.log(example);
*/