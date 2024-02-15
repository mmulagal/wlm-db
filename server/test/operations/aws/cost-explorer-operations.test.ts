import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/cost-explorer-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { calculateBilling } from '../../../src/operations/aws/cost-explorer-operations';
import { UsageCostResponseType } from '../../../src/routes/types/database-hosts.types';
import { Metadata } from '../../../src/utils/common-types';

describe('Cost explorer Operations', () => {
    it('calculate billing using cost explorer', async () => {
        const resource = {
            id: '01c175c1-d0ca-499b-9ec4-149537052215',
            account_id: 'account-aHP3esT5',
            resource_id: 'ef64034c99d904da4619494eb33dd1c0ffeadda32a8e3e403912bce8ec5e6377',
            resource_name: 'sqldbapcbv\t\t\t',
            resource_type: 'MSSQL',
            co_relation_id: 'fs-0d5efc3057c4f12cb',
            cloud_provider_account_id: '464262061435',
            cloud_provider_name: 'AWS',
            region: 'ap-southeast-1',
            credentials_id: '22fcbfda-2a9b-41b5-901e-256c1aab4eb4',
            storage_typt: 'FSXN',
            metadata: {
                fsxSecret: 'WLMDB-SqlFciStack-1700643938368-fsx',
                fileSystemType: 'FSx for ONTAP',
                domainAdminSecret: 'WLMDB-SqlFciStack-1700643938368-domain',
                sqlDeploymentType: 'FCI',
                node1InstanceId: 'i-07a29eb681ba37679',
                node2InstanceId: 'i-0c267a9f8a4d3008e',
                sqlServiceAccountSecret: 'WLMDB-SqlFciStack-1700643938368-sql'
            }
        };

        const { region, co_relation_id: fileSystemId, credentials_id: credentialsId, metadata } = resource;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

        const costExplorerResponse: UsageCostResponseType = {
            compute: 118.7759587606,
            storage: 118.7759587606,
            estimationType: 'billing',
            connectivity: 0,
            others: 0
        };

        const billingResponse = await calculateBilling(
            credentialsId,
            region,
            fileSystemId,
            node1InstanceId,
            node2InstanceId
        );
        expect(billingResponse).toEqual(costExplorerResponse);
    });
});
