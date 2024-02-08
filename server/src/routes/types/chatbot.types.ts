import { Type, Static } from '@fastify/type-provider-typebox';

const PromptRequestBodySchema = Type.Object({
    prompt: Type.Optional(Type.String()), // will be present only when the user is not respoding to a question and rather asking a query
    intent: Type.Optional(Type.String()),
    params: Type.Optional(Type.Any()), // contains valid params
    userParams: Type.Optional(Type.Any()) // contains yet to be validated params
});

const queryBotResponse = Type.Object({
    message: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    error: Type.Optional(
        Type.Object({
            key: Type.Optional(Type.String()),
            label: Type.Optional(Type.String()),
            status: Type.Optional(Type.String()),
            message: Type.Optional(Type.String()),
            type: Type.Optional(Type.String()),
            disable: Type.Optional(Type.Boolean()),
            default: Type.Optional(Type.String()),
            allowCreate: Type.Optional(Type.Boolean()),
            link: Type.Optional(
                Type.Object({
                    text: Type.Optional(Type.String()),
                    path: Type.Optional(Type.String()),
                    description: Type.Optional(Type.String())
                })
            ),
            allowedValues: Type.Optional(
                Type.Array(
                    Type.Object({
                        label: Type.Optional(Type.String()),
                        value: Type.String(),
                        data: Type.Optional(
                            Type.Array(
                                Type.Object({
                                    label: Type.Optional(Type.String()),
                                    value: Type.Optional(Type.String())
                                })
                            )
                        )
                    })
                )
            ),
            data: Type.Optional(Type.Any())
        })
    ),
    intent: Type.Optional(
        Type.Object({
            complete: Type.Optional(Type.Boolean()),
            type: Type.Optional(Type.String()),
            userParams: Type.Optional(Type.Any()),
            params: Type.Any()
        })
    )
});

type queryBotResponseType = Static<typeof queryBotResponse>;

export { queryBotResponse, PromptRequestBodySchema, queryBotResponseType };
