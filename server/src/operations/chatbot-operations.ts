import { isEmpty, omit } from 'lodash-es';
import Chatbot from '../lib/chatbot/chatbot';
import { findChangedKeys, resetNextParamsOnUpdate, validateParams } from '../lib/chatbot/helpers';
import { queryBotResponseType } from '../routes/types/chatbot.types';
import { CHATBOT_UI_PARAMS_FSX, DEPLOYMENT_ENVIRONMENT, MSSQL_ENV_PRE_CONFIG } from '../lib/chatbot/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

interface Params {
    [x: string]: any;
}

async function queryBot(query?: string, intentType?: string, validParams?: Params, toBeValidatedParams?: Params) {
    logger.debug('Querying Bot', { query, validParams, toBeValidatedParams });
    try {
        const chatbot = new Chatbot();

        let intent;
        let response;
        const oldParams = validParams || {};
        if (!query) {
            intent = {
                type: intentType,
                params: { ...validParams, ...toBeValidatedParams }
            };
        } else {
            response = await chatbot.query(query as string);
            logger.info('CHATBOT RESP>>>', response);
            if (response.success) {
                ({ intent } = response.data);
                if (intent.type === 'DeployMsSql') {
                    intent.params = {
                        ...intent?.params,
                        ...toBeValidatedParams
                    };
                }
            }
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

                if (oldParams) {
                    const changedKeys = findChangedKeys(params, oldParams);
                    resetNextParamsOnUpdate(CHATBOT_UI_PARAMS_FSX, params, oldParams, new Set(changedKeys));
                }
                const validationResponse = await validateParams(params, oldParams || {}, CHATBOT_UI_PARAMS_FSX);

                if (!isEmpty(validationResponse?.error)) {
                    return {
                        error: validationResponse.error,
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
                        'Congratulations, you have completed filling in all required parameters. Please verify the generated json including predefined parameters in the Codebox and select Deploy.',
                    intent: {
                        complete: true,
                        params: validationResponse.params
                    }
                };
            }
            default: {
                /**
                 * At times the bedrock model is not able to properly format the response in a valid JSON, and therefore results into an error
                 * However, we still get the response in string format, here we are extracting the response from the string and sending it back to the user
                 * as the response is still valid
                 *
                 * Example Response
                 *
                 * {"success":false,"message":"JSON validation failed: Bad control character in string literal in JSON at position 122\n{\n  \"intent\": {\n    \"type\": \"Query\",\n    \"response\": \"Some best practices for using FSx for ONTAP with SQL Server include:\n\n- Use FSx for high performance workloads like SQL Server. The high throughput and IOPS can significantly improve performance. \n\n- Put SQL Server data and log files on separate FSx volumes for better performance.\n\n- Enable data compression on SQL Server for reduced storage costs. The high throughput of FSx makes the compression overhead negligible. \n\n- Use FSx's data tiering feature to automatically move less frequently accessed data to lower cost S3 storage. This reduces overall storage costs while still providing high performance for hot data.\n\n- Schedule regular FSx backups to S3 for disaster recovery. Backups are crash consistent for SQL Server.  \n\n- Monitor FSx metrics in CloudWatch like throughput, IOPS, latency to ensure it is sized appropriately for workload. \n\n- Ensure FSx and SQL Security groups allow communication on required ports.\n\n- Consider using FSx for Windows File Server for AD and file shares. Can be peered with FSx for ONTAP for permissions.\"\n  }\n}"}
                 *
                 *
                 */
                if (response?.success === false) {
                    const invalidJson =
                        response?.message?.includes('Response is not JSON') ||
                        response?.message?.includes('JSON validation failed');

                    let message = 'Sorry! I could not understand your request';
                    if (invalidJson) {
                        const responseIndex = response?.message.indexOf('response');

                        const startInd = response.message.indexOf('"', responseIndex + 9);
                        const endInd = response.message.lastIndexOf('"');
                        message = response.message.slice(startInd + 1, endInd);
                    }

                    return {
                        message,
                        ...(!invalidJson && { status: 'error' })
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
