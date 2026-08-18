import {
    callWlmHostsGraphql,
    EC2_DATABASE_INSTANCES_QUERY,
    EC2_STORAGE_ORACLE_MSSQL_QUERY
} from '../../../src/lib/cloud-manager/tagging-service';
import { ACCOUNT_ID } from '../../utils/consts';

describe('Tagging service lib', () => {
    const credentialsId = '61e20ee2-b623-47fc-9dde-df61c49a1064';
    const region = 'ap-southeast-1';

    describe('callWlmHostsGraphql', () => {
        it('Returns the graphql data envelope for the EC2-storage query', async () => {
            const response = await callWlmHostsGraphql<{ relationships?: unknown[]; ec2Instances?: unknown[] }>(
                ACCOUNT_ID,
                credentialsId,
                region,
                EC2_STORAGE_ORACLE_MSSQL_QUERY
            );
            expect(response.relationships).toBeDefined();
            expect(response.ec2Instances).toBeDefined();
        });

        it('Returns the graphql data envelope for the EC2 database instances query', async () => {
            const response = await callWlmHostsGraphql<{ ec2Instances?: unknown[] }>(
                ACCOUNT_ID,
                credentialsId,
                region,
                EC2_DATABASE_INSTANCES_QUERY
            );
            expect(response.ec2Instances).toBeDefined();
        });
    });
});
