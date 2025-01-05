import { BaseSwarm } from './base_swarm.mjs';
import { logger } from '../utils/loguru_logger.mjs';

/**
 * AutoSwarmRouter class represents a router for the AutoSwarm class.
 * 
 * This class is responsible for routing tasks to the appropriate swarm based on the provided name.
 * It allows customization of the preprocessing, routing, and postprocessing of tasks.
 */
export class AutoSwarmRouter extends BaseSwarm {
    /**
     * @param {string} name - The name of the router
     * @param {string} description - The description of the router
     * @param {boolean} verbose - Whether to enable verbose mode
     * @param {Object} customParams - Custom parameters for the router
     * @param {Array<BaseSwarm>} swarms - A list of BaseSwarm objects
     * @param {Function} customPreprocess - Custom preprocessing function for tasks
     * @param {Function} customPostprocess - Custom postprocessing function for task results
     * @param {Function} customRouter - Custom routing function for tasks
     */
    constructor({
        name = null,
        description = null,
        verbose = false,
        customParams = null,
        swarms = null,
        customPreprocess = null,
        customPostprocess = null,
        customRouter = null,
        ...args
    } = {}) {
        super({ name, description, ...args });
        
        this.name = name;
        this.description = description;
        this.verbose = verbose;
        this.customParams = customParams;
        this.swarms = swarms || [];
        this.customPreprocess = customPreprocess;
        this.customPostprocess = customPostprocess;
        this.customRouter = customRouter;

        // Create a dictionary of swarms
        this.swarmDict = new Map(
            this.swarms.map(swarm => [swarm.name, swarm])
        );

        logger.info(`AutoSwarmRouter has been initialized with ${this.lenOfSwarms()} swarms.`);
    }

    /**
     * Run the swarm simulation and route the task to the appropriate swarm
     */
    async run(task = null, ...args) {
        try {
            if (this.customPreprocess) {
                logger.info("Running custom preprocess function.");
                [task, ...args] = await this.customPreprocess(task, args);
            }

            if (this.customRouter) {
                logger.info("Running custom router function.");
                let out = await this.customRouter(this, task, ...args);

                if (this.customPostprocess) {
                    out = await this.customPostprocess(out);
                }

                return out;
            }

            if (this.swarmDict.has(this.name)) {
                let out = await this.swarmDict.get(this.name).run(task, ...args);

                if (this.customPostprocess) {
                    out = await this.customPostprocess(out);
                }

                return out;
            }

            throw new Error(`Swarm with name ${this.name} not found.`);
        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        }
    }

    lenOfSwarms() {
        return this.swarms.length;
    }

    listAvailableSwarms() {
        for (const swarm of this.swarms) {
            try {
                logger.info(
                    `Swarm Name: ${swarm.name} || Swarm Description: ${swarm.description}`
                );
            } catch (error) {
                logger.error(
                    `Error Detected You may not have swarms available: ${error.message}`
                );
                throw error;
            }
        }
    }
}

/**
 * AutoSwarm class represents a swarm of agents that can be created automatically.
 */
export class AutoSwarm extends BaseSwarm {
    /**
     * @param {string} name - The name of the swarm
     * @param {string} description - The description of the swarm
     * @param {boolean} verbose - Whether to enable verbose mode
     * @param {Object} customParams - Custom parameters for the swarm
     * @param {Function} customPreprocess - Custom preprocessing function
     * @param {Function} customPostprocess - Custom postprocessing function
     * @param {Function} customRouter - Custom routing function
     * @param {number} maxLoops - Maximum number of loops
     */
    constructor({
        name = null,
        description = null,
        verbose = false,
        customParams = null,
        customPreprocess = null,
        customPostprocess = null,
        customRouter = null,
        maxLoops = 1,
        ...args
    } = {}) {
        super();
        
        if (!name) {
            throw new Error("A name must be provided for the AutoSwarm, what swarm do you want to use?");
        }

        this.name = name;
        this.description = description;
        this.verbose = verbose;
        this.customParams = customParams;
        this.customPreprocess = customPreprocess;
        this.customPostprocess = customPostprocess;
        this.customRouter = customRouter;
        this.maxLoops = maxLoops;
        
        this.router = new AutoSwarmRouter({
            name,
            description,
            verbose,
            customParams,
            customPreprocess,
            customPostprocess,
            customRouter,
            ...args
        });

        if (verbose) {
            this.initLogging();
        }
    }

    initLogging() {
        logger.info("AutoSwarm has been activated. Ready for usage.");
    }

    async run(task = null, ...args) {
        try {
            let loop = 0;

            while (loop < this.maxLoops) {
                if (this.customPreprocess) {
                    logger.info("Running custom preprocess function.");
                    [task, ...args] = await this.customPreprocess(task, args);
                }

                let out;
                if (this.customRouter) {
                    logger.info("Running custom router function.");
                    out = await this.customRouter(this, task, ...args);
                } else {
                    out = await this.router.run(task, ...args);
                }

                if (this.customPostprocess) {
                    out = await this.customPostprocess(out);
                }

                loop++;
                return out;
            }
        } catch (error) {
            logger.error(
                `Error: ${error.message} try optimizing the inputs and try again.`
            );
            throw error;
        }
    }

    listAllSwarms() {
        for (const swarm of this.swarms) {
            try {
                logger.info(
                    `Swarm Name: ${swarm.name} || Swarm Description: ${swarm.description}`
                );
            } catch (error) {
                logger.error(
                    `Error Detected You may not have swarms available: ${error.message}`
                );
                throw error;
            }
        }
    }
}

// Example usage:
/*
import { AutoSwarm } from './auto_swarm.mjs';

const customPreprocess = (task, args) => {
    // Add preprocessing logic
    return [task, ...args];
};

const customPostprocess = (result) => {
    // Add postprocessing logic
    return result;
};

const autoSwarm = new AutoSwarm({
    name: "ExampleSwarm",
    description: "An example swarm implementation",
    verbose: true,
    customPreprocess,
    customPostprocess,
    maxLoops: 3
});

// Run the swarm
const task = "Example task";
const result = await autoSwarm.run(task);
console.log(result);

// List available swarms
autoSwarm.listAllSwarms();
*/