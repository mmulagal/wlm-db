import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import getLogger from '../utils/logger';
import { getEc2SqlParameters } from './aws/ssm-operations';
import { DEFAULT_INSTANCE_NAME, HttpErrorCodes } from '../utils/consts';
import { SqlCredential } from '../utils/common-types';
import registerUbrCredentials from '../lib/cloud-manager/ubr';
import { generateSqlResourceId } from '../utils/utils';
import {
    GenerateUbrCredentialsBodyType,
    GenerateUbrCredentialsResponseType
} from '../routes/types/ubr-protection.types';
import { CredentialsIdParamsType } from '../routes/types/generic.types';

const logger = getLogger();

async function generateUbrCredentials({
    accountId,
    region,
    credentialsId,
    ec2InstanceIds,
    sqlInstanceName,
    ...rest
}: GenerateUbrCredentialsBodyType & CredentialsIdParamsType): Promise<GenerateUbrCredentialsResponseType> {
    logger.info('Generating UBR credentials for region:', {
        accountId,
        region,
        credentialsId,
        ec2InstanceIds,
        sqlInstanceName,
        ...rest
    });

    const credentialsFromStore = await Promise.all(
        ec2InstanceIds.map(ec2InstanceId => getEc2SqlParameters(credentialsId, region, ec2InstanceId))
    );

    const { domain: domainCredentials = [] } = credentialsFromStore.find(({ domain }) => !isEmpty(domain)) || {};
    const { username, password } =
        domainCredentials.find(
            ({ sqlinstancename }: SqlCredential) =>
                sqlinstancename === sqlInstanceName || sqlinstancename === DEFAULT_INSTANCE_NAME
        ) || {};

    if (!username || !password) {
        const errorMessage = `No valid SQL credentials found for ec2InstanceIds: ${ec2InstanceIds.join(
            ', '
        )} in SSM Parameter store.`;
        logger.error(errorMessage);

        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { workspaceId, connectorId, resourceId } = rest;
    try {
        const response = await registerUbrCredentials({
            accountId,
            workspaceId,
            connectorId,
            sqlInstanceName: sqlInstanceName || DEFAULT_INSTANCE_NAME,
            username,
            password,
            resourceId: resourceId || generateSqlResourceId(ec2InstanceIds[0], ec2InstanceIds[1])
        });
        return response;
    } catch (error: any) {
        logger.error('Error registering UBR credentials:', { error, accountId, region, credentialsId });
        throw createError(HttpErrorCodes.PRECONDITION_FAILED, `Failed to register UBR credentials: ${error.message}`);
    }
}

export { generateUbrCredentials };
