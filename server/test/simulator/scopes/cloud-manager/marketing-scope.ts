import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import ebsStorageCalulationsResponse from '../../responses/cloud-manager/ebs-storage-savings-calculation.json';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .post(/^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/ebs\/auto\/calculate$/)
    .reply(() => [200, ebsStorageCalulationsResponse]);
