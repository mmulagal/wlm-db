import '../../simulator/scopes/cloud-manager/cloud-manager-audit-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import sendAudit from '../../../src/lib/cloud-manager/audit';
import { WLMDB } from '../../../src/utils/consts';

describe('Send Audits', () => {
    it('Send Audit Record', async () => {
        const response = await sendAudit({
            json: {
                auditGroup: {
                    startTime: Date.now(),
                    actionName: 'Test Action',
                    status: 'pending',
                    requestId: '123aver',
                    serviceName: WLMDB,
                    version: '1.0',
                    requestData: '',
                    principalId: '6132342abag0099',
                    referrer: 'test'
                }
            }
        });

        expect(response).toBeDefined();
    });
});
