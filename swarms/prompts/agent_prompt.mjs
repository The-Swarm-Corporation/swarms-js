// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import { stringify } from 'json-stable-stringify';

export class PromptGenerator {
    /**
     * A class for generating custom prompt strings.
     */
    constructor() {
        /**
         * Initialize the PromptGenerator object.
         */
        this.constraints = [];
        this.commands = [];
        this.resources = [];
        this.performanceEvaluation = [];
        this.responseFormat = {
            thoughts: {
                text: "thought",
                reasoning: "reasoning",
                plan: "- short bulleted\n- list that conveys\n- long-term plan",
                criticism: "constructive self-criticism",
                speak: "thoughts summary to say to user",
            },
            command: {
                name: "command name",
                args: { "arg name": "value" },
            },
        };
    }

    /**
     * Add a constraint to the constraints list.
     * @param {string} constraint - The constraint to be added.
     */
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    /**
     * Add a command to the commands list.
     * @param {string} command - The command to be added.
     */
    addCommand(command) {
        this.commands.push(command);
    }

    /**
     * Add a resource to the resources list.
     * @param {string} resource - The resource to be added.
     */
    addResource(resource) {
        this.resources.push(resource);
    }

    /**
     * Add a performance evaluation item to the performanceEvaluation list.
     * @param {string} evaluation - The evaluation item to be added.
     */
    addPerformanceEvaluation(evaluation) {
        this.performanceEvaluation.push(evaluation);
    }

    /**
     * Generate a prompt string.
     * @returns {string} - The generated prompt string.
     */
    generatePromptString() {
        const formattedResponseFormat = JSON.stringify(this.responseFormat, null, 4);
        const promptString = `
        Constraints:
        ${this.constraints.join("\n")}

        Commands:
        ${this.commands.join("\n")}

        Resources:
        ${this.resources.join("\n")}

        Performance Evaluation:
        ${this.performanceEvaluation.join("\n")}

        You should only respond in JSON format as described below.

        Response Format:
        ${formattedResponseFormat}

        Ensure the response can be parsed by JSON.parse.
        `;
        
        return promptString.trim();
    }
}
