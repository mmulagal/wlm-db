import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import ebsStorageCalulationsResponse from '../../responses/cloud-manager/ebs-storage-savings-calculation.json';
import ebsStorageManualCalulationsResponse from '../../responses/cloud-manager/ebs-storage-manual-calculation.json';
import storageInstancesList from '../../responses/cloud-manager/storage-service-instance-list.json';
import storageVolumesList from '../../responses/cloud-manager/storage-service-volumes-list.json';
import fsxwStorageManualCalulationsResponse from '../../responses/cloud-manager/fsxw-storage-manual-calculation.json';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`)
    .persist(true)
    .post(/^\/accounts\/(.+)\/marketing\/v2\/credentials\/(.+)\/regions\/(.+)\/ebs\/auto\/calculate$/)
    .reply(() => [200, ebsStorageCalulationsResponse])
    .post(/^\/accounts\/(.+)\/marketing\/v1\/ebs\/db\/calculate$/)
    .reply(() => [200, ebsStorageManualCalulationsResponse])
    .get(
        /^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/instances\?limit=50&offset=0&force=false$/
    )
    .reply(() => [200, storageInstancesList])
    .get(/^\/accounts\/(.+)\/marketing\/v1\/credentials\/(.+)\/regions\/(.+)\/instances\/(.+)\/ebs-volumes$/)
    .reply(() => [200, storageVolumesList])
    .post(/^\/accounts\/(.+)\/marketing\/v1\/fsxw\/calculate$/)
    .reply(() => [200, fsxwStorageManualCalulationsResponse]);
