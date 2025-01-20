import {
    Agent,
    AgentListType,
    ConversationHistory,
    circularSwarm,
    starSwarm,
    meshSwarm,
    oneToOne,
    broadcast,
    getMetrics
  } from '../swarms/swarm_architectures';
  
  // Mock the pino logger to avoid console output during tests
  jest.mock('pino', () => {
    return () => ({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    });
  });
  
  // Helper function to create mock agents
  const createMockAgent = (name: string, delay: number = 0): Agent => ({
    agentName: name,
    run: jest.fn().mockImplementation(async (task: string) => {
      if (delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      return `${name} processed: ${task}`;
    })
  });
  
  describe('Swarm Architecture System', () => {
    // Reset mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    describe('Metrics', () => {
      it('should record and retrieve performance metrics', async () => {
        const agent = createMockAgent('TestAgent');
        await oneToOne(agent, agent, 'test task');
        
        const metrics = getMetrics();
        expect(metrics).toHaveProperty('oneToOne');
        expect(metrics.oneToOne).toHaveProperty('avg');
        expect(metrics.oneToOne).toHaveProperty('min');
        expect(metrics.oneToOne).toHaveProperty('max');
      });
    });
  
    describe('Circular Swarm', () => {
      it('should process tasks with multiple agents', async () => {
        const agents = [
          createMockAgent('Agent1'),
          createMockAgent('Agent2')
        ];
        const tasks = ['task1', 'task2'];
  
        const result = await circularSwarm(agents, tasks) as ConversationHistory;
        
        expect(result.history).toHaveLength(4); // 2 agents * 2 tasks
        expect(result.metrics.totalTasks).toBe(4);
      });
  
      it('should handle nested agent arrays', async () => {
        const agents: AgentListType = [
          [createMockAgent('Agent1')],
          [createMockAgent('Agent2')]
        ];
        const tasks = ['task1'];
  
        const result = await circularSwarm(agents, tasks) as ConversationHistory;
        expect(result.history).toHaveLength(2);
      });
  
      it('should throw error for empty agents or tasks', async () => {
        await expect(circularSwarm([], ['task'])).rejects.toThrow();
        await expect(circularSwarm([createMockAgent('Agent1')], [])).rejects.toThrow();
      });
  
      it('should return only responses when returnFullHistory is false', async () => {
        const agents = [createMockAgent('Agent1')];
        const tasks = ['task1'];
  
        const result = await circularSwarm(agents, tasks, false) as string[];
        expect(Array.isArray(result)).toBeTruthy();
        expect(result).toHaveLength(1);
      });
    });
  
    describe('Star Swarm', () => {
      it('should process tasks through center agent first', async () => {
        const agents = [
          createMockAgent('Center'),
          createMockAgent('Agent1'),
          createMockAgent('Agent2')
        ];
        const tasks = ['task1'];
  
        const result = await starSwarm(agents, tasks) as ConversationHistory;
        
        // Center agent processes first, then other agents process center's response
        expect(result.history[0].agentName).toBe('Center');
        expect(result.history.length).toBe(3);
      });
  
      it('should handle parallel processing of non-center agents', async () => {
        const agents = [
          createMockAgent('Center'),
          createMockAgent('Agent1', 100),
          createMockAgent('Agent2', 50)
        ];
        const tasks = ['task1'];
  
        const result = await starSwarm(agents, tasks) as ConversationHistory;
        expect(result.history).toHaveLength(3);
      });
    });
  
    describe('Mesh Swarm', () => {
      it('should distribute tasks among agents with work stealing', async () => {
        const agents = [
          createMockAgent('Agent1', 50),
          createMockAgent('Agent2', 30)
        ];
        const tasks = ['task1', 'task2', 'task3', 'task4'];
  
        const result = await meshSwarm(agents, tasks) as ConversationHistory;
        expect(result.history.length).toBe(4);
        expect(new Set(result.history.map(h => h.task)).size).toBe(4);
      });
  
      it('should handle task completion tracking', async () => {
        const agents = [createMockAgent('Agent1')];
        const tasks = ['task1', 'task1']; // Duplicate task
  
        const result = await meshSwarm(agents, tasks) as ConversationHistory;
        expect(result.history.length).toBe(1); // Should only process unique tasks
      });
    });
  
    describe('One-to-One Communication', () => {
      it('should handle multiple communication loops', async () => {
        const sender = createMockAgent('Sender');
        const receiver = createMockAgent('Receiver');
        const maxLoops = 3;
  
        const result = await oneToOne(sender, receiver, 'task', maxLoops);
        expect(result.history.length).toBe(maxLoops * 2); // Each loop has sender and receiver
      });
  
      it('should maintain conversation order', async () => {
        const sender = createMockAgent('Sender');
        const receiver = createMockAgent('Receiver');
  
        const result = await oneToOne(sender, receiver, 'task');
        expect(result.history[0].agentName).toBe('Sender');
        expect(result.history[1].agentName).toBe('Receiver');
      });
    });
  
    describe('Broadcast', () => {
      it('should send message from sender to all receivers', async () => {
        const sender = createMockAgent('Sender');
        const receivers = [
          createMockAgent('Receiver1'),
          createMockAgent('Receiver2')
        ];
  
        const result = await broadcast(sender, receivers, 'task');
        expect(result.history.length).toBe(3); // Sender + 2 receivers
        expect(result.history[0].agentName).toBe('Sender');
      });
  
      it('should process receivers in parallel batches', async () => {
        const sender = createMockAgent('Sender');
        const receivers = Array.from({ length: 6 }, (_, i) => 
          createMockAgent(`Receiver${i}`, 50)
        );
  
        const startTime = Date.now();
        await broadcast(sender, receivers, 'task');
        const duration = Date.now() - startTime;
  
        // With batch size 4 and 50ms delay, should take roughly 100ms (2 batches)
        // Adding some buffer for processing overhead
        expect(duration).toBeLessThan(200);
      });
  
      it('should throw error for invalid inputs', async () => {
        const sender = createMockAgent('Sender');
        await expect(broadcast(sender, [], 'task')).rejects.toThrow();
        await expect(broadcast(sender, [createMockAgent('R1')], '')).rejects.toThrow();
      });
    });
  
    describe('Error Handling', () => {
      it('should handle agent failures in circular swarm', async () => {
        const failingAgent = {
          agentName: 'FailingAgent',
          run: jest.fn().mockRejectedValue(new Error('Agent failed'))
        };
  
        await expect(circularSwarm([failingAgent], ['task'])).rejects.toThrow();
      });
  
      it('should handle agent failures in star swarm', async () => {
        const failingAgent = {
          agentName: 'FailingAgent',
          run: jest.fn().mockRejectedValue(new Error('Agent failed'))
        };
  
        await expect(starSwarm([failingAgent], ['task'])).rejects.toThrow();
      });
  
      it('should handle agent failures in mesh swarm', async () => {
        const failingAgent = {
          agentName: 'FailingAgent',
          run: jest.fn().mockRejectedValue(new Error('Agent failed'))
        };
  
        await expect(meshSwarm([failingAgent], ['task'])).rejects.toThrow();
      });
    });
  
    describe('Performance Tests', () => {
      it('should handle large number of tasks efficiently', async () => {
        const agents = Array.from({ length: 5 }, (_, i) => createMockAgent(`Agent${i}`));
        const tasks = Array.from({ length: 100 }, (_, i) => `task${i}`);
  
        const startTime = Date.now();
        const result = await meshSwarm(agents, tasks) as ConversationHistory;
        const duration = Date.now() - startTime;
  
        expect(result.history.length).toBe(100);
        // Assuming reasonable performance on modern hardware
        expect(duration).toBeLessThan(2000);
      });
  
      it('should scale linearly with number of agents', async () => {
        const smallAgentCount = 5;
        const largeAgentCount = 10;
        const tasks = ['task1'];
  
        const smallAgents = Array.from({ length: smallAgentCount }, (_, i) => 
          createMockAgent(`Agent${i}`)
        );
        const largeAgents = Array.from({ length: largeAgentCount }, (_, i) => 
          createMockAgent(`Agent${i}`)
        );
  
        const smallStartTime = Date.now();
        await starSwarm(smallAgents, tasks);
        const smallDuration = Date.now() - smallStartTime;
  
        const largeStartTime = Date.now();
        await starSwarm(largeAgents, tasks);
        const largeDuration = Date.now() - largeStartTime;
  
        // Large agent set should take less than 3x the time of small agent set
        // due to parallel processing
        expect(largeDuration).toBeLessThan(smallDuration * 3);
      });
    });
  });