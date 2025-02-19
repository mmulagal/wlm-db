import { Static, Type } from '@fastify/type-provider-typebox';

const EmailRequestParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
const EmailResponse = Type.Object({
    message: Type.String()
});
type EmailResponseType = Static<typeof EmailResponse>;

export { EmailRequestParams, EmailResponse, EmailResponseType };
