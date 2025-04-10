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
    instanceName: Type.String({
        description: 'Name of the instance'
    })
});

type EmailResponseType = Static<typeof EmailResponse>;

export { EmailRequestParams, EmailResponse, EmailResponseType, EmailRequestBody };
