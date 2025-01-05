import { parse as jsonParse, stringify as jsonStringify } from 'json5';
import { BaseModel } from 'pydantic';
import { 
    base_model_to_openai_function, 
    multi_base_model_to_openai_function 
} from './pydantic_to_json.mjs';

function jsonStrToJson(jsonStr) {
    return jsonParse(jsonStr);
}

function jsonStrToPydanticModel(jsonStr, model) {
    return model.model_validate_json(jsonStr);
}

function jsonStrToDict(jsonStr) {
    return jsonParse(jsonStr);
}

function pydanticModelToJsonStr(model, indent, ...args) {
    return jsonStringify(
        base_model_to_openai_function(model),
        null,
        indent,
        ...args
    );
}

function dictToJsonStr(dictionary) {
    return jsonStringify(dictionary);
}

function dictToPydanticModel(dictionary, model) {
    return model.model_validate_json(dictionary);
}

// function prepPydanticModelForStr(model) {
//     // Convert to Function
//     const out = pydanticModelToJsonStr(model);

//     // return functionToStr(out);
// }

function toolSchemaToStr(toolSchema = null, ...args) {
    const out = base_model_to_openai_function(toolSchema);
    return String(out);
}

function toolSchemasToStr(toolSchemas = null, ...args) {
    const out = multi_base_model_to_openai_function(toolSchemas);
    return String(out);
}

function strToPydanticModel(string, model) {
    return model.model_validate_json(string);
}

function listStrToPydanticModel(listStr, model) {
    for (const string of listStr) {
        return model.model_validate_json(string);
    }
}

function prepareOutputForOutputModel(outputType, output = null) {
    if (outputType === BaseModel) {
        return strToPydanticModel(output, outputType);
    } else if (outputType === Object) {
        return dictToJsonStr(output);
    } else if (outputType === String) {
        return output;
    } else {
        return output;
    }
}