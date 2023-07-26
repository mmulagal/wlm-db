import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/iam-scope';
import { getPermissionsList } from '../../../src/lib/aws/iam';
import { SNS } from '../../../src/utils/consts';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const REGION = 'us-east-1';

describe('List permissions required', () => {
    it('list permissions required to deploy the stack - with all resources', async () => {
        const { permissions } = await getPermissionsList(CREDENTIALS_ID, REGION);
        expect(permissions).toBeDefined();
    });

    it('list permissions required to deploy the stack - with skipped resources', async () => {
        const { permissions } = await getPermissionsList(CREDENTIALS_ID, REGION, [SNS]);
        let isSnsFound = false;

        for (const perm of permissions) {
            if (perm.includes(SNS)) {
                isSnsFound = true;
                break;
            }
        }

        expect(isSnsFound).toBe(false);
    });
});
