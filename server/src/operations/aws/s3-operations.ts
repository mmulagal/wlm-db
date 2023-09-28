import { LifecycleRule } from '@aws-sdk/client-s3';
import { getBucketLifecycleConfiguration, putBucketLifecycleConfiguration } from '../../lib/aws/s3';
import getLogger from '../../utils/logger';
import { BUCKET_NAME, ASSETS_BUCKET_REGION } from '../../utils/consts';

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
    logger.info('Checking and creating life cycle rule');
    const configurations = await getBucketLifecycleConfiguration(ASSETS_BUCKET_REGION, BUCKET_NAME);
    logger.debug('Existing configurations', configurations);
    const { Rules: currentLifecycleRules = [] } = configurations || {};
    const deletewlmdbRuleExists = currentLifecycleRules.some(
        (rule: LifecycleRule) => rule.ID && rule.ID === 'DeleteWlmdbFolders'
    );

    if (deletewlmdbRuleExists) {
        logger.debug('The rule "DeleteWlmdbFolders" already exists in the lifecycle configuration.');
        return;
    }

    const updatedLifecycleConfig = {
        Bucket: BUCKET_NAME,
        LifecycleConfiguration: { Rules: [...(currentLifecycleRules || []), newRule] }
    };

    const response = await putBucketLifecycleConfiguration(ASSETS_BUCKET_REGION, updatedLifecycleConfig);
    logger.debug('Created lifecycle configuration', response);
}
export { checkAndCreateBucketLifecycleConfiguration };
