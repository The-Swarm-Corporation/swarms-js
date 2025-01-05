// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )

// TODO: Look this whole file over not 100% sure if it's correct
// Abstract base class and utility functions
export class Message {
    /**
     * The base abstract Message class.
     * Messages are the inputs and outputs of ChatModels.
     */

    constructor(content, role, additional_kwargs = {}) {
        this.content = content;
        this.role = role;
        this.additional_kwargs = additional_kwargs;
    }

    getType() {
        throw new Error("getType() must be implemented in subclasses");
    }
}

export class HumanMessage extends Message {
    /**
     * A Message from a human.
     */

    constructor(content, role = "Human", additional_kwargs = {}, example = false) {
        super(content, role, additional_kwargs);
        this.example = example;
    }

    getType() {
        return "human";
    }
}

export class AIMessage extends Message {
    /**
     * A Message from an AI.
     */

    constructor(content, role = "AI", additional_kwargs = {}, example = false) {
        super(content, role, additional_kwargs);
        this.example = example;
    }

    getType() {
        return "ai";
    }
}

export class SystemMessage extends Message {
    /**
     * A Message for priming AI behavior, usually passed in as the first of a sequence
     * of input messages.
     */

    constructor(content, role = "System", additional_kwargs = {}) {
        super(content, role, additional_kwargs);
    }

    getType() {
        return "system";
    }
}

export class FunctionMessage extends Message {
    /**
     * A Message for passing the result of executing a function back to a model.
     */

    constructor(content, role = "Function", name = null, additional_kwargs = {}) {
        super(content, role, additional_kwargs);
        this.name = name;
    }

    getType() {
        return "function";
    }
}

export class ChatMessage extends Message {
    /**
     * A Message that can be assigned an arbitrary speaker (i.e. role).
     */

    constructor(content, role, additional_kwargs = {}) {
        super(content, role, additional_kwargs);
    }

    getType() {
        return "chat";
    }
}

export function getBufferString(messages, humanPrefix = "Human", aiPrefix = "AI") {
    const stringMessages = [];
    for (const m of messages) {
        let message = `${m.role}: ${m.content}`;
        if (m instanceof AIMessage && "function_call" in m.additional_kwargs) {
            message += `${m.additional_kwargs.function_call}`;
        }
        stringMessages.push(message);
    }
    return stringMessages.join("\n");
}

export function messageToDict(message) {
    return { type: message.getType(), data: { ...message } };
}

export function messagesToDict(messages) {
    return messages.map(m => messageToDict(m));
}

export function messageFromDict(message) {
    const { type, data } = message;
    switch (type) {
        case "human":
            return new HumanMessage(data.content, data.role, data.additional_kwargs, data.example);
        case "ai":
            return new AIMessage(data.content, data.role, data.additional_kwargs, data.example);
        case "system":
            return new SystemMessage(data.content, data.role, data.additional_kwargs);
        case "chat":
            return new ChatMessage(data.content, data.role, data.additional_kwargs);
        case "function":
            return new FunctionMessage(data.content, data.role, data.name, data.additional_kwargs);
        default:
            throw new Error(`Got unexpected message type: ${type}`);
    }
}

export function messagesFromDict(messages) {
    return messages.map(m => messageFromDict(m));
}
