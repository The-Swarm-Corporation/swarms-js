import fs from 'fs';
import { logger } from '../utils/loguru_logger.mjs';
import { Agent } from './agent.mjs';
import { BaseStructure } from './base_structure.mjs';
import { Task } from './task.mjs';

/**
 * Base class for defining a workflow.
 */
export class BaseWorkflow extends BaseStructure {
    /**
     * @param {Array<Agent>} [agents=null] - A list of agents participating in the workflow
     * @param {Array<Task>} [taskPool=null] - A list of tasks in the workflow
     * @param {Array<any>} [models=null] - A list of models used in the workflow
     * @param {...any} args - Additional arguments
     */
    constructor({
        agents = null,
        taskPool = null,
        models = null,
        ...args
    } = {}) {
        super(args);
        this.agents = agents;
        this.taskPool = taskPool || [];
        this.models = models;
        this.agentPool = [];

        // Logging
        logger.info("Number of agents activated:");
        if (this.agents) {
            logger.info(`Agents: ${this.agents.length}`);
        } else {
            logger.info("No agents activated.");
        }

        if (this.taskPool.length) {
            logger.info(`Task Pool Size: ${this.taskPool.length}`);
        } else {
            logger.info("Task Pool is empty.");
        }
    }

    /**
     * Adds a task or a list of tasks to the task pool.
     * @param {Task} [task=null] - A single task to add
     * @param {Array<Task>} [tasks=null] - A list of tasks to add
     * @throws {Error} If neither task nor tasks are provided
     */
    addTask({
        task = null,
        tasks = null,
        ...args
    } = {}) {
        if (task) {
            this.taskPool.push(task);
        } else if (tasks) {
            this.taskPool.push(...tasks);
        } else {
            throw new Error("You must provide a task or a list of tasks");
        }
    }

    /**
     * Adds an agent to the workflow.
     * @param {Agent} agent - The agent to add
     */
    addAgent(agent, ...args) {
        this.agentPool.push(agent);
    }

    /**
     * Abstract method to run the workflow.
     */
    run() {
        // Implementation here
    }

    /**
     * Abstract method for the sequential loop.
     */
    _sequentialLoop() {
        // Implementation here
    }

    /**
     * Logs a message if verbose mode is enabled.
     * @param {string} message - The message to log
     */
    _log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    toString() {
        return `Workflow with ${this.taskPool.length} tasks`;
    }

    toJSON() {
        return `Workflow with ${this.taskPool.length} tasks`;
    }

    /**
     * Resets the workflow by clearing the results of each task.
     */
    reset() {
        try {
            for (const task of this.taskPool) {
                task.result = null;
            }
        } catch (error) {
            logger.error(`Error resetting workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Returns the results of each task in the workflow.
     * @returns {Object} The results of each task in the workflow
     */
    getTaskResults() {
        try {
            return Object.fromEntries(
                this.taskPool.map(task => [task.description, task.result])
            );
        } catch (error) {
            logger.error(`Error getting task results: ${error.message}`);
            throw error;
        }
    }

    /**
     * Removes a task from the workflow.
     * @param {string} taskDescription - The description of the task to remove
     */
    removeTask(taskDescription) {
        try {
            this.taskPool = this.taskPool.filter(task => task.description !== taskDescription);
        } catch (error) {
            logger.error(`Error removing task from workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates the arguments of a task in the workflow.
     * @param {string} taskDescription - The description of the task to update
     * @param {Object} updates - The updates to apply to the task
     * @throws {Error} If the task is not found in the workflow
     */
    updateTask(taskDescription, updates) {
        try {
            const task = this.taskPool.find(task => task.description === taskDescription);
            if (task) {
                Object.assign(task.kwargs, updates);
            } else {
                throw new Error(`Task ${taskDescription} not found in workflow.`);
            }
        } catch (error) {
            logger.error(`Error updating task in workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deletes a task from the workflow.
     * @param {string} taskDescription - The description of the task to delete
     * @throws {Error} If the task is not found in the workflow
     */
    deleteTask(taskDescription) {
        try {
            const taskIndex = this.taskPool.findIndex(task => task.description === taskDescription);
            if (taskIndex !== -1) {
                this.taskPool.splice(taskIndex, 1);
            } else {
                throw new Error(`Task ${taskDescription} not found in workflow.`);
            }
        } catch (error) {
            logger.error(`Error deleting task from workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Saves the workflow state to a JSON file.
     * @param {string} [filepath="sequential_workflow_state.json"] - The path to save the workflow state to
     */
    saveWorkflowState(filepath = "sequential_workflow_state.json") {
        try {
            const state = {
                tasks: this.taskPool.map(task => ({
                    description: task.description,
                    args: task.args,
                    kwargs: task.kwargs,
                    result: task.result,
                    history: task.history
                })),
                maxLoops: this.maxLoops
            };
            fs.writeFileSync(filepath, JSON.stringify(state, null, 4));
        } catch (error) {
            logger.error(`Error saving workflow state: ${error.message}`);
            throw error;
        }
    }

    /**
     * Adds an objective to the workflow.
     * @param {string} taskDescription - The description of the task
     * @param {Object} kwargs - Additional arguments for the task
     */
    addObjectiveToWorkflow(taskDescription, kwargs) {
        try {
            logger.info("Adding Objective to Workflow...");
            const task = new Task({
                description: taskDescription,
                agent: kwargs.agent,
                args: kwargs.args,
                kwargs: kwargs.kwargs
            });
            this.taskPool.push(task);
        } catch (error) {
            logger.error(`Error adding objective to workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Loads the workflow state from a JSON file and restores the workflow state.
     * @param {string} filepath - The path to load the workflow state from
     */
    loadWorkflowState(filepath) {
        try {
            const state = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            this.maxLoops = state.maxLoops;
            this.taskPool = state.tasks.map(taskState => new Task({
                description: taskState.description,
                agent: taskState.agent,
                args: taskState.args,
                kwargs: taskState.kwargs,
                result: taskState.result,
                history: taskState.history
            }));
        } catch (error) {
            logger.error(`Error loading workflow state: ${error.message}`);
            throw error;
        }
    }

    /**
     * Displays a dashboard for the workflow.
     * @param {Object} kwargs - Additional arguments for the dashboard
     */
    workflowDashboard(kwargs) {
        logger.info(`
            Sequential Workflow Dashboard
            --------------------------------
            Name: ${this.name}
            Description: ${this.description}
            Task Pool: ${this.taskPool.length}
            Max Loops: ${this.maxLoops}
            Autosave: ${this.autosave}
            Autosave Filepath: ${this.savedStateFilepath}
            Restore Filepath: ${this.restoreStateFilepath}
            --------------------------------
            Metadata:
            kwargs: ${JSON.stringify(kwargs)}
        `);
    }

    /**
     * Workflow bootup.
     */
    workflowBootup() {
        logger.info("Sequential Workflow Initializing...");
    }
}

// Example usage:
/*
import { BaseWorkflow } from './base_workflow.mjs';
import { Agent } from './agent.mjs';
import { Task } from './task.mjs';

const workflow = new BaseWorkflow({
    agents: [new Agent({ agentName: "Agent1" })],
    taskPool: [new Task({ description: "Task1" })]
});

// Add a task
workflow.addTask({ task: new Task({ description: "Task2" }) });

// Add an agent
workflow.addAgent(new Agent({ agentName: "Agent2" }));

// Save workflow state
workflow.saveWorkflowState("workflow_state.json");

// Load workflow state
workflow.loadWorkflowState("workflow_state.json");

// Run the workflow
workflow.run();
*/