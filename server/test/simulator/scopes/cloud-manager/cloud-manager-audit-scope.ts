import nock from 'nock';
import { CLOUD_MANAGER_SERVER_ADDRESS } from '../../../../src/utils/consts.js';

const cloudManagerAuditScope = nock(`${CLOUD_MANAGER_SERVER_ADDRESS}`)
    .persist(true)
    .post(/^\/audit\/(.+)/)
    .reply(() => [204, {}]);

export default cloudManagerAuditScope;
