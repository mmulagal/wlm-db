import { BASE_URL, generateResponse } from '../utils/appUtils';
import Connectors from '../data/listConnector.json';
import listHosts from '../data/listExistingHosts.json';
import RBACList from '../data/rbacList.json';
import WorkSpaceID from '../data/workSpaceID.json';
import ScJobResponse from '../data/scJobResponse.json';
import ScInstancesResponse from '../data/scInstancesResponse.json';

const router = require('express').Router();

router.get('/agents-mgmt/list-connectors/:accountID', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, Connectors);
    }, 100);
});

router.get('/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, listHosts);
    }, 500);
});

router.get('v1/management/organizations', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            continue: '8e5da794-7f36-11f0-8d12-a2501b99603f',
            count: 3,
            items: [
                {
                    id: 'bd234f89-fa36-40ea-af7f-e19fd1e557f4',
                    isSystem: 'false',
                    legacyId: 'account-7vtgzuqC',
                    links: [],
                    name: 'Pepsi',
                    ownerOrganizationId: 'bd234f89-fa36-40ea-af7f-e19fd1e557f4',
                    resourceClass: 'hierarchy',
                    resourceType: 'organization',
                    tags: [
                        {
                            'internal:bxp:organizationId': 'bd234f89-fa36-40ea-af7f-e19fd1e557f4'
                        }
                    ],
                    type: 'application/vnd.netapp.bxp.resource',
                    version: '1.0'
                },
                {
                    id: '331ce875-f61c-4c9d-a66b-da7983e80ec9',
                    isSystem: 'false',
                    legacyId: 'account-LFMeoEkf',
                    links: [],
                    name: 'coke',
                    ownerOrganizationId: '331ce875-f61c-4c9d-a66b-da7983e80ec9',
                    resourceClass: 'hierarchy',
                    resourceType: 'organization',
                    tags: [
                        {
                            'internal:bxp:organizationId': '331ce875-f61c-4c9d-a66b-da7983e80ec9'
                        }
                    ],
                    type: 'application/vnd.netapp.bxp.resource',
                    version: '1.0'
                },
                {
                    id: '2ec075d0-508a-402d-9ea2-f5f6b129d49b',
                    isSystem: 'false',
                    legacyId: 'account-hlEG9ik1',
                    links: [],
                    name: 'juliad',
                    ownerOrganizationId: '2ec075d0-508a-402d-9ea2-f5f6b129d49b',
                    resourceClass: 'hierarchy',
                    resourceType: 'organization',
                    tags: [
                        {
                            'internal:bxp:organizationId': '2ec075d0-508a-402d-9ea2-f5f6b129d49b'
                        }
                    ],
                    type: 'application/vnd.netapp.bxp.resource',
                    version: '1.0'
                }
            ]
        });
    }, 500);
});

router.get('/fsx-ontap/working-environments/:accountID', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, [
            {
                id: 'fs-0d5efc3057c4f12cb',
                name: 'wlmdb-fsx-1',
                deploymentType: 'MULTI_AZ_1',
                region: 'ap-southeast-1',
                autoScale: false
            }
        ]);
    }, 500);
});

router.get('/v1/management/organizations/:accountID/users', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, RBACList);
    }, 500);
});

router.get('/v1/management/organizations/:accountID/resources', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, WorkSpaceID);
    }, 10);
});

router.get(
    '/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts/:hostID/drives',
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, {
                diskInfos: [
                    {
                        owner: 'stvym46.wlmqaauto.com',
                        path: 'D:\\'
                    },
                    {
                        owner: 'stvym46.wlmqaauto.com',
                        path: 'E:\\'
                    },
                    {
                        owner: 'stvym46.wlmqaauto.com',
                        path: 'L:\\'
                    },
                    {
                        owner: 'stvym46.wlmqaauto.com',
                        path: 'S:\\'
                    },
                    {
                        owner: 'stvym46.wlmqaauto.com',
                        path: 'T:\\'
                    }
                ],
                errorMessage: ''
            });
        }, 10);
    }
);

router.get('/backup-recovery/organizations/:accountID/v1/workloads/sql/databases', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            databases: [],
            totalCount: 2,
            errorMessage: ''
        });
    }, 10);
});

router.get('/backup-recovery/organizations/:accountID/v1/workloads/sql/instances', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ScInstancesResponse);
    }, 10);
});

router.post(
    '/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts/:hostID/configurelogdirectory',
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, {
                message: 'Configured log backup folder as D:\\MSSQL\\ for host: stvym46.wlmqaauto.com.'
            });
        }, 10);
    }
);

router.post(
    '/accounts/:accountID/fsx/v2/credentials/:credentialID/regions/:regionID/bluexp/register-file-systems',
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, [
                {
                    id: 'fs-0d5efc3057c4f12cb',
                    credentialsId: '523b6e25-e01c-4397-9adb-c9a4b8f987d6',
                    region: 'ap-southeast-1',
                    name: 'wlmdb-fsx-1',
                    deploymentType: 'MULTI_AZ'
                }
            ]);
        }, 10);
    }
);

router.post(
    '/v1/management/organizations/:accountID/roles/381a2b6e-693b-4829-95a5-fbd753db30c7/users',
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, '');
        }, 100);
    }
);

router.post(
    `${BASE_URL}/v1/ubr-protection/credentials/:credentialsID/regions/:regionID/ubr-credentials`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, {
                credentialsId: '523b6e25-e01c-4397-9adb-c9a4b8f987d6'
            });
        }, 10);
    }
);

router.get(
    `${BASE_URL}/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/credentials/exists`,
    async (req: {}, res: any) => {
        setTimeout(() => {
            generateResponse(res, 200, {
                exists: false
            });
        }, 10);
    }
);

// Job api call - add host
router.post('/backup-recovery/organizations/:accountID/v1/workloads/sql/hosts', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, {
            jobId: 'f662093f-9f26-4b88-ba12-4c57e656922f',
            jobUrl: 'https://staging.api.bluexp.netapp.com/cbs-backend/api/account/8b037670-92c8-480a-9ddd-d0bbfd1b18cb/v1/jobs/f662093f-9f26-4b88-ba12-4c57e656922f',
            errorMessage: ''
        });
        // generateResponse(res, 400, {message: 'Some error occurred while adding host'});
    }, 100);
});

router.get('/cbs-backend/api/account/:accountID/v1/jobs/:jobID', async (req: {}, res: any) => {
    setTimeout(() => {
        generateResponse(res, 200, ScJobResponse);
    }, 500);
});

export default router;
