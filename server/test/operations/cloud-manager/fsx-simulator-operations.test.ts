import nock from 'nock';
import { listSimulatedFsxFileSystems } from '../../../src/operations/cloud-manager/fsx-simulator-operations';
import { SECRETS, WORKLOAD_FACTORY_ENDPOINT } from '../../../src/utils/consts';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { genericDecryptedCredentials } from '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';

describe('FSx simulator operations', () => {
    describe('listSimulatedFsxFileSystems', () => {
        const arnPath = genericDecryptedCredentials.metadata.arn.replace(/\//g, '-');
        const describePath = `/simulator/v1/aws/arn/${arnPath}/region/${DEFAULT_AWS_REGION}/FSX/DescribeFileSystems`;

        beforeEach(() => {
            SECRETS.SIMULATOR_AUTH = 'simulator-secret';
        });

        it('follows NextToken across pages and returns every file system', async () => {
            const scope = nock(WORKLOAD_FACTORY_ENDPOINT)
                .post(describePath, (body: { NextToken?: string }) => !body?.NextToken)
                .reply(200, {
                    FileSystems: [{ FileSystemId: 'fs-page-1', Lifecycle: 'AVAILABLE' }],
                    NextToken: 'token-page-2'
                })
                .post(describePath, (body: { NextToken?: string }) => body?.NextToken === 'token-page-2')
                .reply(200, {
                    FileSystems: [{ FileSystemId: 'fs-page-2', Lifecycle: 'AVAILABLE' }],
                    NextToken: null
                });

            const fileSystems = await listSimulatedFsxFileSystems(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION);

            expect(scope.isDone()).toBe(true);
            expect(fileSystems.map(({ id }) => id)).toEqual(['fs-page-1', 'fs-page-2']);
        });
    });
});
