import { ArgumentParser } from 'argparse';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { setVerbose } from 'litellm';
import { generateSwarmConfig } from '../agents/auto_generate_swarm_config.mjs';
import { createAgentsFromYaml } from '../agents/create_agents_from_yaml.mjs';
import { OnboardingProcess } from './onboarding_process.mjs';
import { formatter } from '../utils/formatter.mjs';
import { Console } from 'console';
import { ProgressBar, Spinner, Table, Text } from 'some-rich-library'; // Replace with appropriate rich library

const console = new Console(process.stdout, process.stderr);

class SwarmCLIError extends Error {
    constructor(message) {
        super(message);
        this.name = "SwarmCLIError";
    }
}

const COLORS = {
    primary: "red",
    secondary: "#FF6B6B",
    accent: "#4A90E2",
    success: "#2ECC71",
    warning: "#F1C40F",
    error: "#E74C3C",
    text: "#FFFFFF",
};

const ASCII_ART = `
   ▄████████  ▄█     █▄     ▄████████    ▄████████   ▄▄▄▄███▄▄▄▄      ▄████████ 
  ███    ███ ███     ███   ███    ███   ███    ███ ▄██▀▀▀███▀▀▀██▄   ███    ███ 
  ███    █▀  ███     ███   ███    ███   ███    ███ ███   ███   ███   ███    █▀  
  ███        ███     ███   ███    ███  ▄███▄▄▄▄██▀ ███   ███   ███   ███        
▀███████████ ███     ███ ▀███████████ ▀▀███▀▀▀▀▀   ███   ███   ███ ▀███████████ 
         ███ ███     ███   ███    ███ ▀███████████ ███   ███   ███          ███ 
   ▄█    ███ ███ ▄█▄ ███   ███    ███   ███    ███ ███   ███   ███    ▄█    ███ 
 ▄████████▀   ▀███▀███▀    ███    █▀    ███    ███  ▀█   ███   █▀   ▄████████▀  
                                        ███    ███                                 
`;

function createSpinner(text) {
    return new ProgressBar({
        spinner: new Spinner(),
        text: new Text(text, { style: COLORS.text }),
        console
    });
}

function showAsciiArt() {
    console.log(new Text(ASCII_ART, { style: `bold ${COLORS.primary}` }));
}

function createCommandTable() {
    const table = new Table({
        headerStyle: `bold ${COLORS.primary}`,
        borderStyle: COLORS.secondary,
        title: "Available Commands",
        padding: [0, 2]
    });

    table.addColumn("Command", { style: "bold white" });
    table.addColumn("Description", { style: "dim white" });

    const commands = [
        ["onboarding", "Start the interactive onboarding process"],
        ["help", "Display this help message"],
        ["get-api-key", "Retrieve your API key from the platform"],
        ["check-login", "Verify login status and initialize cache"],
        ["run-agents", "Execute agents from your YAML configuration"],
        ["auto-upgrade", "Update Swarms to the latest version"],
        ["book-call", "Schedule a strategy session with our team"],
        ["autoswarm", "Generate and execute an autonomous swarm"],
    ];

    for (const [cmd, desc] of commands) {
        table.addRow(cmd, desc);
    }

    return table;
}

function showHelp() {
    console.log(new Text("\nSwarms CLI - Command Reference\n", { style: COLORS.primary }));
    console.log(createCommandTable());
    console.log(new Text("\nFor detailed documentation, visit: https://docs.swarms.world\n", { style: "dim" }));
}

function showError(message, helpText = null) {
    console.error(new Text(`[bold red]${message}[/bold red]`, { title: "Error", borderStyle: "red" }));
    if (helpText) {
        console.log(new Text(`\n[yellow]ℹ️ ${helpText}[/yellow]`));
    }
}

function executeWithSpinner(action, text) {
    const spinner = createSpinner(text);
    spinner.start();
    const result = action();
    spinner.stop();
    return result;
}

