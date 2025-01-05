import { BaseModel } from 'pydantic';
import { autoCheckAndDownloadPackage } from '../utils/auto_download_check_packages.mjs';
import { lazyImportDecorator } from '../utils/lazy_loader.mjs';
import { NumberStoppingCriteria, OutputNumbersTokens, StringStoppingCriteria } from './logits_processor.mjs';
import { BaseLLM } from '../models/base_llm.mjs';
import { PreTrainedModel, PreTrainedTokenizer } from 'transformers'; // Replace with appropriate import if needed
import transformers from 'transformers';

const GENERATION_MARKER = "|GENERATION|";

@lazyImportDecorator
class Jsonformer {
    /**
     * Initializes the FormatTools class.
     * 
     * @param {PreTrainedModel} model - The pre-trained model.
     * @param {PreTrainedTokenizer} tokenizer - The tokenizer for the model.
     * @param {Object} jsonSchema - The JSON schema.
     * @param {string} prompt - The prompt for generation.
     * @param {Object} options - Additional options.
     * @param {boolean} [options.debug=false] - Whether to enable debug mode.
     * @param {number} [options.maxArrayLength=10] - The maximum length of an array.
     * @param {number} [options.maxNumberTokens=6] - The maximum number of tokens for numbers.
     * @param {number} [options.temperature=1.0] - The temperature for generation.
     * @param {number} [options.maxStringTokenLength=10] - The maximum length of a string token.
     * @param {BaseLLM} [options.llm=null] - The language model.
     */
    constructor(model = null, tokenizer = null, jsonSchema = null, schemas = [], prompt = null, {
        debug = false,
        maxArrayLength = 10,
        maxNumberTokens = 6,
        temperature = 1.0,
        maxStringTokenLength = 10,
        llm = null
    } = {}) {
        this.model = model;
        this.tokenizer = tokenizer;
        this.jsonSchema = jsonSchema;
        this.prompt = prompt;
        this.llm = llm;
        this.schemas = schemas;

        this.numberLogitProcessor = new OutputNumbersTokens(this.tokenizer, this.prompt);

        this.generationMarker = GENERATION_MARKER;
        this.debugOn = debug;
        this.maxArrayLength = maxArrayLength;

        this.maxNumberTokens = maxNumberTokens;
        this.temperature = temperature;
        this.maxStringTokenLength = maxStringTokenLength;

        this.value = {};
    }

    generateNumber(temperature = null, iterations = 0) {
        if (this.model) {
            const prompt = this.getPrompt();
            this.debug("[generate_number]", prompt, true);
            const inputTokens = this.tokenizer.encode(prompt, { returnTensors: "pt" }).to(this.model.device);

            const response = this.model.generate(inputTokens, {
                maxNewTokens: this.maxNumberTokens,
                numReturnSequences: 1,
                logitsProcessor: [this.numberLogitProcessor],
                stoppingCriteria: [new NumberStoppingCriteria(this.tokenizer, inputTokens[0].length)],
                temperature: temperature || this.temperature,
                padTokenId: this.tokenizer.eosTokenId
            });

            let result = this.tokenizer.decode(response[0], { skipSpecialTokens: true });
            result = result.slice(prompt.length).trim().replace(/\.$/, '');
            this.debug("[generate_number]", result);

            try {
                return parseFloat(result);
            } catch (e) {
                if (iterations > 3) {
                    throw new Error("Failed to generate a valid number");
                }
                return this.generateNumber(this.temperature * 1.3, iterations + 1);
            }
        } else if (this.llm) {
            const prompt = this.getPrompt();
            this.debug("[generate_number]", prompt, true);
            let response = this.llm(prompt);
            response = response.slice(prompt.length).trim().replace(/\.$/, '');
            this.debug("[generate_number]", response);

            try {
                return parseFloat(response);
            } catch (e) {
                if (iterations > 3) {
                    throw new Error("Failed to generate a valid number");
                }
                return this.generateNumber(this.temperature * 1.3, iterations + 1);
            }
        } else {
            throw new Error("Both LLM and model cannot be null");
        }
    }

    generateBoolean() {
        if (this.model) {
            const prompt = this.getPrompt();
            this.debug("[generate_boolean]", prompt, true);

            const inputTensor = this.tokenizer.encode(prompt, { returnTensors: "pt" });
            const output = this.model.forward(inputTensor.to(this.model.device));
            const logits = output.logits[0, -1];

            const trueTokenId = this.tokenizer.convertTokensToIds("true");
            const falseTokenId = this.tokenizer.convertTokensToIds("false");

            const result = logits[trueTokenId] > logits[falseTokenId];
            this.debug("[generate_boolean]", result);

            return result.item();
        } else if (this.llm) {
            const prompt = this.getPrompt();
            this.debug("[generate_boolean]", prompt, true);

            const output = this.llm(prompt);
            return output === "true" || output === "false" ? output : null;
        } else {
            throw new Error("Both LLM and model cannot be null");
        }
    }

