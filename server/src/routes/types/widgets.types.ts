import { Type } from '@fastify/type-provider-typebox';

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const WidgetStatusResponse = Type.Object({
    status: Type.Object({
        isActive: Type.Boolean()
    })
});

export { WidgetStatusResponse, AccountIdParams };
