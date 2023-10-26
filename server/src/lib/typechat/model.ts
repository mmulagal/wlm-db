// import { sleep } from '../../utils/utils';
import { sendPrompt } from '../aws/bedrock';
import { Result, success } from './result';

/**
 * Represents a AI language model that can complete prompts. TypeChat uses an implementation of this
 * interface to communicate with an AI service that can translate natural language requests to JSON
 * instances according to a provided schema. The `createLanguageModel`, `createOpenAILanguageModel`,
 * and `createAzureOpenAILanguageModel` functions create instances of this interface.
 */
export interface LanguageModel {
    /**
     * Optional property that specifies the maximum number of retry attempts (the default is 3).
     */
    retryMaxAttempts?: number;
    /**
     * Optional property that specifies the delay before retrying in milliseconds (the default is 1000ms).
     */
    retryPauseMs?: number;
    /**
     * Obtains a completion from the language model for the given prompt.
     * @param prompt The prompt string.
     */
    complete(prompt: string): Promise<Result<string>>;
}

/**
 * Creates a language model encapsulation of an OpenAI or Azure OpenAI REST API endpoint
 * chosen by environment variables.
 *
 * If an `OPENAI_API_KEY` environment variable exists, the `createOpenAILanguageModel` function
 * is used to create the instance. The `OPENAI_ENDPOINT` and `OPENAI_MODEL` environment variables
 * must also be defined or an exception will be thrown.
 *
 * If an `AZURE_OPENAI_API_KEY` environment variable exists, the `createAzureOpenAILanguageModel` function
 * is used to create the instance. The `AZURE_OPENAI_ENDPOINT` environment variable must also be defined
 * or an exception will be thrown.
 *
 * If none of these key variables are defined, an exception is thrown.
 * @returns An instance of `LanguageModel`.
 */
export function createLanguageModel(): LanguageModel {
    return createAwsLanguageModel();
    // }
    // missingEnvironmentVariable('AWS_BEDROCK_ENDPOINT');
}

function createAwsLanguageModel() {
    const model: LanguageModel = {
        complete
    };
    return model;

    async function complete(prompt: string) {
        // let retryCount = 0;
        // console.log('I am Here>>>');
        // const retryMaxAttempts = model.retryMaxAttempts ?? 3;
        // const retryPauseMs = model.retryPauseMs ?? 1000;
        // eslint-disable-next-line no-constant-condition
        // while (true) {
        const result = await sendPrompt(prompt);
        // console.log('RESULT>>>', result, result.statusCode, result.status);
        return success(result.completion ?? '');
        // }
    }
}

/**
 * Returns true of the given HTTP status code represents a transient error.
//  */
// function isTransientHttpError(code: number): boolean {
//     switch (code) {
//         case 429: // TooManyRequests
//         case 500: // InternalServerError
//         case 502: // BadGateway
//         case 503: // ServiceUnavailable
//         case 504: // GatewayTimeout
//             return true;
//         default:
//             return false;
//     }
// }
