import { queryBotResponse, PromptRequestBodySchema } from '../types/chatbot.types';

const queryBotSchema = {
    description: 'List response of chatbot',
    body: PromptRequestBodySchema,
    response: {
        200: queryBotResponse
    }
};

export { queryBotSchema };
export default queryBotSchema;
