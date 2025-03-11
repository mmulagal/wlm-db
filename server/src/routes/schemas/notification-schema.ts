import { Type } from '@sinclair/typebox';
import { RouteTags } from '../../utils/consts';
import { EmailRequestBody, EmailRequestParams, EmailResponse } from '../types/notification.types';

const emailSchema = {
    tags: [RouteTags.NOTIFICATION],
    summary: 'Send email',
    description: 'Sends email containing attachment with report',
    params: EmailRequestParams,
    querystring: Type.Object({
        emailType: Type.String()
    }),
    consumes: ['multipart/form-data'],
    body: EmailRequestBody,
    response: {
        200: EmailResponse
    }
};

export { emailSchema };
