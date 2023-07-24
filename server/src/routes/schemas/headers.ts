import { Type } from '@sinclair/typebox';

const headers = Type.Object({
    authorization: Type.String(),
    'x-agent-id': Type.Optional(Type.String())
});

export default headers;
