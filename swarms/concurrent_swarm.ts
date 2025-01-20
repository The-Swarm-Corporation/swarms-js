import { Worker } from 'worker_threads';
import winston from 'winston';
import AgentBase from './agent-base';

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
 * Type for worker function that can be executed in a thread
 */
type WorkerFunction = (task: any) => Promise<any>;

/**
 * Interface for agent factory that creates agent instances
 */
interface AgentFactory {
  createAgent(task: any): AgentBase;
}

/**
 * Represents a concurrent swarm that can perform tasks using multiple worker threads.
 */
class ConcurrentSwarm {
  private agents: AgentBase[];
  private maxThreads: number;
  private agentFactory?: AgentFactory;

  constructor(maxThreads: number = 10) {
    this.agents = [];
    this.maxThreads = maxThreads;
  }

  /**
   * Set the agent factory for creating new agent instances
   */
  setAgentFactory(factory: AgentFactory): void {
    this.agentFactory = factory;
  }

  /**
   * Add an agent to the swarm
   */
  addAgent(agent: AgentBase): void {
    if (!(agent instanceof AgentBase)) {
      throw new Error('Agent must be an instance of AgentBase');
    }

    if (!agent.isReliable()) {
      throw new Error('Agent is not reliable');
    }

    this.agents.push(agent);
  }

  /**
   * Create a worker thread for an agent
   */
  private createWorkerThread(agent: AgentBase, task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Convert the agent's execute method to a worker function
      const workerFunction: WorkerFunction = async (workerTask: any) => {
        try {
          return await agent.execute();
        } catch (error) {
          throw error;
        }
      };

      // Create worker code as a string
      const workerCode = `
        const { parentPort, workerData } = require('worker_threads');
        (${workerFunction.toString()})(workerData)
          .then(result => parentPort.postMessage(result))
          .catch(error => parentPort.postMessage({ error: error.message }));
      `;

      // Create a new worker with the code
      const worker = new Worker(workerCode, { 
        eval: true,
        workerData: task 
      });

      worker.on('message', (result) => {
        if (result && result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      });

      worker.on('error', reject);

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
        worker.removeAllListeners();
      });
    });
  }

  /**
   * Use the swarm to perform a task
   */
  async performTask(task: any): Promise<void> {
    try {
      // Create new agent instances if factory is available
      if (this.agentFactory) {
        const newAgent = this.agentFactory.createAgent(task);
        this.addAgent(newAgent);
      }

      // Split the agents into groups based on the maximum number of threads
      const agentGroups: AgentBase[][] = [];
      for (let i = 0; i < this.agents.length; i += this.maxThreads) {
        agentGroups.push(this.agents.slice(i, i + this.maxThreads));
      }

      // Execute each group of agents concurrently
      for (const agentGroup of agentGroups) {
        try {
          // Create a promise for each agent in the group
          const promises = agentGroup.map(agent => 
            this.createWorkerThread(agent, task)
          );

          // Wait for all promises to resolve
          const results = await Promise.all(promises);
          
          logger.info({
            message: 'Task completed',
            task: task,
            results: results
          });
        } catch (error) {
          logger.error({
            message: 'Error in agent group execution',
            task: task,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
      }
    } catch (error) {
      logger.error({
        message: 'Task execution failed',
        task: task,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get the current number of agents in the swarm
   */
  getAgentCount(): number {
    return this.agents.length;
  }

  /**
   * Remove all agents from the swarm
   */
  clearAgents(): void {
    this.agents = [];
  }

  /**
   * Static method to create a new swarm
   */
  static create(maxThreads: number): ConcurrentSwarm {
    return new ConcurrentSwarm(maxThreads);
  }
}

export default ConcurrentSwarm;