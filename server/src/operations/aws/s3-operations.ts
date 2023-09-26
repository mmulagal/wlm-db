import { LifecycleRule } from '@aws-sdk/client-s3';
import { getBucketLifecycleConfiguration, putBucketLifecycleConfiguration } from '../../lib/aws/s3';
import getLogger from '../../utils/logger';
import { TEMPLATES } from '../../utils/consts';

const logger = getLogger();

const newRule: LifecycleRule = {
    ID: 'DeleteWlmdbFolders',
    Prefix: 'wlmdb',
    Status: 'Enabled',
    NoncurrentVersionExpiration: {
        NoncurrentDays: 1
    },
    Expiration: {
        Days: 1
    }
};

async function checkAndCreateBucketLifecycleConfiguration() {
    const configurations = await getBucketLifecycleConfiguration(TEMPLATES.region, TEMPLATES.bucket);
    logger.debug('Existing configurations', configurations);
    const currentLifecycleConfig = configurations ?? { Rules: [] };
    const deletewlmdbRuleExists = currentLifecycleConfig?.Rules?.some(
        (rule: LifecycleRule) => rule.ID && rule.ID === 'DeleteWlmdbFolders'
    );

    if (deletewlmdbRuleExists) {
        logger.debug('The rule "DeleteWlmdbFolders" already exists in the lifecycle configuration.');
        return;
    }

    const updatedLifecycleConfig = {
        Bucket: TEMPLATES.bucket,
        LifecycleConfiguration: { Rules: [...(currentLifecycleConfig?.Rules || []), newRule] }
    };

    const response = await putBucketLifecycleConfiguration(TEMPLATES.region, updatedLifecycleConfig);
    logger.debug('Created lifecysle configuration', response);
}
export { checkAndCreateBucketLifecycleConfiguration };
