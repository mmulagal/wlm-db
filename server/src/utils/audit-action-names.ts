import { FastifyRequest } from 'fastify';
import castRequest from '../routes/utils';

const storageSizingDescriptions: { [key: string]: string } = {
    'log-drive-size': 'log drive',
    headroom: 'file system headroom',
    'tempdb-drive-size': 'tempDB drive'
};

export const getActionName = (request: FastifyRequest) => {
    switch (true) {
        case request.url.includes('/optimize/storage-sizing'): {
            const { body } = castRequest(request);
            if (body && body?.type && body.type.length > 0) {
                const param = storageSizingDescriptions[body.type[0]] || 'storage sizing';
                return `Optimize ${param} parameters as per the best practice for the selected database instance.`;
            }
            break;
        }
        default:
    }
};
