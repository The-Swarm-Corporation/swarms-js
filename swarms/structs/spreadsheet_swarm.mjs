import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { Agent } from './agent.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('spreadsheet_swarm');

const time = new Date().toISOString();
const uuidHex = uuidv4();

class AgentConfig {
    constructor({ agentName, description, systemPrompt, task }) {
        this.agentName = agentName;
        this.description = description;
        this.systemPrompt = systemPrompt;
        this.task = task;
    }
}

class AgentOutput {
    constructor({ agentName, task, result, timestamp }) {
        this.agentName = agentName;
        this.task = task;
        this.result = result;
        this.timestamp = timestamp;
    }
}

class SwarmRunMetadata {
    constructor({ runId, name, description, agents, startTime, endTime, tasksCompleted, outputs, numberOfAgents }) {
        this.runId = runId || `spreadsheet_swarm_run_${uuidHex}`;
        this.name = name;
        this.description = description;
        this.agents = agents;
        this.startTime = startTime || time;
        this.endTime = endTime;
        this.tasksCompleted = tasksCompleted;
        this.outputs = outputs;
        this.numberOfAgents = numberOfAgents;
    }
}

export class SpreadSheetSwarm extends BaseSwarm {
    constructor({
        name = "Spreadsheet-Swarm",
        description = "A swarm that processes tasks concurrently using multiple agents and saves the metadata to a CSV file.",
        agents = [],
        autosaveOn = true,
        saveFilePath = null,
        maxLoops = 1,
        workspaceDir = process.env.WORKSPACE_DIR,
        loadPath = null,
        ...args
    } = {}) {
        super({ name, description, agents: Array.isArray(agents) ? agents : [agents], ...args });
        this.name = name;
        this.description = description;
        this.saveFilePath = saveFilePath || `spreadsheet_swarm_run_id_${uuidHex}.csv`;
        this.autosaveOn = autosaveOn;
        this.maxLoops = maxLoops;
        this.workspaceDir = workspaceDir;
        this.loadPath = loadPath;
        this.agentConfigs = {};

        this.metadata = new SwarmRunMetadata({
            name,
            description,
            agents: agents.map(agent => agent.name),
            startTime: time,
            endTime: "",
            tasksCompleted: 0,
            outputs: [],
            numberOfAgents: agents.length
        });

        this.reliabilityCheck();
    }

    reliabilityCheck() {
        logger.info("Checking the reliability of the swarm...");
        if (!this.maxLoops) throw new Error("No max loops are provided.");
        logger.info("Swarm reliability check passed.");
        logger.info("Swarm is ready to run.");
    }

    async _loadFromCsv() {
        try {
            const csvPath = this.loadPath;
            logger.info(`Loading agent configurations from ${csvPath}`);
            const content = await fs.readFile(csvPath, 'utf8');
            const rows = content.split('\n').map(row => row.split(','));

            for (const row of rows.slice(1)) {
                const [agentName, description, systemPrompt, task] = row;
                const config = new AgentConfig({ agentName, description, systemPrompt, task });

                const newAgent = new Agent({
                    agentName: config.agentName,
                    systemPrompt: config.systemPrompt,
                    description: config.description,
                    modelName: "openai/gpt-4o",
                    dynamicTemperatureEnabled: true,
                    maxLoops: 1,
                    userName: "user",
                    stoppingToken: null
                });

                this.agents.push(newAgent);
                this.agentConfigs[config.agentName] = config;
            }

            this.metadata.agents = this.agents.map(agent => agent.name);
            this.metadata.numberOfAgents = this.agents.length;
            logger.info(`Loaded ${Object.keys(this.agentConfigs).length} agent configurations`);
        } catch (error) {
            logger.error(`Error loading agent configurations: ${error.message}`);
        }
    }

    loadFromCsv() {
        return this._loadFromCsv();
    }

    async runFromConfig() {
        logger.info("Running agents from configuration");
        this.metadata.startTime = time;

        const tasks = this.agents.flatMap(agent => {
            const config = this.agentConfigs[agent.agentName];
            return config ? Array(this.maxLoops).fill(() => this._runAgentTask(agent, config.task)) : [];
        });

        const results = await Promise.all(tasks.map(task => task()));

        results.forEach(result => this._trackOutput(...result));
        this.metadata.endTime = new Date().toISOString();

        logger.info("Saving metadata to CSV and JSON...");
        await this._saveMetadata();

        if (this.autosaveOn) {
            this.dataToJsonFile();
        }

        return JSON.stringify(this.metadata, null, 4);
    }

    async _run(task = null, ...args) {
        if (!task && Object.keys(this.agentConfigs).length) {
            return await this.runFromConfig();
        } else {
            this.metadata.startTime = time;
            await this._runTasks(task, ...args);
            this.metadata.endTime = new Date().toISOString();
            await this._saveMetadata();

            if (this.autosaveOn) {
                this.dataToJsonFile();
            }

            return JSON.stringify(this.metadata, null, 4);
        }
    }

    run(task = null, ...args) {
        return this._run(task, ...args).catch(error => {
            logger.error(`Error running swarm: ${error.message}`);
            throw error;
        });
    }

    async _runTasks(task, ...args) {
        const tasks = this.agents.flatMap(agent => Array(this.maxLoops).fill(() => this._runAgentTask(agent, task, ...args)));
        const results = await Promise.all(tasks.map(task => task()));
        results.forEach(result => this._trackOutput(...result));
    }

    async _runAgentTask(agent, task, ...args) {
        try {
            const result = await agent.run(task, ...args);
            return [agent.agentName, task, result];
        } catch (error) {
            logger.error(`Error running task for ${agent.agentName}: ${error.message}`);
            return [agent.agentName, task, error.message];
        }
    }

    _trackOutput(agentName, task, result) {
        this.metadata.tasksCompleted += 1;
        this.metadata.outputs.push(new AgentOutput({ agentName, task, result, timestamp: new Date().toISOString() }));
    }

    exportToJson() {
        return JSON.stringify(this.metadata, null, 4);
    }

    dataToJsonFile() {
        const out = this.exportToJson();
        const folderPath = `${this.workspaceDir}/Spreadsheet-Swarm-${this.name}/${this.name}`;
        const fileName = `spreadsheet-swarm-${uuidHex}-metadata.json`;
        fs.mkdir(folderPath, { recursive: true }).then(() => fs.writeFile(`${folderPath}/${fileName}`, out));
    }

    async _saveMetadata() {
        if (this.autosaveOn) {
            await this._saveToCsv();
        }
    }

    async _saveToCsv() {
        logger.info(`Saving swarm metadata to: ${this.saveFilePath}`);
        const fileExists = await fs.access(this.saveFilePath).then(() => true).catch(() => false);

        const header = ["Run ID", "Agent Name", "Task", "Result", "Timestamp"];
        const rows = this.metadata.outputs.map(output => [uuidHex, output.agentName, output.task, output.result, output.timestamp]);

        const content = [header, ...rows].map(row => row.join(',')).join('\n');
        await fs.writeFile(this.saveFilePath, content, { flag: fileExists ? 'a' : 'w' });
    }
}

// Example usage (commented out):
/*
const agents = [
    new Agent({ agentName: "Agent1", description: "Test agent 1", systemPrompt: "Prompt 1" }),
    new Agent({ agentName: "Agent2", description: "Test agent 2", systemPrompt: "Prompt 2" })
];

const swarm = new SpreadSheetSwarm({ agents, loadPath: "agents.csv" });
swarm.loadFromCsv().then(() => swarm.run());
*/