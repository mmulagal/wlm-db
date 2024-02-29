import executeBatchApiCalls from '../../src/operations/batch-operations';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
// import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/batch-scope';

describe(
    'Batch operations',
    () => {
        it('Executing the batch api calls', async () => {
            const resp = await executeBatchApiCalls([
                {
                    url: 'https://staging.api.workloads.netapp.com/accounts/account-6S5xAetX/wlmdb/v1/mssql/resources/i-0880a21327284f67c/databases/RetailBanking/tables',
                    method: 'GET'
                },
                {
                    url: 'https://staging.api.workloads.netapp.com/accounts/account-6S5xAetX/wlmdb/v1/mssql/resources/i-0880a21327284f67c/databases/Amandaberg/tables',
                    method: 'GET'
                },
                {
                    url: 'https://staging.api.workloads.netapp.com/accounts/account-6S5xAetX/wlmdb/v1/mssql/resources/i-0880a21327284f67c/databases/Adamsview/tables',
                    method: 'GET'
                }
            ]);
            expect(resp).toBeDefined();
        });
    },
    {
        timeout: 10000
    }
);
