import { Type } from '@sinclair/typebox';
import { RouteTags } from '../../utils/consts';
import { EmailRequestParams, EmailResponse } from '../types/notification.types';

const emailSchema = {
    tags: [RouteTags.NOTIFICATION],
    summary: 'Send email',
    description: 'Sends email containing attachment with report',
    params: EmailRequestParams,
    consumes: ['multipart/form-data'],
    body: Type.Any(),
    response: {
        200: EmailResponse
    }
};

export { emailSchema };
