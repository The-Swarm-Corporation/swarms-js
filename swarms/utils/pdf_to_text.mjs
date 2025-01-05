import { tryExceptWrapper } from './try_except_wrapper.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
import pdf from 'pdf-parse';

try {
    pdf = require('pdf-parse');
} catch (e) {
    execSync('npm install pdf-parse', { stdio: 'inherit' });
    pdf = require('pdf-parse');
}

/**
 * Converts a PDF file to a string of text.
 * 
 * @param {string} pdfPath - The path to the PDF file to be converted.
 * @returns {Promise<string>} - The text extracted from the PDF.
 * @throws {Error} - If the PDF file is not found or there is an error in reading the PDF file.
 */
async function pdfToText(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (e) {
        if (e.code === 'ENOENT') {
            throw new Error(`The file at ${pdfPath} was not found.`);
        } else {
            throw new Error(`An error occurred while reading the PDF file: ${e.message}`);
        }
    }
}

// Example usage:
// pdfToText("test.pdf").then(text => console.log(text)).catch(err => console.error(err));

export { pdfToText };