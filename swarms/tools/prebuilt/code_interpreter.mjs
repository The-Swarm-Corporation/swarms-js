import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/loguru_logger.mjs';

class SubprocessCodeInterpreter extends EventEmitter {
    /**
     * SubprocessCodeInterpreter is a base class for code interpreters that run code in a subprocess.
     * 
     * @param {Object} options - The options for the interpreter.
     * @param {string} [options.startCmd="python3"] - The command to start the subprocess.
     * @param {boolean} [options.debugMode=false] - Whether to print debug statements.
     * @param {number} [options.maxRetries=3] - The maximum number of retries.
     * @param {boolean} [options.verbose=false] - Whether to enable verbose logging.
     * @param {number} [options.retryCount=0] - The initial retry count.
     */
    constructor({ startCmd = "python3", debugMode = false, maxRetries = 3, verbose = false, retryCount = 0 } = {}) {
        super();
        this.process = null;
        this.startCmd = startCmd;
        this.debugMode = debugMode;
        this.maxRetries = maxRetries;
        this.verbose = verbose;
        this.retryCount = retryCount;
        this.outputQueue = [];
        this.done = false;
    }

    detectActiveLine(line) {
        // Detect if the line is an active line
        return null;
    }

    detectEndOfExecution(line) {
        // Detect if the line is an end of execution line
        return null;
    }

    linePostprocessor(line) {
        // Line postprocessor
        return line;
    }

    preprocessCode(code) {
        // This needs to insert an end_of_execution marker of some kind,
        // which can be detected by detectEndOfExecution.
        // Optionally, add active line markers for detectActiveLine.
        return code;
    }

    terminate() {
        // Terminate the subprocess
        if (this.process) {
            this.process.kill();
        }
    }

    startProcess() {
        // Start the subprocess
        if (this.process) {
            this.terminate();
        }

        logger.info(`Starting subprocess with command: ${this.startCmd}`);
        this.process = spawn(this.startCmd, { shell: true });

        this.process.stdout.on('data', (data) => this.handleStreamOutput(data, false));
        this.process.stderr.on('data', (data) => this.handleStreamOutput(data, true));

        return this.process;
    }

    async run(code) {
        // Run the code in the subprocess
        logger.info("Running code in subprocess");
        try {
            code = this.preprocessCode(code);
            if (!this.process) {
                this.startProcess();
            }
        } catch (error) {
            this.emit('output', { output: error.stack });
            return;
        }

        while (this.retryCount <= this.maxRetries) {
            if (this.debugMode) {
                console.log(`Running code:\n${code}\n---`);
            }

            this.done = false;

            try {
                this.process.stdin.write(`${code}\n`);
                break;
            } catch (error) {
                if (this.retryCount !== 0) {
                    this.emit('output', { output: error.stack });
                    this.emit('output', { output: `Retrying... (${this.retryCount}/${this.maxRetries})` });
                    this.emit('output', { output: "Restarting process." });
                }

                this.startProcess();

                this.retryCount += 1;
                if (this.retryCount > this.maxRetries) {
                    this.emit('output', { output: "Maximum retries reached. Could not execute code." });
                    return;
                }
            }
        }

        while (!this.done) {
            if (this.outputQueue.length > 0) {
                this.emit('output', this.outputQueue.shift());
            } else {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        for (let i = 0; i < 3; i++) {
            if (this.outputQueue.length > 0) {
                this.emit('output', this.outputQueue.shift());
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    handleStreamOutput(data, isErrorStream) {
        // Handle the output from the subprocess
        const lines = data.toString().split('\n');
        for (let line of lines) {
            if (this.debugMode) {
                console.log(`Received output line:\n${line}\n---`);
            }

            line = this.linePostprocessor(line);

            if (line === null) {
                continue; // `line = null` is the postprocessor's signal to discard completely
            }

            if (this.detectActiveLine(line)) {
                const activeLine = this.detectActiveLine(line);
                this.outputQueue.push({ active_line: activeLine });
            } else if (this.detectEndOfExecution(line)) {
                this.outputQueue.push({ active_line: null });
                this.done = true;
            } else if (isErrorStream && line.includes("KeyboardInterrupt")) {
                this.outputQueue.push({ output: "KeyboardInterrupt" });
                this.done = true;
            } else {
                this.outputQueue.push({ output: line });
            }
        }
    }
}

// Example usage:
// const interpreter = new SubprocessCodeInterpreter({ startCmd: "python3" });
// interpreter.on('output', (data) => console.log(data));
// interpreter.run(`
// print("hello")
// print("world")
// `);