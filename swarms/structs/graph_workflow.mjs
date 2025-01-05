import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as nx from 'networkx';

const logger = initializeLogger('graph_workflow');

/**
 * Enum for node types
 */
export const NodeType = {
    AGENT: 'agent',
    TASK: 'task'
};

/**
 * Represents a node in a graph workflow.
 */
export class Node {
    /**
     * @param {string} id - The unique identifier of the node
     * @param {string} type - The type of the node
     * @param {Function} [callable=null] - The callable associated with the node (required for task nodes)
     * @param {Agent} [agent=null] - The agent associated with the node
     */
    constructor({ id, type, callable = null, agent = null }) {
        this.id = id;
        this.type = type;
        this.callable = callable;
        this.agent = agent;

        if (this.type === NodeType.TASK && !this.callable) {
            throw new Error('Task nodes must have a callable.');
        }
    }
}

/**
 * Represents an edge in a graph workflow.
 */
export class Edge {
    /**
     * @param {string} source - The source node ID
     * @param {string} target - The target node ID
     */
    constructor({ source, target }) {
        this.source = source;
        this.target = target;
    }
}

/**
 * Represents a workflow graph.
 */
export class GraphWorkflow {
    /**
     * @param {Array<Node>} [nodes=[]] - A list of nodes in the graph
     * @param {Array<Edge>} [edges=[]] - A list of edges in the graph
     * @param {Array<string>} [entryPoints=[]] - A list of node IDs that serve as entry points to the graph
     * @param {Array<string>} [endPoints=[]] - A list of node IDs that serve as end points of the graph
     * @param {number} [maxLoops=1] - Maximum number of execution loops
     */
    constructor({
        nodes = [],
        edges = [],
        entryPoints = [],
        endPoints = [],
        maxLoops = 1
    } = {}) {
        this.nodes = new Map(nodes.map(node => [node.id, node]));
        this.edges = edges;
        this.entryPoints = entryPoints;
        this.endPoints = endPoints;
        this.graph = new nx.DiGraph();
        this.maxLoops = maxLoops;

        this._initializeGraph();
    }

    _initializeGraph() {
        for (const node of this.nodes.values()) {
            this.graph.addNode(node.id, {
                type: node.type,
                callable: node.callable,
                agent: node.agent
            });
        }

        for (const edge of this.edges) {
            this.graph.addEdge(edge.source, edge.target);
        }
    }

    /**
     * Adds a node to the workflow graph.
     * @param {Node} node - The node object to be added
     * @throws {Error} If a node with the same ID already exists in the graph
     */
    addNode(node) {
        if (this.nodes.has(node.id)) {
            throw new Error(`Node with id ${node.id} already exists.`);
        }
        this.nodes.set(node.id, node);
        this.graph.addNode(node.id, {
            type: node.type,
            callable: node.callable,
            agent: node.agent
        });
    }

    /**
     * Adds an edge to the workflow graph.
     * @param {Edge} edge - The edge object to be added
     * @throws {Error} If either the source or target node of the edge does not exist in the graph
     */
    addEdge(edge) {
        if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
            throw new Error('Both source and target nodes must exist before adding an edge.');
        }
        this.edges.push(edge);
        this.graph.addEdge(edge.source, edge.target);
    }

    /**
     * Sets the entry points of the workflow graph.
     * @param {Array<string>} entryPoints - A list of node IDs to be set as entry points
     * @throws {Error} If any of the specified node IDs do not exist in the graph
     */
    setEntryPoints(entryPoints) {
        for (const nodeId of entryPoints) {
            if (!this.nodes.has(nodeId)) {
                throw new Error(`Node with id ${nodeId} does not exist.`);
            }
        }
        this.entryPoints = entryPoints;
    }

    /**
     * Sets the end points of the workflow graph.
     * @param {Array<string>} endPoints - A list of node IDs to be set as end points
     * @throws {Error} If any of the specified node IDs do not exist in the graph
     */
    setEndPoints(endPoints) {
        for (const nodeId of endPoints) {
            if (!this.nodes.has(nodeId)) {
                throw new Error(`Node with id ${nodeId} does not exist.`);
            }
        }
        this.endPoints = endPoints;
    }

    /**
     * Generates a string representation of the workflow graph in the Mermaid syntax.
     * @returns {string} The Mermaid string representation of the workflow graph
     */
    visualize() {
        let mermaidStr = 'graph TD\n';
        for (const [nodeId] of this.nodes) {
            mermaidStr += `    ${nodeId}[${nodeId}]\n`;
        }
        for (const edge of this.edges) {
            mermaidStr += `    ${edge.source} --> ${edge.target}\n`;
        }
        return mermaidStr;
    }

    /**
     * Function to run the workflow graph.
     * @param {string} [task=null] - The task to be executed by the workflow
     * @param {...any} args - Additional arguments
     * @returns {Object} A dictionary containing the results of the execution
     * @throws {Error} If no entry points or end points are defined in the graph
     */
    async run(task = null, ...args) {
        if (!this.entryPoints.length) {
            throw new Error('At least one entry point must be defined.');
        }
        if (!this.endPoints.length) {
            throw new Error('At least one end point must be defined.');
        }

        const sortedNodes = nx.topologicalSort(this.graph);
        const executionResults = {};

        for (const nodeId of sortedNodes) {
            const node = this.nodes.get(nodeId);
            let result;
            if (node.type === NodeType.TASK) {
                logger.info(`Executing task: ${nodeId}`);
                result = await node.callable();
            } else if (node.type === NodeType.AGENT) {
                logger.info(`Executing agent: ${nodeId}`);
                result = await node.agent.run(task, ...args);
            }
            executionResults[nodeId] = result;
        }

        return executionResults;
    }
}

// Example usage (commented out):
/*
import { OpenAIChat } from '../models/openai.mjs';
import { config } from 'dotenv';

config();
const apiKey = process.env.OPENAI_API_KEY;

const llm = new OpenAIChat({
    temperature: 0.5,
    openaiApiKey: apiKey,
    maxTokens: 4000
});
const agent1 = new Agent({ llm, maxLoops: 1, autosave: true, dashboard: true });
const agent2 = new Agent({ llm, maxLoops: 1, autosave: true, dashboard: true });

const sampleTask = async () => {
    logger.info('Running sample task');
    return 'Task completed';
};

const wfGraph = new GraphWorkflow();
wfGraph.addNode(new Node({ id: 'agent1', type: NodeType.AGENT, agent: agent1 }));
wfGraph.addNode(new Node({ id: 'agent2', type: NodeType.AGENT, agent: agent2 }));
wfGraph.addNode(new Node({ id: 'task1', type: NodeType.TASK, callable: sampleTask }));
wfGraph.addEdge(new Edge({ source: 'agent1', target: 'task1' }));
wfGraph.addEdge(new Edge({ source: 'agent2', target: 'task1' }));

wfGraph.setEntryPoints(['agent1', 'agent2']);
wfGraph.setEndPoints(['task1']);

logger.info(wfGraph.visualize());

// Run the workflow
const results = await wfGraph.run();
logger.info('Execution results:', results);
*/