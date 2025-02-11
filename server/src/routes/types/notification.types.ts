import { Static, Type } from '@fastify/type-provider-typebox';

const EmailRequestBody = Type.Object({
    userEmail: Type.String({ description: 'Recipient email address' }),
    // file: Type.String({ format: 'binary', description: 'Attachment file (PDF, max size 2MB)' }),
    file: Type.Any(),
    storageType: Type.String({ enum: ['ebs', 'fsxw', 'onprem'] })
});
const EmailRequestParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
// type EmailCalculationsRequestBodyType = Static<typeof EmailCalculationsRequestBody>;
const EmailResponse = Type.Object({
    message: Type.String()
});
type EmailResponseType = Static<typeof EmailResponse>;

export { EmailRequestParams, EmailRequestBody, EmailResponse, EmailResponseType };
