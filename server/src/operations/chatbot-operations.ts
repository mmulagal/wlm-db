import { omit } from 'lodash-es';
import Chatbot from '../lib/chatbot/chatbot';
import { findChangedKeys, resetNextParamsOnUpdate, validateParams } from '../lib/chatbot/helpers';
import { queryBotResponseType } from '../routes/types/chatbot.types';
import { CHATBOT_UI_PARAMS_FSX, DEPLOYMENT_ENVIRONMENT, MSSQL_ENV_PRE_CONFIG } from '../lib/chatbot/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

async function queryBot(query: string, oldParams?: { [x: string]: any }) {
    logger.debug('Querying Bot', { query, oldParams });
    try {
        let intent;
        const chatbot = new Chatbot();

        const response = await chatbot.query(query);
        logger.info('CHATBOT RESP>>>', response);
        if (response.success) {
            ({ intent } = response.data);
        }

        switch (intent?.type) {
            case 'Query': {
                const value: queryBotResponseType = {
                    message: intent.response
                };
                return value;
            }
            case 'DeployMsSql': {
                const params = {
                    ...intent.params,
                    ...MSSQL_ENV_PRE_CONFIG[intent.params[DEPLOYMENT_ENVIRONMENT] as keyof typeof MSSQL_ENV_PRE_CONFIG]
                };

                // let params: DeployMsSqlParamsType = {};
                // delete params.complete;
                if (oldParams) {
                    const changedKeys = findChangedKeys(params, oldParams);
                    resetNextParamsOnUpdate(CHATBOT_UI_PARAMS_FSX, params, oldParams, new Set(changedKeys));
                }
                const validationResponse = await validateParams(params, oldParams || {}, CHATBOT_UI_PARAMS_FSX);

                if (validationResponse?.errors?.length) {
                    return {
                        errors: validationResponse.errors,
                        intent: {
                            complete: false,
                            type: intent?.type,
                            params: validationResponse.params,
                            userParams: omit(params, Object.keys(validationResponse.params))
                        }
                    };
                }
                return {
                    message:
                        'Congratulations, you have completed filling in all required parameters. Please verify the genereated json including predefined parameters in the Codebox and hit the Create button to deploy. If you would like to modify a predefined parameter please request to modify the field.',
                    intent: {
                        complete: true,
                        params: validationResponse.params
                    }
                };
            }
            default: {
                if (response.success === false) {
                    const invalidResponse =
                        response?.message?.includes('Response is not JSON') ||
                        response?.message?.includes('JSON validation failed');
                    return {
                        message: invalidResponse ? 'Sorry! I could not understand your request' : response.message,
                        status: 'error'
                    };
                }
                throw new Error('Intent did not match');
            }
        }
    } catch (e: any) {
        logger.error('Failed to get the query response', e?.message, e);
        return {
            message: e?.message || 'Sorry, I could not find anything related to your query, please try again',
            status: 'error'
        };
    }
}

export { queryBot };
export default queryBot;
