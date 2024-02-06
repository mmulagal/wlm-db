import { Result, success, error } from './result';
import { LanguageModel } from './model';
import { JsonValidator, createJsonValidator } from './validate';
import { wrapContext } from '../chatbot/helpers';

/**
 * Represents an object that can translate natural language requests in JSON objects of the given type.
 */
export interface JsonTranslator<T extends object> {
    /**
     * The associated `LanguageModel`.
     */
    model: LanguageModel;
    /**
     * The associated `JsonValidator<T>`.
     */
    validator: JsonValidator<T>;
    /**
     * A boolean indicating whether to attempt repairing JSON objects that fail to validate. The default is `true`,
     * but an application can set the property to `false` to disable repair attempts.
     */
    attemptRepair: boolean;
    /**
     * A boolean indicating whether to delete properties with null values from parsed JSON objects. Some language
     * models (e.g. gpt-3.5-turbo) have a tendency to assign null values to optional properties instead of omitting
     * them. The default for this property is `false`, but an application can set the property to `true` for schemas
     * that don't permit null values.
     */
    stripNulls: boolean;
    /**
     * Creates an AI language model prompt from the given request. This function is called by `completeAndValidate`
     * to obtain the prompt. An application can assign a new function to provide a different prompt.
     * @param request The natural language request.
     * @returns A prompt that combines the request with the schema and type name of the underlying validator.
     */
    createRequestPrompt(): string;
    /**
     * Creates a repair prompt to append to an original prompt/response in order to repair a JSON object that
     * failed to validate. This function is called by `completeAndValidate` when `attemptRepair` is true and the
     * JSON object produced by the original prompt failed to validate. An application can assign a new function
     * to provide a different repair prompt.
     * @param validationError The error message returned by the validator.
     * @returns A repair prompt constructed from the error message.
     */
    createRepairPrompt(validationError: string): string;
    /**
     * Optionally implements additional validation logic beyond what is expressed in the schema. This function is
     * called following successful schema validation of an instance. By default the function just returns a
     * `Success<T>` for the given instance, but an application can assign a new function that implements any
     * additional validation.
     * @param instance The instance to validate.
     * @returns A `Success<T>` with the final validated instance, or an `Error` explaning the validation failure.
     */
    validateInstance(instance: T): Result<T>;
    /**
     * Translates a natural language request into an object of type `T`. If the JSON object returned by
     * the language model fails to validate and the `attemptRepair` property is `true`, a second
     * attempt to translate the request will be made. The prompt for the second attempt will include the
     * diagnostics produced for the first attempt. This often helps produce a valid instance.
     * @param request The natural language request.
     * @returns A promise for the resulting object.
     */
    translate(request: string): Promise<Result<T>>;
}

/**
 * Creates an object that can translate natural language requests into JSON objects of the given type.
 * The specified type argument `T` must be the same type as `typeName` in the given `schema`. The function
 * creates a `JsonValidator<T>` and stores it in the `validator` property of the returned instance.
 * @param model The language model to use for translating requests into JSON.
 * @param schema A string containing the TypeScript source code for the JSON schema.
 * @param typeName The name of the JSON target type in the schema.
 * @returns A `JsonTranslator<T>` instance.
 */
export function createJsonTranslator<T extends object>(
    model: LanguageModel,
    schema: string,
    typeName: string
): JsonTranslator<T> {
    const validator = createJsonValidator<T>(schema, typeName);
    const typeChat: JsonTranslator<T> = {
        model,
        validator,
        attemptRepair: true,
        stripNulls: false,
        createRequestPrompt,
        createRepairPrompt,
        validateInstance: success,
        translate
    };
    return typeChat;

    // function createRequestPrompt(request: string) {
    //     return (
    //         `You are a service that translates user requests into JSON objects of type "${validator.typeName}" according to the following TypeScript definitions:\n` +
    //         `\`\`\`\n${validator.schema}\`\`\`\n` +
    //         `The following is a user request:\n` +
    //         `"""\n${request}\n"""\n` +
    //         `The following is the user request translated into a JSON object with 2 spaces of indentation and no properties with the value undefined:\n`
    //     );
    // }

    function createRequestPrompt() {
        return (
            `You are a service that translates user requests into JSON objects of type "${validator.typeName}" according to the following TypeScript definitions:\n` +
            `\`\`\`\n${validator.schema}\`\`\`\n` +
            'translate the user requests/response into a JSON object with 2 spaces of indentation and no properties with the value undefined:\n do not pre populate any parameter values on your own if not specified in the user request\n '
        );
    }

    function createRepairPrompt(validationError: string) {
        return wrapContext(
            'The JSON object is invalid for the following reason:\n' +
                `"""\n${validationError}\n"""\n` +
                'Please provide the revised JSON object:\n'
        );
    }

    async function translate(request: string) {
        // let prompt = typeChat.createRequestPrompt(request);
        let { attemptRepair } = typeChat;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const response = await model.complete(request);
            if (!response.success) {
                return response;
            }
            const responseText = response.data;
            const startIndex = responseText.indexOf('{');
            const endIndex = responseText.lastIndexOf('}');
            if (!(startIndex >= 0 && endIndex > startIndex)) {
                return error(`Response is not JSON:\n${responseText}`);
            }
            const jsonText = responseText.slice(startIndex, endIndex + 1);
            const schemaValidation = validator.validate(jsonText);
            const validation = schemaValidation.success
                ? typeChat.validateInstance(schemaValidation.data)
                : schemaValidation;
            if (validation.success) {
                return validation;
            }
            if (!attemptRepair) {
                return error(`JSON validation failed: ${validation.message}\n${jsonText}`);
            }
            request += `${responseText}\n${typeChat.createRepairPrompt(validation.message)}`;
            attemptRepair = false;
        }
    }
}
