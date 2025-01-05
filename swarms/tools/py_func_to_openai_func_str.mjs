import { BaseModel, Field } from 'pydantic';
import { getLogger } from 'some-logging-library'; // Replace with an appropriate library if needed

const logger = getLogger('py_func_to_openai_func_str');

function type2schema(t) {
    // Convert a type to a JSON schema
    return TypeAdapter(t).json_schema();
}

function modelDump(model) {
    // Convert a pydantic model to a dict
    return model.model_dump();
}

function modelDumpJson(model) {
    // Convert a pydantic model to a JSON string
    return model.model_dump_json();
}

function getTypedAnnotation(annotation, globalns) {
    // Get the type annotation of a parameter
    if (typeof annotation === 'string') {
        annotation = new ForwardRef(annotation);
        annotation = evaluateForwardRef(annotation, globalns, globalns);
    }
    return annotation;
}

function getTypedSignature(call) {
    // Get the signature of a function with type annotations
    const signature = inspect.signature(call);
    const globalns = call.__globals__ || {};
    const typedParams = signature.parameters.map(param => ({
        name: param.name,
        kind: param.kind,
        default: param.default,
        annotation: getTypedAnnotation(param.annotation, globalns)
    }));
    return new inspect.Signature(typedParams);
}

function getTypedReturnAnnotation(call) {
    // Get the return annotation of a function
    const signature = inspect.signature(call);
    const annotation = signature.return_annotation;

    if (annotation === inspect.Signature.empty) {
        return null;
    }

    const globalns = call.__globals__ || {};
    return getTypedAnnotation(annotation, globalns);
}

function getParamAnnotations(typedSignature) {
    // Get the type annotations of the parameters of a function
    return Object.fromEntries(
        Object.entries(typedSignature.parameters).map(([k, v]) => [k, v.annotation])
    );
}

class Parameters extends BaseModel {
    // Parameters of a function as defined by the OpenAI API
    type = 'object';
    properties = {};
    required = [];
}

class FunctionSchema extends BaseModel {
    // A function as defined by the OpenAI API
    description = Field(null, { description: "Description of the function" });
    name = Field(null, { description: "Name of the function" });
    parameters = Field(null, { description: "Parameters of the function" });
}

class ToolFunction extends BaseModel {
    // A function under tool as defined by the OpenAI API
    type = 'function';
    function = Field(null, { description: "Function under tool" });
}

function getParameterJsonSchema(k, v, defaultValues) {
    // Get a JSON schema for a parameter as defined by the OpenAI API
    function type2description(k, v) {
        if (v.__metadata__) {
            const retval = v.__metadata__[0];
            if (typeof retval === 'string') {
                return retval;
            } else {
                throw new Error(`Invalid description ${retval} for parameter ${k}, should be a string.`);
            }
        } else {
            return k;
        }
    }

    const schema = type2schema(v);
    if (k in defaultValues) {
        schema.default = defaultValues[k];
    }
    schema.description = type2description(k, v);

    return schema;
}

function getRequiredParams(typedSignature) {
    // Get the required parameters of a function
    return Object.entries(typedSignature.parameters)
        .filter(([k, v]) => v.default === inspect.Signature.empty)
        .map(([k]) => k);
}

function getDefaultValues(typedSignature) {
    // Get default values of parameters of a function
    return Object.fromEntries(
        Object.entries(typedSignature.parameters)
            .filter(([k, v]) => v.default !== inspect.Signature.empty)
            .map(([k, v]) => [k, v.default])
    );
}

function getParameters(required, paramAnnotations, defaultValues) {
    // Get the parameters of a function as defined by the OpenAI API
    return new Parameters({
        properties: Object.fromEntries(
            Object.entries(paramAnnotations).map(([k, v]) => [k, getParameterJsonSchema(k, v, defaultValues)])
        ),
        required
    });
}

function getMissingAnnotations(typedSignature, required) {
    // Get the missing annotations of a function
    const allMissing = new Set(
        Object.entries(typedSignature.parameters)
            .filter(([k, v]) => v.annotation === inspect.Signature.empty)
            .map(([k]) => k)
    );
    const missing = new Set([...allMissing].filter(k => required.includes(k)));
    const unannotatedWithDefault = new Set([...allMissing].filter(k => !missing.has(k)));
    return [missing, unannotatedWithDefault];
}

function getOpenAIFunctionSchemaFromFunc(func, { name = null, description = null } = {}) {
    // Get a JSON schema for a function as defined by the OpenAI API
    const typedSignature = getTypedSignature(func);
    const required = getRequiredParams(typedSignature);
    const defaultValues = getDefaultValues(typedSignature);
    const paramAnnotations = getParamAnnotations(typedSignature);
    const returnAnnotation = getTypedReturnAnnotation(func);
    const [missing, unannotatedWithDefault] = getMissingAnnotations(typedSignature, required);

    if (returnAnnotation === null) {
        logger.warning(`The return type of the function '${func.name}' is not annotated. Although annotating it is optional, the function should return either a string, a subclass of 'pydantic.BaseModel'.`);
    }

    if (unannotatedWithDefault.size > 0) {
        const unannotatedWithDefaultStr = [...unannotatedWithDefault].map(k => `'${k}'`).join(', ');
        logger.warning(`The following parameters of the function '${func.name}' with default values are not annotated: ${unannotatedWithDefaultStr}.`);
    }

    if (missing.size > 0) {
        const missingStr = [...missing].map(k => `'${k}'`).join(', ');
        throw new TypeError(`All parameters of the function '${func.name}' without default values must be annotated. The annotations are missing for the following parameters: ${missingStr}`);
    }

    const fname = name || func.name;

    const parameters = getParameters(required, paramAnnotations, defaultValues);

    const functionSchema = new ToolFunction({
        function: new FunctionSchema({
            description,
            name: fname,
            parameters
        })
    });

    return modelDump(functionSchema);
}

function getLoadParamIfNeededFunction(t) {
    // Get a function to load a parameter if it is a Pydantic model
    if (getOrigin(t) === Annotated) {
        return getLoadParamIfNeededFunction(getArgs(t)[0]);
    }

    function loadBaseModel(v, t) {
        return new t(v);
    }

    return (typeof t === 'function' && t.prototype instanceof BaseModel) ? loadBaseModel : null;
}

function loadBasemodelsIfNeeded(func) {
    // A decorator to load the parameters of a function if they are Pydantic models
    const typedSignature = getTypedSignature(func);
    const paramAnnotations = getParamAnnotations(typedSignature);

    const kwargsMappingWithNones = Object.fromEntries(
        Object.entries(paramAnnotations).map(([k, t]) => [k, getLoadParamIfNeededFunction(t)])
    );

    const kwargsMapping = Object.fromEntries(
        Object.entries(kwargsMappingWithNones).filter(([k, f]) => f !== null)
    );

    function loadParametersIfNeeded(...args) {
        for (const [k, f] of Object.entries(kwargsMapping)) {
            args[k] = f(args[k], paramAnnotations[k]);
        }
        return func(...args);
    }

    async function aLoadParametersIfNeeded(...args) {
        for (const [k, f] of Object.entries(kwargsMapping)) {
            args[k] = f(args[k], paramAnnotations[k]);
        }
        return await func(...args);
    }

    return func.constructor.name === 'AsyncFunction' ? aLoadParametersIfNeeded : loadParametersIfNeeded;
}

function serializeToStr(x) {
    if (typeof x === 'string') {
        return x;
    } else if (x instanceof BaseModel) {
        return modelDumpJson(x);
    } else {
        return JSON.stringify(x);
    }
}