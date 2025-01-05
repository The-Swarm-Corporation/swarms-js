import { Agent } from './agent.mjs';
import { initializeLogger } from '../utils/loguru_logger.mjs';
import { BaseSwarm } from './base_swarm.mjs';
import { Conversation } from './conversation.mjs';

const logger = initializeLogger('multi_agent_collab');

/**
 * Selects the next speaker in a roundtable manner.
 */
function selectNextSpeakerRoundtable(step, agents) {
    return step % agents.length;
}

/**
 * Selects the next speaker based on the director's decision.
 */
function selectNextSpeakerDirector(step, agents, director) {
    if (step % 2 === 1) {
        return 0;
    } else {
        return director.selectNextSpeaker() + 1;
    }
}

/**
 * Runs the multi-agent collaboration with a director.
 */
function runDirector(task) {
    let n = 0;
    this.reset();
    this.inject("Debate Moderator", task);
    console.log("(Debate Moderator): \n");

    while (n < this.maxLoops) {
        const [name, message] = this.step();
        console.log(`(${name}): ${message}\n`);
        n += 1;
    }
}

/**
 * Multi-agent collaboration class.
 */
export class MultiAgentCollaboration extends BaseSwarm {
    constructor({
        name = "MultiAgentCollaboration",
        description = "A multi-agent collaboration.",
        director = null,
        agents = [],
        selectNextSpeaker = null,
        maxLoops = 10,
        autosave = true,
        savedFilePathName = "multi_agent_collab.json",
        stoppingToken = "<DONE>",
        logging = true,
        ...args
    } = {}) {
        super({ name, description, agents, ...args });
        this.name = name;
        this.description = description;
        this.director = director;
        this.agents = agents;
        this.selectNextSpeaker = selectNextSpeaker || this.defaultSelectNextSpeaker;
        this._step = 0;
        this.maxLoops = maxLoops;
        this.autosave = autosave;
        this.savedFilePathName = savedFilePathName;
        this.stoppingToken = stoppingToken;
        this.results = [];
        this.logger = logger;
        this.logging = logging;

        this.conversation = new Conversation({ timeEnabled: true, ...args });
    }

    defaultSelectNextSpeaker(step, agents) {
        return step % agents.length;
    }

    inject(name, message) {
        for (const agent of this.agents) {
            this.conversation.add(name, message);
            agent.run(this.conversation.returnHistoryAsString());
        }
        this._step += 1;
    }

    step() {
        const speakerIdx = this.selectNextSpeaker(this._step, this.agents);
        const speaker = this.agents[speakerIdx];
        const message = speaker.send();

        for (const receiver of this.agents) {
            this.conversation.add(speaker.name, message);
            receiver.run(this.conversation.returnHistoryAsString());
        }

        this._step += 1;

        if (this.logging) {
            this.logStep(speaker, message);
        }

        return [speaker.name, message];
    }

    logStep(speaker, response) {
        this.logger.info(`${speaker.name}: ${response}`);
    }

    run(task, ...args) {
        for (let i = 0; i < this.maxLoops; i++) {
            const result = this.step();
            if (this.autosave) {
                this.saveState();
            }
            if (result.includes(this.stoppingToken)) {
                break;
            }
        }
        return this.conversation.returnHistoryAsString();
    }

    // Example usage (commented out):
    /*
    import { OpenAIChat } from '../models/openai.mjs';

    const llm = new OpenAIChat({ temperature: 0.5 });

    const agent = new Agent({ llm, maxLoops: 1, dashboard: true });

    const swarm = new MultiAgentCollaboration({
        agents: [agent],
        maxLoops: 4
    });

    swarm.run("Generate a 10,000 word blog on health and wellness.");
    console.log(swarm.formatResults(swarm.results));
    */
}