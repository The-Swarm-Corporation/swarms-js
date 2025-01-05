import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createLogger, transports, format } from 'winston';

const logger = createLogger({
    level: 'error',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'file_processing.log' })
    ]
});

/**
 * Check if a folder exists at the specified path.
 * 
 * @param {string} folderName - The path to the folder to check.
 * @returns {Promise<boolean>} - True if the folder exists, False otherwise.
 */
async function checkIfFolderExists(folderName) {
    try {
        const stats = await fs.stat(folderName);
        return stats.isDirectory();
    } catch (e) {
        logger.error(`Failed to check if folder exists: ${e.message}`);
        return false;
    }
}

/**
 * Zips the specified workspace directory and returns the path to the zipped file.
 * Ensure the outputFilename does not have .zip extension as it's added by make_archive.
 * 
 * @param {string} workspacePath - The path to the workspace directory.
 * @param {string} outputFilename - The name of the output zip file.
 * @returns {Promise<string|null>} - The path to the zipped file or null if an error occurred.
 */
async function zipWorkspace(workspacePath, outputFilename) {
    try {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-'));
        const baseOutputPath = path.join(tempDir, outputFilename.replace(".zip", ""));
        const zipPath = execSync(`zip -r ${baseOutputPath}.zip ${workspacePath}`).toString().trim();
        return zipPath;
    } catch (e) {
        logger.error(`Failed to zip workspace: ${e.message}`);
        return null;
    }
}

/**
 * Cleans and sanitizes the file path to be valid for Windows.
 * 
 * @param {string} filePath - The file path to sanitize.
 * @returns {string|null} - The sanitized file path or null if an error occurred.
 */
function sanitizeFilePath(filePath) {
    try {
        let sanitizedPath = filePath.replace("`", "").trim();
        sanitizedPath = sanitizedPath.replace(/[<>:"/\\|?*]/g, "_");
        return sanitizedPath;
    } catch (e) {
        logger.error(`Failed to sanitize file path: ${e.message}`);
        return null;
    }
}

/**
 * Loads a JSON string and returns the corresponding JavaScript object.
 * 
 * @param {string} jsonString - The JSON string to be loaded.
 * @returns {Object|null} - The JavaScript object representing the JSON data or null if an error occurred.
 */
function loadJson(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        logger.error(`Failed to decode JSON: ${e.message}`);
        return null;
    }
}

/**
 * Creates a file with the specified content at the specified file path.
 * 
 * @param {string} content - The content to be written to the file.
 * @param {string} filePath - The path to the file to be created.
 * @returns {Promise<string|null>} - The path of the created file or null if an error occurred.
 */
async function createFile(content, filePath) {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return filePath;
    } catch (e) {
        logger.error(`Failed to create file: ${e.message}`);
        return null;
    }
}

/**
 * Creates a file in the specified folder with the given file name and content.
 * 
 * @param {string} folderPath - The path of the folder where the file will be created.
 * @param {string} fileName - The name of the file to be created.
 * @param {string} content - The content to be written to the file.
 * @returns {Promise<string|null>} - The path of the created file or null if an error occurred.
 */
async function createFileInFolder(folderPath, fileName, content) {
    try {
        await fs.mkdir(folderPath, { recursive: true });
        const filePath = path.join(folderPath, fileName);
        await fs.writeFile(filePath, content, 'utf8');
        return filePath;
    } catch (e) {
        logger.error(`Failed to create file in folder: ${e.message}`);
        return null;
    }
}

/**
 * Zip two folders into a single zip file.
 * 
 * @param {string} folder1Path - Path to the first folder.
 * @param {string} folder2Path - Path to the second folder.
 * @param {string} zipFilePath - Path to the output zip file.
 * @returns {Promise<string|null>} - The path to the zipped file or null if an error occurred.
 */
async function zipFolders(folder1Path, folder2Path, zipFilePath) {
    try {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-'));
        await fs.cp(folder1Path, path.join(tempDir, path.basename(folder1Path)), { recursive: true });
        await fs.cp(folder2Path, path.join(tempDir, path.basename(folder2Path)), { recursive: true });
        const zipPath = execSync(`zip -r ${zipFilePath}.zip ${tempDir}`).toString().trim();
        return zipPath;
    } catch (e) {
        logger.error(`Failed to zip folders: ${e.message}`);
        return null;
    }
}

export {
    checkIfFolderExists,
    zipWorkspace,
    sanitizeFilePath,
    loadJson,
    createFile,
    createFileInFolder,
    zipFolders
};