import { promises as fs } from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse/sync';
import { parse as jsonParse, stringify as jsonStringify } from 'json5';
import { pdfToText } from './pdf_to_text.mjs';

/**
 * Converts a CSV file to text format.
 * 
 * @param {string} file - The path to the CSV file.
 * @returns {Promise<string>} - The text representation of the CSV file.
 * @throws {Error} - If the file does not exist or there is an error reading the file.
 */
async function csvToText(file) {
    const data = await fs.readFile(file, 'utf8');
    const records = csvParse(data);
    return JSON.stringify(records);
}

/**
 * Converts a JSON file to text format.
 * 
 * @param {string} file - The path to the JSON file.
 * @returns {Promise<string>} - The text representation of the JSON file.
 * @throws {Error} - If the file does not exist or there is an error reading the file.
 */
async function jsonToText(file) {
    const data = await fs.readFile(file, 'utf8');
    const jsonData = jsonParse(data);
    return jsonStringify(jsonData);
}

/**
 * Reads a text file and returns its content as a string.
 * 
 * @param {string} file - The path to the text file.
 * @returns {Promise<string>} - The content of the text file.
 * @throws {Error} - If the file does not exist or there is an error reading the file.
 */
async function txtToText(file) {
    return fs.readFile(file, 'utf8');
}

/**
 * Reads a Markdown file and returns its content as a string.
 * 
 * @param {string} file - The path to the Markdown file.
 * @returns {Promise<string>} - The content of the Markdown file.
 * @throws {Error} - If the file does not exist or there is an error reading the file.
 */
async function mdToText(file) {
    return fs.readFile(file, 'utf8');
}

/**
 * Converts the given data file to text format.
 * 
 * @param {string} file - The path to the data file.
 * @returns {Promise<string>} - The text representation of the data file.
 * @throws {Error} - If the file does not exist or there is an error reading the file.
 * 
 * @example
 * dataToText("data.csv").then(text => console.log(text));
 */
async function dataToText(file) {
    if (!await fs.access(file)) {
        throw new Error(`File not found: ${file}`);
    }
    try {
        const ext = path.extname(file).toLowerCase();
        switch (ext) {
            case '.csv':
                return csvToText(file);
            case '.json':
                return jsonToText(file);
            case '.txt':
                return txtToText(file);
            case '.pdf':
                return pdfToText(file);
            case '.md':
                return mdToText(file);
            default:
                // Check if the file is a binary file (like an image)
                if (['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext)) {
                    // Skip binary files
                    return null;
                } else {
                    return fs.readFile(file, 'utf8');
                }
        }
    } catch (e) {
        throw new Error(`Error reading file: ${file}`, { cause: e });
    }
}

export {
    csvToText,
    jsonToText,
    txtToText,
    mdToText,
    dataToText
};