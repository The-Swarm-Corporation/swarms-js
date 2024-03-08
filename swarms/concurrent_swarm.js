const { Worker } = require('worker_threads');
const winston = require('winston');

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});


/**
 * Represents a concurrent swarm that can perform tasks using multiple worker threads.
 */
class ConcurrentSwarm {
  constructor(maxThreads = 10) {
    this.agents = [];
    this.maxThreads = maxThreads;
  }

  // Add an agent to the swarm
  addAgent(agent) {
    // Check if the agent is a function
    if (typeof agent !== 'function') {
      throw new Error('Agent must be a callable function');
    }

    // Add the agent to the swarm
    this.agents.push(agent);
  }

  // Use the swarm to perform a task
  performTask(task) {
    // Split the agents into groups based on the maximum number of threads
    const agentGroups = [];
    for (let i = 0; i < this.agents.length; i += this.maxThreads) {
      agentGroups.push(this.agents.slice(i, i + this.maxThreads));
    }

    // Execute each group of agents concurrently
    for (let agentGroup of agentGroups) {
      // Create a promise for each agent in the group
      const promises = agentGroup.map(agent => {
        return new Promise((resolve, reject) => {
          // Create a new worker thread for the agent
          const worker = new Worker(agent, { workerData: task });

          // Resolve the promise when the worker sends a message
          worker.on('message', resolve);

          // Reject the promise if the worker encounters an error
          worker.on('error', reject);

          // Clean up the worker when it exits
          worker.on('exit', () => {
            worker.removeAllListeners();
          });
        });
      });

      // Wait for all promises to resolve
      Promise.all(promises)
        .then(results => {
          // Handle the results
          logger.info(`Task '${task}' completed with results: ${JSON.stringify(results)}`);
        })
        .catch(error => {
          // Handle the error
          logger.error(`Task '${task}' encountered an error: ${error.message}`);
        });
    }
  }

  // Static method to create a new swarm
  static create(maxThreads) {
    return new Swarms(maxThreads);
  }
}

module.exports = ConcurrentSwarm;