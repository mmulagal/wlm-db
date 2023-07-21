import {Static, Type } from "@sinclair/typebox";

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type AccountIdParamsType = Static<typeof AccountIdParams>;

export { AccountIdParams, AccountIdParamsType}
