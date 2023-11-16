import { Type, Static } from '@fastify/type-provider-typebox';

const PromptRequestBodySchema = Type.Object({
    prompt: Type.String(),
    params: Type.Optional(Type.Any())
});

const queryBotResponse = Type.Object({
    message: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    errors: Type.Optional(
        Type.Array(
            Type.Object({
                key: Type.Optional(Type.String()),
                status: Type.Optional(Type.String()),
                message: Type.Optional(Type.String()),
                type: Type.Optional(Type.String()),
                allowCreate: Type.Optional(Type.Boolean()),
                allowedValues: Type.Optional(
                    Type.Array(
                        Type.Object({
                            label: Type.Optional(Type.String()),
                            value: Type.String()
                        })
                    )
                )
            })
        )
    ),
    intent: Type.Optional(
        Type.Object({
            complete: Type.Optional(Type.Boolean()),
            type: Type.Optional(Type.String()),
            params: Type.Any()
        })
    )
});

type queryBotResponseType = Static<typeof queryBotResponse>;

export { queryBotResponse, PromptRequestBodySchema, queryBotResponseType };