    generateString() {
        if (this.model) {
            const prompt = this.getPrompt() + '"';
            this.debug("[generate_string]", prompt, true);
            const inputTokens = this.tokenizer.encode(prompt, { returnTensors: "pt" }).to(this.model.device);

            const response = this.model.generate(inputTokens, {
                maxNewTokens: this.maxStringTokenLength,
                numReturnSequences: 1,
                temperature: this.temperature,
                stoppingCriteria: [new StringStoppingCriteria(this.tokenizer, inputTokens[0].length)],
                padTokenId: this.tokenizer.eosTokenId
            });

            let result = this.tokenizer.decode(response[0], { skipSpecialTokens: true });
            this.debug("[generate_string]", `|${result}|`);

            if (result.includes('"')) {
                return result.split('"')[0].trim();
            }
            return result;
        } else if (this.llm) {
            const prompt = this.getPrompt() + '"';
            this.debug("[generate_string]", prompt, true);

            let response = this.llm(prompt);
            this.debug("[generate_string]", `|${response}|`);

            if (response.includes('"')) {
                return response.split('"')[0].trim();
            }
            return response;
        } else {
            throw new Error("Both LLM and model cannot be null");
        }
    }

    generateObject(properties, obj) {
        for (const [key, schema] of Object.entries(properties)) {
            this.debug("[generate_object] generating value for", key);
            obj[key] = this.generateValue(schema, obj, key);
        }
        return obj;
    }

    generateValue(schema, obj, key = null) {
        const schemaType = schema.type;
        if (schemaType === "number") {
            if (key) {
                obj[key] = this.generationMarker;
            } else {
                obj.push(this.generationMarker);
            }
            return this.generateNumber();
        } else if (schemaType === "boolean") {
            if (key) {
                obj[key] = this.generationMarker;
            } else {
                obj.push(this.generationMarker);
            }
            return this.generateBoolean();
        } else if (schemaType === "string") {
            if (key) {
                obj[key] = this.generationMarker;
            } else {
                obj.push(this.generationMarker);
            }
            return this.generateString();
        } else if (schemaType === "array") {
            const newArray = [];
            obj[key] = newArray;
            return this.generateArray(schema.items, newArray);
        } else if (schemaType === "object") {
            const newObj = {};
            if (key) {
                obj[key] = newObj;
            } else {
                obj.push(newObj);
            }
            return this.generateObject(schema.properties, newObj);
        } else {
            throw new Error(`Unsupported schema type: ${schemaType}`);
        }
    }

    generateArray(itemSchema, obj) {
        if (this.model) {
            for (let i = 0; i < this.maxArrayLength; i++) {
                const element = this.generateValue(itemSchema, obj);
                obj[obj.length - 1] = element;

                obj.push(this.generationMarker);
                const inputPrompt = this.getPrompt();
                obj.pop();
                const inputTensor = this.tokenizer.encode(inputPrompt, { returnTensors: "pt" });
                const output = this.model.forward(inputTensor.to(this.model.device));
                const logits = output.logits[0, -1];

                const topIndices = logits.topk(30).indices;
                const sortedTokenIds = topIndices[logits[topIndices].argsort({ descending: true })];

                let foundComma = false;
                let foundCloseBracket = false;

                for (const tokenId of sortedTokenIds) {
                    const decodedToken = this.tokenizer.decode(tokenId);
                    if (decodedToken.includes(",")) {
                        foundComma = true;
                        break;
                    }
                    if (decodedToken.includes("]")) {
                        foundCloseBracket = true;
                        break;
                    }
                }

                if (foundCloseBracket || !foundComma) {
                    break;
                }
            }
            return obj;
        } else if (this.llm) {
            for (let i = 0; i < this.maxArrayLength; i++) {
                const element = this.generateValue(itemSchema, obj);
                obj[obj.length - 1] = element;

                obj.push(this.generationMarker);
                const inputPrompt = this.getPrompt();
                obj.pop();
                const output = this.llm(inputPrompt);

                let foundComma = false;
                let foundCloseBracket = false;

                for (const tokenId of output) {
                    const decodedToken = String(tokenId);
                    if (decodedToken.includes(",")) {
                        foundComma = true;
                        break;
                    }
                    if (decodedToken.includes("]")) {
                        foundCloseBracket = true;
                        break;
                    }
                }

                if (foundCloseBracket || !foundComma) {
                    break;
                }
            }
            return obj;
        }
    }

    getPrompt() {
        const template = `{prompt}\nOutput result in the following JSON schema format:\n{schema}\nResult: {progress}`;
        let progress = JSON.stringify(this.value);
        const genMarkerIndex = progress.indexOf(`"${this.generationMarker}"`);
        if (genMarkerIndex !== -1) {
            progress = progress.slice(0, genMarkerIndex);
        } else {
            throw new Error("Failed to find generation marker");
        }

        return template.replace("{prompt}", this.prompt)
                       .replace("{schema}", JSON.stringify(this.jsonSchema))
                       .replace("{progress}", progress);
    }

    call() {
        this.value = {};
        const generatedData = this.generateObject(this.jsonSchema.properties, this.value);
        return generatedData;
    }
}