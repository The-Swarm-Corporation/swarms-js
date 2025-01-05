import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseModel, Field } from 'pydantic';
import { initialize_logger } from '../utils/loguru_logger.mjs';
import { createFileInFolder } from '../utils/file_processing.mjs';

const logger = initialize_logger({ log_folder: "main_artifact" });

class FileVersion extends BaseModel {
    /**
     * Represents a version of the file with its content and timestamp.
     */
    version_number = Field(null, { description: "The version number of the file" });
    content = Field(null, { description: "The content of the file version" });
    timestamp = Field(() => new Date().toISOString(), { description: "The timestamp of the file version" });

    toString() {
        return `Version ${this.version_number} (Timestamp: ${this.timestamp}):\n${this.content}`;
    }
}

class Artifact extends BaseModel {
    /**
     * Represents a file artifact.
     * 
     * @param {Object} options - The options for the artifact.
     * @param {string} options.folder_path - The path to the folder.
     * @param {string} options.file_path - The path to the file.
     * @param {string} options.file_type - The type of the file.
     * @param {string} options.contents - The contents of the file.
     * @param {Array<FileVersion>} [options.versions=[]] - The list of file versions.
     * @param {number} options.edit_count - The number of times the file has been edited.
     */
    constructor({
        folder_path = process.env.WORKSPACE_DIR,
        file_path,
        file_type,
        contents,
        versions = [],
        edit_count = 0
    }) {
        super();
        this.folder_path = folder_path;
        this.file_path = file_path;
        this.file_type = file_type;
        this.contents = contents;
        this.versions = versions;
        this.edit_count = edit_count;
    }

    static validateFileType(v, values) {
        if (!v) {
            const filePath = values.file_path;
            const ext = path.extname(filePath).toLowerCase();
            const supportedTypes = [
                ".py", ".csv", ".tsv", ".txt", ".json", ".xml", ".html", ".yaml", ".yml", ".md", ".rst", ".log", ".sh", ".bat", ".ps1", ".psm1", ".psd1", ".ps1xml", ".pssc", ".reg", ".mof", ".mfl", ".xaml", ".xml", ".wsf", ".config", ".ini", ".inf", ".json5", ".hcl", ".tf", ".tfvars", ".tsv", ".properties"
            ];
            if (!supportedTypes.includes(ext)) {
                throw new Error("Unsupported file type");
            }
            return ext;
        }
        return v;
    }

    create(initialContent) {
        /**
         * Creates a new file artifact with the initial content.
         */
        try {
            this.contents = initialContent;
            this.versions.push(new FileVersion({
                version_number: 1,
                content: initialContent,
                timestamp: new Date().toISOString()
            }));
            this.edit_count = 0;
        } catch (e) {
            logger.error(`Error creating artifact: ${e.message}`);
            throw e;
        }
    }

    edit(newContent) {
        /**
         * Edits the artifact's content, tracking the change in the version history.
         */
        try {
            this.contents = newContent;
            this.edit_count += 1;
            const newVersion = new FileVersion({
                version_number: this.versions.length + 1,
                content: newContent,
                timestamp: new Date().toISOString()
            });
            this.versions.push(newVersion);
        } catch (e) {
            logger.error(`Error editing artifact: ${e.message}`);
            throw e;
        }
    }

    save() {
        /**
         * Saves the current artifact's contents to the specified file path.
         */
        fs.writeFileSync(this.file_path, this.contents);
    }

    load() {
        /**
         * Loads the file contents from the specified file path into the artifact.
         */
        this.contents = fs.readFileSync(this.file_path, 'utf8');
        this.create(this.contents);
    }

    getVersion(versionNumber) {
        /**
         * Retrieves a specific version of the artifact by its version number.
         * 
         * @param {number} versionNumber - The version number to retrieve.
         * @returns {FileVersion|null} - The file version or null if not found.
         */
        return this.versions.find(version => version.version_number === versionNumber) || null;
    }

    getContents() {
        /**
         * Returns the current contents of the artifact as a string.
         * 
         * @returns {string} - The current contents of the artifact.
         */
        return this.contents;
    }

    getVersionHistory() {
        /**
         * Returns the version history of the artifact as a formatted string.
         * 
         * @returns {string} - The version history of the artifact.
         */
        return this.versions.map(version => version.toString()).join("\n\n");
    }

