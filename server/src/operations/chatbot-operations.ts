import { omit } from 'lodash-es';
import Chatbot from '../lib/chatbot/chatbot';
import { findChangedKeys, resetNextParamsOnUpdate, validateParams } from '../lib/chatbot/helpers';
import { queryBotResponseType } from '../routes/types/chatbot.types';
import { CHATBOT_UI_PARAMS_FSX } from '../lib/chatbot/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

async function queryBot(query: string, oldParams?: { [x: string]: any }) {
    logger.info('Querying Bot', { query, oldParams });
    try {
        let intent;
        const chatbot = new Chatbot();

        const response = await chatbot.query(query);
        logger.info('CHATBOT RESP>>>', JSON.stringify(response));
        if (response.success) {
            ({ intent } = response.data);
        }

        switch (intent?.type) {
            case 'QueryResponse': {
                const value: queryBotResponseType = {
                    message: intent.response
                };
                return value;
            }
            case 'DeployMsSql': {
                const params = { ...intent.params };
                // let params: DeployMsSqlParamsType = {};
                // delete params.complete;
                if (oldParams) {
                    const changedKeys = findChangedKeys(params, oldParams);
                    resetNextParamsOnUpdate(CHATBOT_UI_PARAMS_FSX, params, oldParams, new Set(changedKeys));
                }
                const validationResponse = await validateParams(
                    params,
                    oldParams as [{ [x: string]: any }],
                    CHATBOT_UI_PARAMS_FSX
                );

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
                        'Great, we are done with all the requirements, please verify the generated json and proceed to deploy!',
                    intent: {
                        complete: true,
                        params: validationResponse.params
                    }
                };
            }
            default: {
                if (response.success === false) {
                    const messages =
                        response?.message?.split('Response is not JSON:') ||
                        response?.message?.split('response:') ||
                        [];
                    return {
                        message: messages[messages.length - 1] || 'Sorry! I could not understand your request',
                        status: 'error'
                    };
                }
                throw new Error('Intent did not match');
            }
        }
    } catch (e) {
        logger.error('Failed to get the query response', e);
        return { message: 'Sorry, I could not find anything related to your query, please try again', status: 'error' };
    }
}

export { queryBot };
export default queryBot;
