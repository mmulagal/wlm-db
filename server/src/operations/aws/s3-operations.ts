import { LifecycleRule } from '@aws-sdk/client-s3';
import { getBucketLifecycleConfiguration, putBucketLifecycleConfiguration } from '../../lib/aws/s3';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION, ARTIFACT_BUCKET_NAME } from '../../utils/consts';

const logger = getLogger();

const newRule: LifecycleRule = {
    Expiration: {
        Days: 7
    },
    ID: 'DeleteWlmdbFolders',
    Filter: {
        Prefix: 'WLMDB'
    },
    Status: 'Enabled',
    NoncurrentVersionExpiration: {
        NoncurrentDays: 1
    }
};

async function checkAndCreateBucketLifecycleConfiguration() {
    logger.info('Checking and creating life cycle rule');
    const configurations = await getBucketLifecycleConfiguration(DEFAULT_AWS_REGION, ARTIFACT_BUCKET_NAME);
    logger.debug('Existing configurations', configurations);
    const { Rules: currentLifecycleRules = [] } = configurations || {};
    const deletewlmdbRuleExists = currentLifecycleRules.some(
        (rule: LifecycleRule) => rule.ID && rule.ID === 'DeleteWlmdbFolders'
    );

    if (deletewlmdbRuleExists) {
        logger.debug('The rule NewDeleteWlmdbFolders already exists in the lifecycle configuration.');
        return;
    }

    const updatedLifecycleConfig = {
        Bucket: ARTIFACT_BUCKET_NAME,
        LifecycleConfiguration: { Rules: [...(currentLifecycleRules || []), newRule] }
    };

    const response = await putBucketLifecycleConfiguration(DEFAULT_AWS_REGION, updatedLifecycleConfig);
    logger.debug('Created lifecycle configuration', response);
}
export { checkAndCreateBucketLifecycleConfiguration };
