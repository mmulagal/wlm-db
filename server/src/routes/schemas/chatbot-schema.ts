import { queryBotResponse, PromptRequestBodySchema } from '../types/chatbot.types';

const queryBotSchema = {
    summary: 'List response of chatbot',
    description: 'List response of chatbot',
    body: PromptRequestBodySchema,
    response: {
        200: queryBotResponse
    }
};

export { queryBotSchema };
export default queryBotSchema;
