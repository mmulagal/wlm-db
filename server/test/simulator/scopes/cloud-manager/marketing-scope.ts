import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import ebsStorageCalulationsResponse from '../../responses/cloud-manager/ebs-storage-savings-calculation.json';
import storageInstancesList from '../../responses/cloud-manager/storage-service-instance-list.json';
import storageVolumesList from '../../responses/cloud-manager/storage-service-volumes-list.json';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .post(/^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/ebs\/auto\/calculate$/)
    .reply(() => [200, ebsStorageCalulationsResponse])
    .get(
        /^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/instances\?limit=50&offset=0&force=false$/
    )
    .reply(() => [200, storageInstancesList])
    .get(/^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/instances\/(.+)\/ebs-volumes$/)
    .reply(() => [200, storageVolumesList]);
