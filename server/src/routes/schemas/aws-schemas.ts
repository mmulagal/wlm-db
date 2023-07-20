import { AdsParams, AdsResponse } from "../types/aws.types";

export const AdsSchema = {
    tags: ['AWS'],
    params: AdsParams,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
    }
}