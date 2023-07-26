import { Type } from '@sinclair/typebox';

const headers = Type.Object({
    authorization: Type.String()
});

export default headers;
