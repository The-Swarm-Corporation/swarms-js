import { BaseModel, Field } from 'pydantic';

class FunctionSchema extends BaseModel {
    name = Field(
        null,
        { title: "Name", description: "The name of the function." }
    );
    description = Field(
        null,
        { title: "Description", description: "The description of the function." }
    );
    parameters = Field(
        null,
        { title: "Parameters", description: "The parameters of the function." }
    );
}

class OpenAIFunctionCallSchema extends BaseModel {
    /**
     * Represents the schema for an OpenAI function call.
     * 
     * @property {string} type - The type of the function.
     * @property {Array<FunctionSchema>} function - The function to call.
     */
    type = Field(
        "function",
        { title: "Type", description: "The type of the function." }
    );
    function = Field(
        null,
        { title: "Function", description: "The function to call." }
    );
}