import { generateSignedUrls } from '../../src/operations/template-operations';
import '../simulator/scopes/aws/s3-scope';
import '../simulator/scopes/aws/ec2-scope';
import '../simulator/scopes/aws/iam-scope';
import '../simulator/scopes/aws/secrets-manager-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/aws/kms-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/jwt-scope';
import '../simulator/scopes/cloud-manager/wlmdb-scope';
import { DEFAULT_AWS_REGION } from '../../src/utils/consts';
import { DatabaseTypes } from '../../src/utils/consts';

describe('template operations', () => {
    it('get signed urls', async () => {
        const resp = await generateSignedUrls(DEFAULT_AWS_REGION, DatabaseTypes.MS_SQL_SERVER);
        expect(resp).toBeDefined();
    });
});
