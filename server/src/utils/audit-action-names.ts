import { FastifyRequest } from 'fastify';
import castRequest from '../routes/utils';

const storageSizingDescriptions: { [key: string]: string } = {
    'log-drive-size': 'log drive',
    headroom: 'file system headroom',
    'tempdb-drive-size': 'tempDB drive'
};

const storageConfigDescriptions: { [key: string]: string } = {
    'thin-provision': 'Thin provisioning',
    autosize: 'Autosize',
    'autosize-mode': 'Autosize-mode',
    'fractional-reserve': 'Fractional reserve',
    'snapshot-copy-reserve': 'Snapshot copy reserve',
    'snapshot-autodelete': 'Snapshot autodelete',
    'space-mgmt-try-first': 'Space management',
    'tiering-min-cooling-days': 'Tiering minimum cooling days',
    'tiering-policy': 'Tiering policy',
    'space-reservation-enabled': 'Space reservation',
    'space-allocation-allocate': 'Space allocation'
};

const storageOSDescriptions: { [key: string]: string } = {
    'mpio-load-balance-policy': 'Multipath I/O Policy',
    'mpio-iscsi-count': 'Multipath I/O Sessions',
    'mpio-enabled': 'Multipath I/O Status'
};

const getActionName = (request: FastifyRequest) => {
    switch (true) {
        case request.url.includes('/optimize/storage-sizing'): {
            const { body } = castRequest(request);
            if (body && body?.type && body.type.length > 0) {
                const param = storageSizingDescriptions[body.type[0]] || 'storage sizing';
                return `Optimize ${param} parameters as per the best practice for the selected database instance.`;
            }
            break;
        }
        case request.url.includes('/optimize/storage-configuration'): {
            const { body } = castRequest(request);
            if (body && body?.type && body.assessments.length > 0) {
                let param = storageConfigDescriptions[body.assessments[0]?.configurationName];
                param = param ? `(${param})` : '';
                return `Optimize storage parameters ${param} as per the best practice for the selected database instance.`;
            }
            break;
        }
        case request.url.includes('/optimize/storage-operating-system'): {
            const { body } = castRequest(request);
            if (body && body.configurationName) {
                let param = storageOSDescriptions[body.configurationName];
                param = param ? `(${param})` : '';
                return `Optimize MPIO settings ${param} parameters as per the best practice for the selected database instance.`;
            }
            break;
        }

        default:
    }
};

export default getActionName;
