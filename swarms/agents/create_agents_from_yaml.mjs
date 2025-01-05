import fs from 'fs';
import yaml from 'js-yaml';
import retry from 'async-retry';
import { BaseModel, Field } from 'pydantic';
import { initialize_logger } from '../utils/loguru_logger.mjs';
import { Agent } from '../structs/agent.mjs';
import { SwarmRouter } from '../structs/swarm_router.mjs';
import { LiteLLM } from '../utils/litellm_wrapper.mjs';

const logger = initialize_logger({ log_folder: "create_agents_from_yaml" });

class AgentConfig extends BaseModel {
    agent_name = Field(null);
    system_prompt = Field(null);
    model_name = Field(null, { default: null });
    max_loops = Field(1, { ge: 1 });
    autosave = Field(true);
    dashboard = Field(false);
    verbose = Field(false);
    dynamic_temperature_enabled = Field(false);
    saved_state_path = Field(null, { default: null });
    user_name = Field("default_user");
    retry_attempts = Field(3, { ge: 1 });
    context_length = Field(100000, { ge: 1000 });
    return_step_meta = Field(false);
    output_type = Field("str");
    auto_generate_prompt = Field(false);
    artifacts_on = Field(false);
    artifacts_file_extension = Field(".md");
    artifacts_output_path = Field("");
}

class SwarmConfig extends BaseModel {
    name = Field(null);
    description = Field(null);
    max_loops = Field(1, { ge: 1 });
    swarm_type = Field(null);
    task = Field(null, { default: null });
    flow = Field(null, { default: null });
    autosave = Field(true);
    return_json = Field(false);
    rules = Field("");
}

class YAMLConfig extends BaseModel {
    agents = Field([], { min_length: 1 });
    swarm_architecture = Field(null, { default: null });

    static model_config = {
        extra: "forbid"
    };
}

/**
 * Safely load and validate YAML configuration using Pydantic.
 * 
 * @param {string} [yamlFile=null] - Path to the YAML file.
 * @param {string} [yamlString=null] - YAML content as a string.
 * @returns {Object} - Parsed and validated YAML content.
 * @throws {Error} - If there is an error parsing or validating the YAML content.
 */
function loadYamlSafely(yamlFile = null, yamlString = null) {
    try {
        let configDict;
        if (yamlString) {
            configDict = yaml.load(yamlString);
        } else if (yamlFile) {
            if (!fs.existsSync(yamlFile)) {
                throw new Error(`YAML file ${yamlFile} not found.`);
            }
            configDict = yaml.load(fs.readFileSync(yamlFile, 'utf8'));
        } else {
            throw new Error("Either yamlFile or yamlString must be provided");
        }

        YAMLConfig.model_validate(configDict);
        return configDict;
    } catch (e) {
        throw new Error(`Error parsing or validating YAML: ${e.message}`);
    }
}

/**
 * Create an agent with retry logic for handling transient failures.
 * 
 * @param {Object} agentConfig - Configuration for the agent.
 * @param {LiteLLM} model - The model to be used by the agent.
 * @returns {Agent} - The created agent.
 * @throws {Error} - If there is an error creating the agent.
 */
async function createAgentWithRetry(agentConfig, model) {
    return retry(async () => {
        try {
            const validatedConfig = new AgentConfig(agentConfig);
            const agent = new Agent({
                agent_name: validatedConfig.agent_name,
                system_prompt: validatedConfig.system_prompt,
                llm: model,
                max_loops: validatedConfig.max_loops,
                autosave: validatedConfig.autosave,
                dashboard: validatedConfig.dashboard,
                verbose: validatedConfig.verbose,
                dynamic_temperature_enabled: validatedConfig.dynamic_temperature_enabled,
                saved_state_path: validatedConfig.saved_state_path,
                user_name: validatedConfig.user_name,
                retry_attempts: validatedConfig.retry_attempts,
                context_length: validatedConfig.context_length,
                return_step_meta: validatedConfig.return_step_meta,
                output_type: validatedConfig.output_type,
                auto_generate_prompt: validatedConfig.auto_generate_prompt,
                artifacts_on: validatedConfig.artifacts_on,
                artifacts_file_extension: validatedConfig.artifacts_file_extension,
                artifacts_output_path: validatedConfig.artifacts_output_path,
            });
            return agent;
        } catch (e) {
            logger.error(`Error creating agent ${agentConfig.agent_name || 'unknown'}: ${e.message}`);
            throw e;
        }
    }, {
        retries: 3,
        minTimeout: 4000,
        maxTimeout: 10000
    });
}

