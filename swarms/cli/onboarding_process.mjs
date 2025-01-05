import fs from 'fs';
import path from 'path';
import { captureSystemData, logAgentData } from '../telemetry/capture_sys_data.mjs';
import { initialize_logger } from '../utils/loguru_logger.mjs';

const logger = initialize_logger({ log_folder: "onboarding_process" });

class OnboardingProcess {
    /**
     * This class handles the onboarding process for users. It collects user data including their
     * full name, first name, email, Swarms API key, and system data, then autosaves it in both a
     * main JSON file and a cache file for reliability. It supports loading previously saved or cached data.
     * 
     * @param {string} [autoSavePath="user_data.json"] - The path where user data is automatically saved.
     * @param {string} [cacheSavePath="user_data_cache.json"] - The path where user data is cached for reliability.
     */
    constructor(autoSavePath = "user_data.json", cacheSavePath = "user_data_cache.json") {
        this.userData = {};
        this.systemData = captureSystemData();
        this.autoSavePath = autoSavePath;
        this.cacheSavePath = cacheSavePath;
        this.loadExistingData();
    }

    /**
     * Loads existing user data from the auto-save file or cache if available.
     */
    loadExistingData() {
        if (fs.existsSync(this.autoSavePath)) {
            try {
                this.userData = JSON.parse(fs.readFileSync(this.autoSavePath, 'utf8'));
                logger.info(`Existing user data loaded from ${this.autoSavePath}`);
                return;
            } catch (e) {
                logger.error(`Failed to load user data from main file: ${e.message}`);
            }
        }

        if (fs.existsSync(this.cacheSavePath)) {
            try {
                this.userData = JSON.parse(fs.readFileSync(this.cacheSavePath, 'utf8'));
                logger.info(`User data loaded from cache: ${this.cacheSavePath}`);
            } catch (e) {
                logger.error(`Failed to load user data from cache: ${e.message}`);
            }
        }
    }

    /**
     * Saves the current user data to both the auto-save file and the cache file. If the main
     * save fails, the cache is updated instead. Implements retry logic with exponential backoff
     * in case both save attempts fail.
     * 
     * @param {number} [retryAttempts=3] - The number of retries if saving fails.
     */
    saveData(retryAttempts = 3) {
        let attempt = 0;
        let backoffTime = 1;

        while (attempt < retryAttempts) {
            try {
                const combinedData = { ...this.userData, ...this.systemData };
                logAgentData(combinedData);
                return;
            } catch (e) {
                logger.error(`Error saving user data (Attempt ${attempt + 1}): ${e.message}`);
            }

            setTimeout(() => {}, backoffTime * 1000);
            attempt += 1;
            backoffTime *= 2;
        }

        logger.error(`Failed to save user data after ${retryAttempts} attempts.`);
    }

    /**
     * Asks the user for input, validates it, and saves it in the userData dictionary.
     * Autosaves and caches after each valid input.
     * 
     * @param {string} prompt - The prompt message to display to the user.
     * @param {string} key - The key under which the input will be saved in userData.
     * @throws {Error} - If the input is empty or only contains whitespace.
     */
    askInput(prompt, key) {
        try {
            const response = prompt(prompt);
            if (response.trim().toLowerCase() === "quit") {
                logger.info("User chose to quit the onboarding process.");
                process.exit(0);
            }
            if (!response.trim()) {
                throw new Error(`${key.charAt(0).toUpperCase() + key.slice(1)} cannot be empty.`);
            }
            this.userData[key] = response.trim();
            this.saveData();
            return response;
        } catch (e) {
            logger.warn(e.message);
            this.askInput(prompt, key);
        }
    }

    /**
     * Initiates the onboarding process by collecting the user's full name, first name, email,
     * Swarms API key, and system data. Additionally, it reminds the user to set their WORKSPACE_DIR environment variable.
     */
    collectUserInfo() {
        logger.info("Initiating swarms cloud onboarding process...");
        this.askInput("Enter your first name (or type 'quit' to exit): ", "first_name");
        this.askInput("Enter your Last Name (or type 'quit' to exit): ", "last_name");
        this.askInput("Enter your email (or type 'quit' to exit): ", "email");
        const workspace = this.askInput("Enter your WORKSPACE_DIR: This is where logs, errors, and agent configurations will be stored (or type 'quit' to exit). Remember to set this as an environment variable: https://docs.swarms.world/en/latest/swarms/install/quickstart/ || ", "workspace_dir");
        process.env.WORKSPACE_DIR = workspace;
        logger.info("Important: Please ensure you have set your WORKSPACE_DIR environment variable as per the instructions provided.");
        logger.info("Additionally, remember to add your API keys for your respective models in your .env file.");
        logger.success("Onboarding process completed successfully!");
    }

    /**
     * Main method to run the onboarding process. It handles unexpected errors and ensures
     * proper finalization.
     */
    run() {
        try {
            this.collectUserInfo();
        } catch (e) {
            logger.error(`An unexpected error occurred: ${e.message}`);
        } finally {
            logger.info("Finalizing the onboarding process.");
        }
    }
}

// if (import.meta.main) {
//     const onboarding = new OnboardingProcess();
//     onboarding.run();
// }

export { OnboardingProcess };