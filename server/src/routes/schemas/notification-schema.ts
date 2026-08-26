import { Type } from 'typebox';
import { RouteTags } from '../../utils/consts';
import {
    EmailRequestBody,
    EmailRequestParams,
    EmailResponse,
    NotificationRequestBody
} from '../types/notification.types';

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

const notificationSchema = {
    tags: [RouteTags.NOTIFICATION],
    hide: true,
    summary: 'Send WF Notification',
    description: 'Sends WF Notification with required information',
    params: EmailRequestParams,
    body: NotificationRequestBody,
    response: {
        200: EmailResponse
    }
};

export { emailSchema, notificationSchema };
