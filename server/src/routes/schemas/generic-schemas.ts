import { CredentialsResponse } from "../types/credentials.types"
import { AccountIdParams } from "../types/generic.types"

const CredentialsSchema = {
    tags: ['Generic'],
    params: AccountIdParams,
    description: 'List added AWS credentials',
    response: {
        200: CredentialsResponse
    }
}

export { CredentialsSchema };