const { ChatOpenAI, HumanMessage, SystemMessage } = require('@langchain/openai');
const ConcurrentSwarm = require('swarms-js');

// Initialize the chat model
const chatModel = new ChatOpenAI({
  openAIApiKey: "your-openai-api-key",
});

// Create a swarm with a maximum of 10 concurrent threads
const swarm = new ConcurrentSwarm(10);

// Define the OpenAI logic as a function
async function openAiLogic() {
  const messages = [
    new SystemMessage("You're a helpful assistant"),
    new HumanMessage("Create the code for a snake game in python"),
  ];

  const response = await chatModel.invoke(messages);
  console.log(response);
}

// Add 40 agents to the swarm
for (let i = 0; i < 40; i++) {
  swarm.addAgent(openAiLogic);
}

// Perform the task
swarm.performTask();