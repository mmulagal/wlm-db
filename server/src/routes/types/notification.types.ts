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
    hostName: Type.Optional(Type.String({})),
    databaseType: Type.Optional(
        Type.String({
            description: 'Database engine type (e.g. MSSQL, ORACLE)',
            enum: ['MSSQL', 'ORACLE']
        })
    )
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
        actionRequired: Type.Optional(
            Type.Union([
                Type.Boolean(),
                Type.Object({
                    to: Type.String({ minLength: 1 }),
                    state: Type.Record(Type.String(), Type.String()),
                    label: Type.String({ minLength: 1 })
                })
            ])
        ),
        link: Type.Optional(
            Type.Object({
                url: Type.String({ minLength: 5 }),
                label: Type.String({ minLength: 1 })
            })
        ),
        persist: Type.Optional(Type.Boolean()),
        ttl: Type.Optional(Type.Number()),
        action: Type.Optional(Type.String()),
        userId: Type.Optional(Type.String()),
        service: Type.Optional(Type.String()),
        timestamp: Type.Optional(Type.Number())
    })
});

export { EmailRequestParams, EmailResponse, EmailResponseType, EmailRequestBody, NotificationRequestBody };
