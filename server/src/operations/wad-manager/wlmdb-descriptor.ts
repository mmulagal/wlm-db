import { uniqBy } from 'lodash-es';
import getLogger from '../../utils/logger';
import { TEMPLATE_BUCKET_REGION, WAD_MANAGER_BUCKET_NAME } from '../../utils/consts';
import { putObjectBucket } from '../../lib/aws/s3';
import { registerWadManagerService } from '../../lib/cloud-manager/wad-manager';
import { MSSQL_GOLDEN_CONFIG } from '../continuous-optimization/mssql/golden-config';
import ORACLE_GOLDEN_CONFIG from '../continuous-optimization/oracle/golden-config';

const SERVICE_ID = 'wlmdb';
const SERVICE_VERSION = '1.0.0';
const DESCRIPTOR_KEY = `${SERVICE_ID}/${SERVICE_ID}.json`;

const logger = getLogger();

async function buildAndPublishWlmdbDescriptor() {
    logger.info('Building wlmdb WAD descriptor for version:', { serviceVersion: SERVICE_VERSION });
    const configurations = uniqBy(
        [...MSSQL_GOLDEN_CONFIG, ...ORACLE_GOLDEN_CONFIG]
            .filter(({ globalWadApplicable }) => globalWadApplicable)
            .flatMap(({ id, name, recommendation, severity, categories, resourceType, metadata }) => [
                {
                    configurationId: `${SERVICE_ID}-${id}`,
                    name,
                    description: recommendation,
                    severity: severity.toLocaleUpperCase(),
                    resourceType:
                        resourceType === 'Volume/Block device'
                            ? 'BLOCK_DEVICE'
                            : resourceType
                            ? resourceType?.replace(/\s+/g, '_').toLocaleUpperCase()
                            : '',
                    categories: categories.map(c => c.replace(/\s+/g, '_').toLocaleUpperCase()),
                    ...(metadata && { metadata })
                }
            ]),
        'configurationId'
    );

    const descriptor = {
        serviceId: SERVICE_ID,
        serviceType: 'FSX_FOR_ONTAP',
        scheduledScanCronJob: '0 2 * * *',
        // requiresSimIsolation: true,
        configurations
    };

    await putObjectBucket(TEMPLATE_BUCKET_REGION, WAD_MANAGER_BUCKET_NAME, DESCRIPTOR_KEY, JSON.stringify(descriptor));
    logger.info('WAD descriptor built successfully');

    await registerWadManagerService();
    logger.info('WLMDB service registation initiated with WAD manager');
}

export { buildAndPublishWlmdbDescriptor };
