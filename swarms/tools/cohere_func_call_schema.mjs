import { BaseModel, Field } from 'pydantic';
import { Dict } from 'some-dict-library'; // Replace with an appropriate library if needed

class ParameterDefinition extends BaseModel {
    description = Field(
        null,
        { title: "Description of the parameter" }
    );
    type = Field(null, { title: "Type of the parameter" });
    required = Field(null, { title: "Is the parameter required?" });
}

class CohereFuncSchema extends BaseModel {
    name = Field(null, { title: "Name of the tool" });
    description = Field(null, { title: "Description of the tool" });
    parameter_definitions = Field(
        null,
        { title: "Parameter definitions for the tool" }
    );
}