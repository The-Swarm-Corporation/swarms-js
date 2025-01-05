import { config as loadEnv } from 'dotenv';
import retry from 'async-retry';
import { Agent } from '../index.mjs';
import { createAgentsFromYaml } from './create_agents_from_yaml.mjs';
import { formatter } from '../utils/formatter.mjs';
import { LiteLLM } from '../utils/litellm_wrapper.mjs';

loadEnv();

/**
 * Prepares raw YAML content by fixing spacing and formatting issues.
 * 
 * @param {string} rawYaml - The raw YAML content extracted from Markdown.
 * @returns {string} - The cleaned YAML content ready for parsing.
 */
function prepareYamlForParsing(rawYaml) {
    let fixedYaml = rawYaml.replace(/(\b\w+\b):\s*-\s*/g, '$1:\n  - ');
    fixedYaml = fixedYaml.replace(/(\S):(\S)/g, '$1: $2');
    fixedYaml = fixedYaml.replace(/\s+\n/g, '\n');
    fixedYaml = fixedYaml.replace(/\xa0/g, ' ');
    return fixedYaml.trim();
}

/**
 * Extracts and prepares YAML content from a Markdown-style 'Auto-Swarm-Builder' block and parses it.
 * 
 * @param {string} markdownText - The Markdown text containing the YAML inside 'Auto-Swarm-Builder' block.
 * @returns {string} - The cleaned YAML content ready for parsing.
 * @throws {Error} - If no YAML content is found in the 'Auto-Swarm-Builder' block.
 */
function parseYamlFromSwarmMarkdown(markdownText) {
    const pattern = /```yaml\s*\n(.*?)```/gs;
    const match = pattern.exec(markdownText);

    if (!match) {
        throw new Error("No YAML content found in the 'Auto-Swarm-Builder' block.");
    }

    const rawYaml = match[1].trim();
    return prepareYamlForParsing(rawYaml);
}

const AUTO_GEN_PROMPT = `
You are a specialized agent responsible for creating YAML configuration files for multi-agent swarms. Your role is to generate well-structured YAML that defines both individual agents and swarm architectures based on user requirements.
Output only the yaml nothing else. You will be penalized for making mistakes

GUIDELINES:
1. Each YAML file must contain an \`agents\` section with at least one agent configuration
2. Each agent configuration requires the following mandatory fields:
   - agent_name (string)
   - system_prompt (string)

3. Optional agent fields include:
   - max_loops (integer)
   - autosave (boolean)
   - dashboard (boolean)
   - verbose (boolean)
   - dynamic_temperature_enabled (boolean)
   - saved_state_path (string)
   - user_name (string)
   - retry_attempts (integer)
   - context_length (integer)
   - return_step_meta (boolean)
   - output_type (string)
   - task (string)

4. When a swarm is needed, include a \`swarm_architecture\` section with:
   Mandatory fields:
   - name (string)
   - swarm_type (string: "ConcurrentWorkflow" or "SequentialWorkflow") [AgentRearrange, MixtureOfAgents, SpreadSheetSwarm, SequentialWorkflow, ConcurrentWorkflow]	
   
   Optional fields:
   - description (string)
   - max_loops (integer)
   - task (string)

TEMPLATE STRUCTURE:
\`\`\`yaml
agents:
  - agent_name: "Agent-1-Name"
    system_prompt: "Detailed system prompt here"
    max_loops: 1
    # [additional optional fields]

  - agent_name: "Agent-2-Name"
    system_prompt: "Detailed system prompt here"
    # [additional optional fields]

swarm_architecture:
  name: "Swarm-Name"
  description: "Swarm purpose and goals"
  swarm_type: "ConcurrentWorkflow"
  max_loops: 5
  task: "Main swarm task description"
\`\`\`

VALIDATION RULES:
1. All agent names must be unique
2. System prompts must be clear and specific to the agent's role
3. Integer values must be positive
4. Boolean values must be true or false (lowercase)
5. File paths should use forward slashes
6. Tasks should be specific and aligned with the agent/swarm purpose

When generating a YAML configuration:
1. Ask for specific requirements about the agents and swarm needed
2. Determine if a swarm architecture is necessary based on the task complexity
3. Generate appropriate system prompts for each agent based on their roles
4. Include relevant optional fields based on the use case
5. Validate the configuration against all rules before returning

Example valid YAML configurations are provided below. Use these as references for structure and formatting:

\`\`\`yaml


agents:
  - agent_name: "Data-Analysis-Agent"
    system_prompt: "You are a specialized data analysis agent focused on processing and interpreting financial data. Provide clear, actionable insights based on the data provided."
    max_loops: 3
    autosave: true
    verbose: true
    context_length: 100000
    output_type: "json"
    task: "Analyze quarterly financial reports and identify trends"

# Multi-Agent Swarm Example
agents:
  - agent_name: "Research-Agent"
    system_prompt: "You are a research agent specialized in gathering and summarizing scientific publications. Focus on peer-reviewed sources and provide comprehensive summaries."
    max_loops: 2
    context_length: 150000
    output_type: "str"

  - agent_name: "Analysis-Agent"
    system_prompt: "You are an analysis agent that processes research summaries and identifies key patterns and insights. Provide detailed analytical reports."
    max_loops: 3
    context_length: 200000
    output_type: "json"

swarm_architecture:
  name: "Research-Analysis-Swarm"
  description: "A swarm for comprehensive research analysis and insight generation"
  swarm_type: "SequentialWorkflow"
  max_loops: 5
  task: "Research and analyze recent developments in quantum computing"
  
\`\`\`
`;

/**
 * Generates a swarm configuration based on the provided task and model name.
 * 
 * @param {string} task - The task to be performed by the swarm.
 * @param {string} [fileName="swarm_config_output.yaml"] - The file name for the output YAML configuration.
 * @param {string} [modelName="gpt-4o"] - The name of the model to use for the agent.
 * @param {...any} args - Additional positional arguments to be passed to the agent's run method.
 * @returns {Promise<any>} - The output of the swarm configuration generation process. This can be a SwarmRouter instance or an error message.
 */
async function generateSwarmConfig(task, fileName = "swarm_config_output.yaml", modelName = "gpt-4o", ...args) {
    formatter.printPanel("Auto Generating Swarm...", "Auto Swarm Builder");

    async function attemptGenerateSwarmConfig() {
        try {
            const model = new LiteLLM({ modelName });

            const agent = new Agent({
                agent_name: "Auto-Swarm-Builder",
                system_prompt: AUTO_GEN_PROMPT,
                llm: model,
                max_loops: 1,
                dynamic_temperature_enabled: true,
                saved_state_path: "swarm_builder.json",
                user_name: "swarms_corp",
                output_type: "str",
            });

            const rawOutput = await agent.run(task, ...args);
            const yamlContent = parseYamlFromSwarmMarkdown(rawOutput);
            console.log(yamlContent);

            const output = createAgentsFromYaml({
                yaml_string: yamlContent,
                return_type: "run_swarm",
            });

            formatter.printPanel("Swarm configuration generated successfully.", "Success");

            return output;

        } catch (e) {
            formatter.printPanel(`Error generating swarm configuration: ${e.message}`, "Error");
            throw e;
        }
    }

    return retry(attemptGenerateSwarmConfig, {
        retries: 3,
        minTimeout: 4000,
        maxTimeout: 10000
    });
}

export { generateSwarmConfig };