/**
 * Create agents and/or SwarmRouter based on configurations defined in a YAML file or string.
 * 
 * @param {Function} [model=null] - The model to be used by the agents.
 * @param {string} [yamlFile="agents.yaml"] - Path to the YAML file.
 * @param {string} [yamlString=null] - YAML content as a string.
 * @param {string} [returnType="auto"] - The type of return value.
 * @returns {Promise<any>} - The created agents and/or SwarmRouter.
 * @throws {Error} - If there is an error creating the agents or SwarmRouter.
 */
async function createAgentsFromYaml({ model = null, yamlFile = "agents.yaml", yamlString = null, returnType = "auto" } = {}) {
    const agents = [];
    let swarmRouter = null;

    try {
        const config = loadYamlSafely(yamlFile, yamlString);

        for (const agentConfig of config.agents) {
            logger.info(`Creating agent: ${agentConfig.agent_name}`);

            const modelInstance = agentConfig.model_name ? new LiteLLM({ modelName: agentConfig.model_name }) : new LiteLLM({ modelName: "gpt-4o" });

            const agent = await createAgentWithRetry(agentConfig, modelInstance);
            logger.info(`Agent ${agentConfig.agent_name} created successfully.`);
            agents.push(agent);
        }

        if (config.swarm_architecture) {
            try {
                const swarmConfig = new SwarmConfig(config.swarm_architecture);
                swarmRouter = new SwarmRouter({
                    name: swarmConfig.name,
                    description: swarmConfig.description,
                    max_loops: swarmConfig.max_loops,
                    agents,
                    swarm_type: swarmConfig.swarm_type,
                    task: swarmConfig.task,
                    flow: swarmConfig.flow,
                    autosave: swarmConfig.autosave,
                    return_json: swarmConfig.return_json,
                    rules: swarmConfig.rules,
                });
                logger.info(`SwarmRouter '${swarmConfig.name}' created successfully.`);
            } catch (e) {
                logger.error(`Error creating SwarmRouter: ${e.message}`);
                throw new Error(`Failed to create SwarmRouter: ${e.message}`);
            }
        }

        const validReturnTypes = ["auto", "swarm", "agents", "both", "tasks", "run_swarm"];
        if (!validReturnTypes.includes(returnType)) {
            throw new Error(`Invalid returnType. Must be one of: ${validReturnTypes.join(', ')}`);
        }

        if (returnType === "run_swarm" || returnType === "swarm") {
            if (!swarmRouter) {
                throw new Error("Cannot run swarm: SwarmRouter not created.");
            }
            try {
                return await swarmRouter.run(config.swarm_architecture.task);
            } catch (e) {
                logger.error(`Error running SwarmRouter: ${e.message}`);
                throw e;
            }
        }

        if (returnType === "auto") {
            return swarmRouter || (agents.length === 1 ? agents[0] : agents);
        } else if (returnType === "swarm") {
            return swarmRouter || (agents.length === 1 ? agents[0] : agents);
        } else if (returnType === "agents") {
            return agents.length === 1 ? agents[0] : agents;
        } else if (returnType === "both") {
            return [swarmRouter || (agents.length === 1 ? agents[0] : agents), agents];
        } else if (returnType === "tasks") {
            return [];
        }

    } catch (e) {
        logger.error(`Critical error in createAgentsFromYaml: ${e.message}`);
        throw e;
    }
}

export { createAgentsFromYaml };