    exportToJson(filePath) {
        /**
         * Exports the artifact to a JSON file.
         * 
         * @param {string} filePath - The path to the JSON file where the artifact will be saved.
         */
        fs.writeFileSync(filePath, JSON.stringify(this, null, 4));
    }

    static importFromJson(filePath) {
        /**
         * Imports an artifact from a JSON file.
         * 
         * @param {string} filePath - The path to the JSON file to import the artifact from.
         * @returns {Artifact} - The imported artifact instance.
         */
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return new Artifact(data);
    }

    getMetrics() {
        /**
         * Returns all metrics of the artifact as a formatted string.
         * 
         * @returns {string} - A string containing all metrics of the artifact.
         */
        return `File Path: ${this.file_path}\nFile Type: ${this.file_type}\nCurrent Contents:\n${this.contents}\n\nEdit Count: ${this.edit_count}\nVersion History:\n${this.getVersionHistory()}`;
    }

    toDict() {
        /**
         * Converts the artifact instance to a dictionary representation.
         * 
         * @returns {Object} - The dictionary representation of the artifact.
         */
        return this;
    }

    static fromDict(data) {
        /**
         * Creates an artifact instance from a dictionary representation.
         * 
         * @param {Object} data - The dictionary representation of the artifact.
         * @returns {Artifact} - The created artifact instance.
         */
        return new Artifact(data);
    }

    saveAs(outputFormat) {
        /**
         * Saves the artifact's contents in the specified format.
         * 
         * @param {string} outputFormat - The desired output format ('.md', '.txt', '.pdf', '.py').
         * @throws {Error} - If the output format is not supported.
         */
        const supportedFormats = [".md", ".txt", ".pdf", ".py"];
        if (!supportedFormats.includes(outputFormat)) {
            throw new Error(`Unsupported output format. Supported formats are: ${supportedFormats.join(', ')}`);
        }

        const outputPath = path.join(path.dirname(this.file_path), `${path.basename(this.file_path, path.extname(this.file_path))}${outputFormat}`);

        if (outputFormat === ".pdf") {
            this._saveAsPdf(outputPath);
        } else {
            if (outputFormat === ".md") {
                createFileInFolder(this.folder_path, this.file_path, `${path.basename(this.file_path)}\n\n${this.contents}`);
            } else if (outputFormat === ".py") {
                createFileInFolder(this.folder_path, this.file_path, `# ${path.basename(this.file_path)}\n\n${this.contents}`);
            } else {
                createFileInFolder(this.folder_path, this.file_path, this.contents);
            }
        }
    }

    async _saveAsPdf(outputPath) {
        /**
         * Helper method to save content as PDF using reportlab.
         * 
         * @param {string} outputPath - The path to save the PDF file.
         */
        try {
            const { PDFDocument, rgb } = require('pdf-lib');
            const fs = require('fs');

            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([600, 750]);
            const { width, height } = page.getSize();
            const fontSize = 12;
            const text = this.contents.split('\n');
            let y = height - fontSize;

            for (const line of text) {
                page.drawText(line, { x: 50, y, size: fontSize });
                y -= fontSize + 2;
                if (y < 50) {
                    page.addPage([600, 750]);
                    y = height - fontSize;
                }
            }

            const pdfBytes = await pdfDoc.save();
            fs.writeFileSync(outputPath, pdfBytes);
        } catch (e) {
            logger.error(`Error saving as PDF: ${e.message}`);
            throw e;
        }
    }
}

// Example usage
// const artifact = new Artifact({ file_path: "example.txt", file_type: ".txt" });
// artifact.create("Initial content");
// artifact.edit("First edit");
// artifact.edit("Second edit");
// artifact.save();

// Export to JSON
// artifact.exportToJson("artifact.json");

// Import from JSON
// const importedArtifact = Artifact.importFromJson("artifact.json");

// Get metrics
// console.log(artifact.getMetrics());

// Testing saving in different artifact types
// Create an artifact
// const artifact = new Artifact({ file_path: "/path/to/file", file_type: ".txt", contents: "", edit_count: 0 });
// artifact.create("This is some content\nWith multiple lines");

// Save in different formats
// artifact.saveAs(".md");    // Creates example.md
// artifact.saveAs(".txt");   // Creates example.txt
// artifact.saveAs(".pdf");   // Creates example.pdf
// artifact.saveAs(".py");    // Creates example.py

export { Artifact, FileVersion };