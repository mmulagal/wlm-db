import { RouteTags } from '../../utils/consts';
import {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsResponse
} from '../types/storage-savings.types';

const getStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSX is used instead of EBS',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

export default getStorageSavingsSchema;
