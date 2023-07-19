import {Static, Type } from "@sinclair/typebox";

export const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
export type AccountIdParamsType = Static<typeof AccountIdParams>;
