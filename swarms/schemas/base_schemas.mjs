import { BaseModel, Field } from 'pydantic';
import { v4 as uuidv4 } from 'uuid';

/**
 * A Pydantic model representing a model card, which provides metadata about a machine learning model.
 * It includes fields like model ID, owner, and creation time.
 */
class ModelCard extends BaseModel {
    id = Field(null);
    object = Field("model");
    created = Field(() => Math.floor(Date.now() / 1000));
    owned_by = Field("owner");
    root = Field(null, { default: null });
    parent = Field(null, { default: null });
    permission = Field(null, { default: null });
}

class ModelList extends BaseModel {
    object = Field("list");
    data = Field([]);
}

class ImageUrl extends BaseModel {
    url = Field(null);
}

class TextContent extends BaseModel {
    type = Field("text");
    text = Field(null);
}

class ImageUrlContent extends BaseModel {
    type = Field("image_url");
    image_url = Field(null);
}

const ContentItem = [TextContent, ImageUrlContent];

class ChatMessageInput extends BaseModel {
    role = Field(null, { description: "The role of the message sender. Could be 'user', 'assistant', or 'system'." });
    content = Field(null);
}

class ChatMessageResponse extends BaseModel {
    role = Field(null, { description: "The role of the message sender. Could be 'user', 'assistant', or 'system'." });
    content = Field(null, { default: null });
}

class DeltaMessage extends BaseModel {
    role = Field(null, { default: null });
    content = Field(null, { default: null });
}

class ChatCompletionRequest extends BaseModel {
    model = Field("gpt-4o");
    messages = Field([]);
    temperature = Field(0.8, { default: 0.8 });
    top_p = Field(0.8, { default: 0.8 });
    max_tokens = Field(4000, { default: 4000 });
    stream = Field(false, { default: false });
    repetition_penalty = Field(1.0, { default: 1.0 });
    echo = Field(false, { default: false });
}

class ChatCompletionResponseChoice extends BaseModel {
    index = Field(null, { description: "The index of the choice." });
    input = Field(null, { description: "The input message." });
    message = Field(null, { description: "The output message." });
}

class ChatCompletionResponseStreamChoice extends BaseModel {
    index = Field(null);
    delta = Field(null);
}

class UsageInfo extends BaseModel {
    prompt_tokens = Field(0);
    total_tokens = Field(0);
    completion_tokens = Field(0, { default: 0 });
}

class ChatCompletionResponse extends BaseModel {
    model = Field(null);
    object = Field(null);
    choices = Field([]);
    created = Field(() => Math.floor(Date.now() / 1000));
}

class AgentChatCompletionResponse extends BaseModel {
    id = Field(`agent-${uuidv4()}`, { description: "The ID of the agent that generated the completion response." });
    agent_name = Field(null, { description: "The name of the agent that generated the completion response." });
    object = Field(null, { default: null });
    choices = Field(null, { default: null });
    created = Field(() => Math.floor(Date.now() / 1000));
    // full_usage: Field(null, { default: null });
}

export {
    ModelCard,
    ModelList,
    ImageUrl,
    TextContent,
    ImageUrlContent,
    ContentItem,
    ChatMessageInput,
    ChatMessageResponse,
    DeltaMessage,
    ChatCompletionRequest,
    ChatCompletionResponseChoice,
    ChatCompletionResponseStreamChoice,
    UsageInfo,
    ChatCompletionResponse,
    AgentChatCompletionResponse
};