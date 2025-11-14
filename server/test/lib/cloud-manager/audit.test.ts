import sendAudit from '../../../src/lib/cloud-manager/audit';
import { TIMELINE_SERVICE_NAME } from '../../../src/utils/consts';

describe('Send Audits', () => {
    it('Send Audit Record', async () => {
        const response = await sendAudit({
            json: {
                auditGroup: {
                    startTime: Date.now(),
                    actionName: 'Test Action',
                    status: 'pending',
                    requestId: '123aver',
                    serviceName: TIMELINE_SERVICE_NAME,
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
