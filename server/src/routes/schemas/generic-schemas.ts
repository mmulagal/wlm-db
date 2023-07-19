import { CredentialsResponse } from "../types/credentials.types"
import { AccountIdParams } from "../types/generic.types"

export const CredentialsSchema = {
    tags: ['Generic'],
    params: AccountIdParams,
    description: 'List added AWS credentials',
    response: {
        200: CredentialsResponse
    }
}
