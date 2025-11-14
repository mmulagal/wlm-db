import executeBatchApiCalls from '../../src/operations/batch-operations';

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
