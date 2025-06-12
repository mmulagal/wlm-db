import { Static, Type } from '@fastify/type-provider-typebox';

const EmailRequestParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
const EmailResponse = Type.Object({
    message: Type.String()
});

const EmailRequestBody = Type.Object({
    file: Type.String({ format: 'binary', description: 'File to attach to the email' }),
    userEmail: Type.String({
        format: 'email',
        description: 'Email address to send the report to',
        examples: ['user@myname.com']
    }),
    storageType: Type.String({
        description: 'Type of storage to calculate savings for',
        enum: ['ebs', 'fsxw', 'onprem']
    }),
    hostName: Type.Optional(Type.String({}))
});

type EmailResponseType = Static<typeof EmailResponse>;

const NotificationRequestBody = Type.Object({
    notificationData: Type.Object({
        content: Type.String({ minLength: 10 }),
        subject: Type.String({ minLength: 10 }),
        resourceName: Type.String({ minLength: 5 }),
        resourceId: Type.String({ minLength: 5 }),
        notificationType: Type.String({ minLength: 2 }),
        resourceType: Type.Optional(Type.String()),
        workload: Type.Optional(Type.String()),
        priority: Type.Optional(Type.String()),
        actionRequired: Type.Optional(Type.Boolean()),
        persist: Type.Optional(Type.Boolean()),
        ttl: Type.Optional(Type.Number()),
        action: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        service: Type.Optional(Type.String())
    })
});

export { EmailRequestParams, EmailResponse, EmailResponseType, EmailRequestBody, NotificationRequestBody };
