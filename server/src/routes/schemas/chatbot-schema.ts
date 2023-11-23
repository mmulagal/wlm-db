import { RouteTags } from '../../utils/consts';
import { queryBotResponse, PromptRequestBodySchema } from '../types/chatbot.types';

const queryBotSchema = {
    summary: 'List response of chatbot',
    description: 'List response of chatbot',
    tags: [RouteTags.CHATBOT],
    body: PromptRequestBodySchema,
    response: {
        200: queryBotResponse
    }
};

export { queryBotSchema };
export default queryBotSchema;
