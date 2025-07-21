import { createResource, listResources } from '../../src/lib/database/db';
import { ResourceAssessmentData } from '../../src/utils/common-types';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, RESOURCE_DEFAULT_SELECT_FIELDS } from '../../src/utils/consts';
import { updateAssessmentErrorInResourceTable } from '../../src/utils/cont-opt-utils';
import { DEFAULT_AWS_CREDENTIALS_ID } from './consts';

const RESOURCE_ID = '6cbdabbfe3fb147e';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });
});

describe('Cont opt utils tests', () => {
    it(' Persist assessment error in database', async () => {
        const response = await updateAssessmentErrorInResourceTable(
            ACCOUNT_ID,
            RESOURCE_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'Error in compute assessment',
            'compute'
        );

        expect(response?.count).toEqual(1);

        const [{ assessment_data: assessmentData } = {}] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data', 'configurations']
            })) || [];
        const fetchedAssessmentData = assessmentData as unknown as ResourceAssessmentData;
        expect(fetchedAssessmentData?.errors?.compute).toEqual('Error in compute assessment');
    });
});
