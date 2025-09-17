import { FastifyRequest } from 'fastify';
import castRequest from '../routes/utils';

const storageSizingDescriptions: { [key: string]: string } = {
    'log-drive-size': 'log drive size',
    headroom: 'file system headroom',
    'tempdb-drive-size': 'tempDB drive size'
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
    'space-allocation-allocated': 'Space allocation',
    'snapshot-policy': 'Snapshot policy'
};

const storageOSDescriptions: { [key: string]: string } = {
    'mpio-load-balance-policy': 'Multipath I/O Policy',
    'mpio-iscsi-count': 'Multipath I/O Sessions',
    'mpio-enabled': 'Multipath I/O Status'
};

const resiliencyDescriptions: { [key: string]: string } = {
    'snapshot-policy': 'Snapshot policy'
};

const getActionName = (request: FastifyRequest) => {
    let param = '';
    const { body } = castRequest(request);

    switch (true) {
        case request.url.includes('/optimize/storage-sizing'): {
            if (body && body?.configurationName) {
                param = storageSizingDescriptions[body.configurationName] || 'storage sizing';
            }
            return `Fix ${param} parameters as per the best practice for the selected database instance.`;
        }

        case request.url.includes('/optimize/storage-configuration'): {
            if (body && body.assessments.length > 0) {
                param = storageConfigDescriptions[body.assessments[0]?.configurationName];
            }
            return `Fix storage parameters ${param} as per the best practice for the selected database instance.`;
        }

        case request.url.includes('/optimize/storage-operating-system'): {
            if (body && body.configurationName) {
                param = storageOSDescriptions[body.configurationName];
            }
            return `Fix MPIO settings ${param} parameters as per the best practice for the selected database instance.`;
        }

        case request.url.includes('/optimize/resiliency'): {
            if (body && body.configurationName && body.configurationName.length > 0) {
                param = resiliencyDescriptions[body.configurationName[0]];
            }
            return `Fix resiliency ${param} parameters as per the best practice for the selected database instance.`;
        }

        case request.url.includes('/resiliency/aws-backup'): {
            return 'Fix backup configuration parameters as per the best practice for the selected database instance.';
        }
        default:
    }
};

export default getActionName;