function getApiKey() {
    executeWithSpinner(() => open("https://swarms.world/platform/api-keys"), "Opening API key portal...");
    console.log(new Text(`\n[${COLORS.success}]✓ API key page opened in your browser[/${COLORS.success}]`));
}

function checkLogin() {
    const cacheFile = "cache.txt";

    if (fs.existsSync(cacheFile)) {
        const cacheContent = fs.readFileSync(cacheFile, 'utf8');
        if (cacheContent === "logged_in") {
            console.log(new Text(`[${COLORS.success}]✓ Authentication verified[/${COLORS.success}]`));
            return true;
        }
    }

    executeWithSpinner(() => {
        fs.writeFileSync(cacheFile, "logged_in");
    }, "Authenticating...");

    console.log(new Text(`[${COLORS.success}]✓ Login successful![/${COLORS.success}]`));
    return true;
}

function runAutoswarm(task, model) {
    try {
        console.log(new Text("[yellow]Initializing autoswarm configuration...[/yellow]"));

        setVerbose(true);

        if (!task || task.trim() === "") {
            throw new SwarmCLIError("Task cannot be empty");
        }

        if (!model || model.trim() === "") {
            throw new SwarmCLIError("Model name cannot be empty");
        }

        console.log(new Text(`[yellow]Generating swarm for task: ${task}[/yellow]`));
        const result = generateSwarmConfig({ task, model });

        if (result) {
            console.log(new Text("[green]✓ Swarm configuration generated successfully![/green]"));
        } else {
            throw new SwarmCLIError("Failed to generate swarm configuration");
        }
    } catch (e) {
        if (e.message.includes("No YAML content found")) {
            showError(
                "Failed to generate YAML configuration",
                "This might be due to an API key issue or invalid model configuration.\n"
                + "1. Check if your OpenAI API key is set correctly\n"
                + "2. Verify the model name is valid\n"
                + "3. Try running with --model gpt-4"
            );
        } else {
            showError(
                `Error during autoswarm execution: ${e.message}`,
                "For debugging, try:\n"
                + "1. Check your API keys are set correctly\n"
                + "2. Verify your network connection\n"
                + "3. Try a different model"
            );
        }
    }
}

function main() {
    try {
        showAsciiArt();

        const parser = new ArgumentParser({
            description: "Swarms Cloud CLI"
        });

        parser.add_argument("command", {
            choices: [
                "onboarding",
                "help",
                "get-api-key",
                "check-login",
                "run-agents",
                "auto-upgrade",
                "book-call",
                "autoswarm"
            ],
            help: "Command to execute"
        });

        parser.add_argument("--yaml-file", {
            type: "string",
            default: "agents.yaml",
            help: "YAML configuration file path"
        });

        parser.add_argument("--task", {
            type: "string",
            help: "Task for autoswarm"
        });

        parser.add_argument("--model", {
            type: "string",
            default: "gpt-4",
            help: "Model for autoswarm"
        });

        const args = parser.parse_args();

        try {
            switch (args.command) {
                case "onboarding":
                    new OnboardingProcess().run();
                    break;
                case "help":
                    showHelp();
                    break;
                case "get-api-key":
                    getApiKey();
                    break;
                case "check-login":
                    checkLogin();
                    break;
                case "run-agents":
                    createAgentsFromYaml({ yamlFile: args.yaml_file, returnType: "tasks" });
                    break;
                case "book-call":
                    open("https://cal.com/swarms/swarms-strategy-session");
                    break;
                case "autoswarm":
                    if (!args.task) {
                        showError(
                            "Missing required argument: --task",
                            "Example usage: node cli.mjs autoswarm --task 'analyze this data' --model gpt-4"
                        );
                        process.exit(1);
                    }
                    runAutoswarm(args.task, args.model);
                    break;
                default:
                    showHelp();
            }
        } catch (e) {
            console.error(new Text(`[${COLORS.error}]Error: ${e.message}[/${COLORS.error}]`));
        }
    } catch (error) {
        formatter.printPanel(`Error detected: ${error.message} check your args`);
        throw error;
    }
}

if (import.meta.main) {
    main();
}