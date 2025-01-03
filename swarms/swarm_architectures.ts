/**
 * @fileoverview High-performance Swarm Architecture System
 * 
 * This module implements various swarm patterns for distributed agent communication
 * with a focus on performance, type safety, and reliability. It includes advanced
 * logging, memory optimization, and parallel processing capabilities.
 * 
 * @module swarm-architecture
 */

import pino from 'pino';

// Configure high-performance logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Performance monitoring
const metrics = new Map<string, number[]>();

function recordMetric(name: string, duration: number): void {
  const existing = metrics.get(name) ?? [];
  existing.push(duration);
  metrics.set(name, existing);
}

/**
 * Returns performance metrics for all recorded operations
 */
export function getMetrics(): Record<string, { avg: number; min: number; max: number }> {
  const result: Record<string, { avg: number; min: number; max: number }> = {};
  
  metrics.forEach((durations, name) => {
    result[name] = {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  });
  
  return result;
}

/**
 * Represents an agent in the swarm system
 */
export interface Agent {
  /** Unique name identifier for the agent */
  agentName: string;
  /** Async function that processes a task and returns a response */
  run: (task: string) => Promise<string>;
}

/** Supported types for agent collections */
export type AgentListType = Agent[] | Agent[][];

/** Structure for logging agent interactions */
export interface AgentLog {
  agentName: string;
  task: string;
  response: string;
  timestamp: number;
  duration: number;
}

/** Represents the complete conversation history */
export interface ConversationHistory {
  history: AgentLog[];
  metrics: {
    totalDuration: number;
    averageResponseTime: number;
    totalTasks: number;
  };
}

/**
 * High-performance conversation manager using pre-allocated arrays
 * and efficient memory management
 */
class Conversation {
  private readonly logs: AgentLog[];
  private capacity: number;
  private size: number;
  private totalDuration: number = 0;

  constructor(initialCapacity: number = 1000) {
    // Pre-allocate memory for optimal performance
    this.logs = new Array(initialCapacity);
    this.capacity = initialCapacity;
    this.size = 0;
  }

  /**
   * Adds a new log entry with performance metrics
   */
  addLog(agentName: string, task: string, response: string, duration: number): void {
    if (this.size >= this.capacity) {
      this.resize();
    }

    const log: AgentLog = {
      agentName,
      task,
      response,
      timestamp: Date.now(),
      duration
    };

    this.logs[this.size++] = log;
    this.totalDuration += duration;

    logger.info({
      agent: agentName,
      task,
      duration,
      responseLength: response.length
    }, 'Agent response recorded');
  }

  /**
   * Returns the complete conversation history with metrics
   */
  returnHistory(): ConversationHistory {
    const history = this.logs.slice(0, this.size);
    return {
      history,
      metrics: {
        totalDuration: this.totalDuration,
        averageResponseTime: this.totalDuration / this.size,
        totalTasks: this.size
      }
    };
  }

  private resize(): void {
    logger.debug(`Resizing conversation buffer from ${this.capacity} to ${this.capacity * 2}`);
    this.capacity *= 2;
    const newLogs = new Array(this.capacity);
    for (let i = 0; i < this.size; i++) {
      newLogs[i] = this.logs[i];
    }
    this.logs = newLogs;
  }
}

/**
 * Measures the execution time of an async operation
 */
async function measurePerformance<T>(
  operation: () => Promise<T>,
  metricName: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - start;
    recordMetric(metricName, duration);
    return result;
  } catch (error) {
    logger.error({ error, metricName }, 'Operation failed');
    throw error;
  }
}

/**
 * Optimized agent array flattening with type checking
 */
function flattenAgents(agents: AgentListType): Agent[] {
  if (!Array.isArray(agents[0])) {
    return agents as Agent[];
  }
  
  const result: Agent[] = new Array((agents as Agent[][]).reduce((sum, arr) => sum + arr.length, 0));
  let index = 0;
  
  for (const agentGroup of agents as Agent[][]) {
    for (const agent of agentGroup) {
      result[index++] = agent;
    }
  }
  
  return result;
}

