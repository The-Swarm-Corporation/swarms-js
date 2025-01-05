import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent.mjs';
import { Conversation } from './conversation.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';

const logger = initializeLogger('task');

/**
 * Task class for running a task in a sequential workflow.
 */
export class Task {
    /**
     * @param {Object} params - Task parameters
     * @param {string} [params.name="Task"] - Name of the task
     * @param {string} [params.description="A task is a unit of work that needs to be completed for a workflow to progress."] - Description of the task
     * @param {Agent|Function} [params.agent=null] - Agent or callable object to run the task
     * @param {Array} [params.args=[]] - Arguments to pass to the agent or callable object
     * @param {Object} [params.kwargs={}] - Keyword arguments to pass to the agent or callable object
     * @param {Date} [params.scheduleTime=null] - Time to schedule the task
     * @param {Function} [params.trigger=null] - Trigger to run the task
     * @param {Function} [params.action=null] - Action to run the task
     * @param {Function} [params.condition=null] - Condition to run the task
     * @param {number} [params.priority=0.4] - Priority of the task
     * @param {Array<Task>} [params.dependencies=[]] - List of tasks that need to be completed before this task can be executed
     */
    constructor({
        name = "Task",
        description = "A task is a unit of work that needs to be completed for a workflow to progress.",
        agent = null,
        args = [],
        kwargs = {},
        scheduleTime = null,
        trigger = null,
        action = null,
        condition = null,
        priority = 0.4,
        dependencies = []
    } = {}) {
        this.name = name;
        this.description = description;
        this.agent = agent;
        this.args = args;
        this.kwargs = kwargs;
        this.scheduleTime = scheduleTime;
        this.trigger = trigger;
        this.action = action;
        this.condition = condition;
        this.priority = priority;
        this.dependencies = dependencies;
        this.result = null;
        this.history = [];
    }

    /**
     * Execute the task by calling the agent or model with the arguments and keyword arguments.
     */
    async step(task = null, ...args) {
        logger.info(`Running task: ${task}`);

        if (!this.checkDependencyCompletion()) {
            logger.info(`Task ${this.description} is waiting for dependencies to complete`);
            return null;
        }

        if (this.condition && !this.condition()) {
            logger.info(`Condition not met for the task: ${task}. Skipping execution.`);
            return null;
        }

        if (!this.trigger || this.trigger()) {
            try {
                logger.info(`Executing task: ${task}`);
                this.result = await this.agent.run(task, ...args);

                if (typeof this.result === 'string' || typeof this.result === 'object') {
                    logger.info(`Task result: ${JSON.stringify(this.result)}`);
                } else {
                    logger.error("Task result must be either a string or an object");
                }

                this.history.push(this.result);

                if (this.action) {
                    logger.info(`Executing action for task: ${task}`);
                    this.action();
                }
            } catch (error) {
                logger.error(`[ERROR][Task] ${error.message}`);
            }
        } else {
            logger.info(`Task ${task} is not triggered`);
        }
    }

    /**
     * Run the task immediately or schedule it for later execution.
     */
    async run(task = null, ...args) {
        const now = new Date();

        if (this.scheduleTime && this.scheduleTime > now) {
            const delay = (this.scheduleTime - now) / 1000;
            logger.info(`Scheduling task: ${this.description} for ${this.scheduleTime}`);
            setTimeout(() => this.step(task, ...args), delay * 1000);
        } else {
            return this.step(task, ...args);
        }
    }

    /**
     * Check whether all dependencies have been completed.
     */
    checkDependencyCompletion() {
        logger.info("[INFO][Task] Checking dependency completion");
        return this.dependencies.every(task => task.isCompleted());
    }

    /**
     * Check whether the task has been completed.
     */
    isCompleted() {
        return this.result !== null;
    }

    /**
     * Add a task to the list of dependencies.
     */
    addDependency(task) {
        this.dependencies.push(task);
    }

    /**
     * Set the priority of the task.
     */
    setPriority(priority) {
        this.priority = priority;
    }

    /**
     * Set the context for the task.
     */
    context(task = null, context = [], ...args) {
        const newContext = new Conversation({ timeEnabled: true, ...args });

        if (context.length) {
            context.forEach(task => {
                const description = task.description || "";
                const result = task.result || "";
                newContext.add(task.agent.agentName, `${description} ${result}`);
            });
        } else if (task) {
            const description = task.description || "";
            const result = task.result || "";
            newContext.add(task.agent.agentName, `${description} ${result}`);
        }

        const prompt = newContext.returnHistoryAsString();
        this.history.push(prompt);
    }

    /**
     * Convert the task to a dictionary.
     */
    toDict() {
        return {
            name: this.name,
            description: this.description,
            agent: this.agent,
            args: this.args,
            kwargs: this.kwargs,
            scheduleTime: this.scheduleTime,
            trigger: this.trigger,
            action: this.action,
            condition: this.condition,
            priority: this.priority,
            dependencies: this.dependencies,
            result: this.result,
            history: this.history
        };
    }

    /**
     * Save the task to a file.
     */
    saveToFile(filePath) {
        const fs = require('fs');
        fs.writeFileSync(filePath, JSON.stringify(this.toDict(), null, 4));
    }

    /**
     * Load a task from a file.
     */
    static loadFromFile(filePath) {
        const fs = require('fs');
        const taskDict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return new Task(taskDict);
    }
}

// Example usage (commented out):
/*
import { Agent } from './agent.mjs';

const agent = new Agent({
    agentName: "TestAgent",
    description: "A test agent"
});

const task = new Task({
    description: "What's the weather in Miami?",
    agent: agent
});

task.run().then(() => {
    console.log(task.result);
});
*/