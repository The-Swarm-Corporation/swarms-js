import fs from 'fs/promises';
import path from 'path';

/**
 * Asynchronously creates a file at the specified path and writes the given content to it.
 * 
 * @param {string} filePath - The path where the file will be created.
 * @param {string} content - The content to be written to the file.
 * @returns {Promise<void>}
 */
async function asyncCreateFile(filePath, content) {
    await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Asynchronously creates multiple files at the specified paths and writes the corresponding content to each file.
 * 
 * @param {Array<string>} filePaths - A list of paths where the files will be created.
 * @param {Array<string>} contents - A list of content to be written to each file, corresponding to the file paths.
 * @returns {Promise<void>}
 */
async function createMultipleFiles(filePaths, contents) {
    const tasks = filePaths.map((filePath, index) => asyncCreateFile(filePath, contents[index]));
    await Promise.all(tasks);
}

/**
 * Creates a file with the specified directory path and content. If the directory does not exist, it is created.
 * 
 * @param {string} filePath - The path of the file to be created, including the directory.
 * @param {string} content - The content to be written to the file.
 * @returns {Promise<void>}
 */
async function createFileWithDirectory(filePath, content) {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    await asyncCreateFile(filePath, content);
}

/**
 * Synchronously creates a file at the specified path and writes the given content to it.
 * 
 * @param {string} filePath - The path where the file will be created.
 * @param {string} content - The content to be written to the file.
 * @returns {void}
 */
function syncCreateFile(filePath, content) {
    (async () => {
        await asyncCreateFile(filePath, content);
    })();
}

/**
 * Synchronously creates multiple files at the specified paths and writes the corresponding content to each file.
 * 
 * @param {Array<string>} filePaths - A list of paths where the files will be created.
 * @param {Array<string>} contents - A list of content to be written to each file, corresponding to the file paths.
 * @returns {void}
 */
function syncCreateMultipleFiles(filePaths, contents) {
    (async () => {
        await createMultipleFiles(filePaths, contents);
    })();
}

/**
 * Synchronously creates a file with the specified directory path and content. If the directory does not exist, it is created.
 * 
 * @param {string} filePath - The path of the file to be created, including the directory.
 * @param {string} content - The content to be written to the file.
 * @returns {void}
 */
function syncCreateFileWithDirectory(filePath, content) {
    (async () => {
        await createFileWithDirectory(filePath, content);
    })();
}

export {
    asyncCreateFile,
    createMultipleFiles,
    createFileWithDirectory,
    syncCreateFile,
    syncCreateMultipleFiles,
    syncCreateFileWithDirectory
};