/**
 * Implements a circular swarm pattern with parallel task processing
 * and performance optimization
 */
export async function circularSwarm(
  agents: AgentListType,
  tasks: string[],
  returnFullHistory: boolean = true
): Promise<ConversationHistory | string[]> {
  const startTime = performance.now();
  logger.info({ agentCount: flattenAgents(agents).length, taskCount: tasks.length }, 
    'Starting circular swarm');

  return measurePerformance(async () => {
    const flatAgents = flattenAgents(agents);
    
    if (!flatAgents.length || !tasks.length) {
      throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation(tasks.length * flatAgents.length);
    const responses: string[] = [];

    // Process tasks in parallel using a worker pool
    const workerPool = new Array(Math.min(flatAgents.length, 4)).fill(null).map(() => ({}));
    
    await Promise.all(workerPool.map(async () => {
      while (tasks.length > 0) {
        const task = tasks.shift();
        if (!task) break;

        await Promise.all(flatAgents.map(async (agent) => {
          const start = performance.now();
          const response = await agent.run(task);
          const duration = performance.now() - start;

          conversation.addLog(agent.agentName, task, response, duration);
          responses.push(response);
        }));
      }
    }));

    logger.info({ 
      duration: performance.now() - startTime,
      responsesCount: responses.length
    }, 'Circular swarm completed');

    return returnFullHistory ? conversation.returnHistory() : responses;
  }, 'circularSwarm');
}

/**
 * Implements high-performance star swarm pattern with a central agent
 */
export async function starSwarm(
  agents: AgentListType,
  tasks: string[],
  returnFullHistory: boolean = true
): Promise<ConversationHistory | string[]> {
  return measurePerformance(async () => {
    const flatAgents = flattenAgents(agents);
    
    if (!flatAgents.length || !tasks.length) {
      throw new Error("Agents and tasks lists cannot be empty.");
    }

    const conversation = new Conversation(tasks.length * flatAgents.length);
    const responses: string[] = [];
    const [centerAgent, ...otherAgents] = flatAgents;

    logger.info({ 
      centerAgent: centerAgent.agentName,
      otherAgentsCount: otherAgents.length 
    }, 'Starting star swarm');

    // Process all tasks through the center agent first
    for (const task of tasks) {
      const start = performance.now();
      const centerResponse = await centerAgent.run(task);
      const duration = performance.now() - start;
      
      conversation.addLog(centerAgent.agentName, task, centerResponse, duration);
      responses.push(centerResponse);

      // Process other agents in parallel batches for optimal performance
      const batchSize = 4;
      for (let i = 0; i < otherAgents.length; i += batchSize) {
        const batch = otherAgents.slice(i, i + batchSize);
        await Promise.all(batch.map(async (agent) => {
          const start = performance.now();
          const response = await agent.run(centerResponse);
          const duration = performance.now() - start;
          
          conversation.addLog(agent.agentName, task, response, duration);
          responses.push(response);
        }));
      }
    }

    return returnFullHistory ? conversation.returnHistory() : responses;
  }, 'starSwarm');
}

/**
 * Implements a mesh swarm pattern with work stealing and load balancing
 */
export async function meshSwarm(
  agents: AgentListType,
  tasks: string[],
  returnFullHistory: boolean = true
): Promise<ConversationHistory | string[]> {
  return measurePerformance(async () => {
    const flatAgents = flattenAgents(agents);
    
    if (!flatAgents.length || !tasks.length) {
      throw new Error("Agents and tasks lists cannot be empty.");
    }

    logger.info({ 
      agentsCount: flatAgents.length,
      tasksCount: tasks.length 
    }, 'Starting mesh swarm');

    const conversation = new Conversation(tasks.length * flatAgents.length);
    const responses: string[] = [];
    const taskQueue = [...tasks];
    const completedTasks = new Set<string>();

    // Implement work stealing for better load balancing
    const stealWork = () => {
      const victim = Math.floor(Math.random() * flatAgents.length);
      return taskQueue.splice(victim, Math.ceil(taskQueue.length * 0.1));
    };

    const processTask = async (agent: Agent, taskId: number): Promise<void> => {
      while (taskQueue.length > 0) {
        const task = taskQueue.pop();
        if (!task) {
          const stolenTasks = stealWork();
          if (stolenTasks.length === 0) break;
          taskQueue.push(...stolenTasks);
          continue;
        }

        if (completedTasks.has(task)) continue;
        completedTasks.add(task);

        const start = performance.now();
        const response = await agent.run(task);
        const duration = performance.now() - start;

        conversation.addLog(agent.agentName, task, response, duration);
        responses.push(response);

        logger.debug({ 
          agent: agent.agentName,
          taskId,
          remainingTasks: taskQueue.length 
        }, 'Task completed');
      }
    };

    // Create worker pool for parallel processing
    const workerPromises = flatAgents.map((agent, index) => 
      processTask(agent, index)
    );

    await Promise.all(workerPromises);

    return returnFullHistory ? conversation.returnHistory() : responses;
  }, 'meshSwarm');
}

/**
 * Implements one-to-one communication pattern with performance monitoring
 */
export async function oneToOne(
  sender: Agent,
  receiver: Agent,
  task: string,
  maxLoops: number = 1
): Promise<ConversationHistory> {
  return measurePerformance(async () => {
    const conversation = new Conversation(maxLoops * 2);

    logger.info({ 
      sender: sender.agentName,
      receiver: receiver.agentName,
      maxLoops 
    }, 'Starting one-to-one communication');

    try {
      for (let i = 0; i < maxLoops; i++) {
        const senderStart = performance.now();
        const senderResponse = await sender.run(task);
        const senderDuration = performance.now() - senderStart;
        
        conversation.addLog(sender.agentName, task, senderResponse, senderDuration);

        const receiverStart = performance.now();
        const receiverResponse = await receiver.run(senderResponse);
        const receiverDuration = performance.now() - receiverStart;
        
        conversation.addLog(receiver.agentName, task, receiverResponse, receiverDuration);

        logger.debug({ loop: i + 1, maxLoops }, 'Communication loop completed');
      }
    } catch (error) {
      logger.error({ error }, 'One-to-one communication failed');
      throw error;
    }

    return conversation.returnHistory();
  }, 'oneToOne');
}

/**
 * Implements broadcast pattern with parallel processing and performance monitoring
 */
export async function broadcast(
  sender: Agent,
  agents: AgentListType,
  task: string
): Promise<ConversationHistory> {
  return measurePerformance(async () => {
    const flatAgents = flattenAgents(agents);
    
    if (!sender || !flatAgents.length || !task) {
      throw new Error("Sender, agents, and task cannot be empty.");
    }

    const conversation = new Conversation(flatAgents.length + 1);

    logger.info({ 
      sender: sender.agentName,
      receiversCount: flatAgents.length 
    }, 'Starting broadcast');

    try {
      // Get sender's broadcast message
      const senderStart = performance.now();
      const broadcastMessage = await sender.run(task);
      const senderDuration = performance.now() - senderStart;
      
      conversation.addLog(sender.agentName, task, broadcastMessage, senderDuration);

      // Process receivers in parallel batches for optimal performance
      const batchSize = 4;
      for (let i = 0; i < flatAgents.length; i += batchSize) {
        const batch = flatAgents.slice(i, i + batchSize);
        await Promise.all(batch.map(async (agent) => {
          const start = performance.now();
          const response = await agent.run(broadcastMessage);
          const duration = performance.now() - start;
          
          conversation.addLog(agent.agentName, broadcastMessage, response, duration);
        }));

        logger.debug({ 
          completedAgents: Math.min(i + batchSize, flatAgents.length),
          totalAgents: flatAgents.length 
        }, 'Broadcast batch completed');
      }

      return conversation.returnHistory();
    } catch (error) {
      logger.error({ error }, 'Broadcast failed');
      throw error;
    }
  }, 'broadcast');
}

// Export types for external use
export type { ConversationHistory, AgentLog };
