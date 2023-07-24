import { CredentialsResponse, CredentialsListParams } from "../types/credentials.types"

const CredentialsSchema = {
    tags: ['Generic'],
    params: CredentialsListParams,
    description: 'List added credentials',
    response: {
        200: CredentialsResponse
    }
}

export { CredentialsSchema };