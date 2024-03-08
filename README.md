# Swarms
======

Swarms is an innovative package that allows you to integrate various AI agents from platforms like OpenAI, Langchain, and others to work together as a team and automate tasks. With Swarms, you can create a powerful AI team that can handle complex tasks with ease.

## Features
--------

-   Integration with Multiple AI Platforms: Swarms allows you to integrate AI agents from various platforms like OpenAI, Langchain, and others. This gives you the flexibility to choose the best AI agents for your tasks.

-   Teamwork: With Swarms, AI agents can work together as a team. This allows for more efficient and effective task automation.

-   Easy to Use: Swarms is designed to be easy to use. You can get your AI team up and running in no time.

# install
------------

To install Swarms, you can use npm:

```bash
npm install swarms
```


## Usage
-----

Here is a basic example of how to use Swarms:

```javascript
const { ChatOpenAI, HumanMessage, SystemMessage } = require('@langchain/openai');
const ConcurrentSwarm = require('swarms');

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


Please refer to our [API documentation](https://domain.apac.ai/API.md) for more detailed usage instructions.

## Contributing
------------

We welcome contributions from the community. If you would like to contribute, please check out our [contributing guidelines](https://github.com/kyegomez/swarms-js).

## Support
-------

If you need help with Swarms, you can reach out to us on our [support page](https://github.com/kyegomez/swarms-js).

## License
-------

Swarms is licensed under the [MIT License](https://github.com/kyegomez/swarms-js/LICENSE).

Join the Swarms community and start automating tasks with your AI team today!