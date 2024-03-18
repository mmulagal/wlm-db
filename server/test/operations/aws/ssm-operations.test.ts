import { faker } from '@faker-js/faker';
import {
    executeSSMDocument,
    getFSxOntapRegionsList,
    ssmPutParameters
} from '../../../src/operations/aws/ssm-operations';
import { SSM_PARAMS, DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import { SSMParamterObject } from '../../../src/utils/common-types';

const credentialsId = `${faker.string.alpha(20)}`;

describe('executeSsmDocument', () => {
    it('executeSsmDocument', async () => {
        const resp = await executeSSMDocument(credentialsId, 'ap-southeast-1', SSM_PARAMS);
        expect(resp).toBeDefined();
    });

    it('List of Amazon FSx for NetApp ONTAP regions', async () => {
        const fsxOntapRegionsResponse = {
            regions: [
                {
                    regionCode: 'af-south-1',
                    regionName: 'Africa (Cape Town)'
                },
                {
                    regionCode: 'ap-south-2',
                    regionName: 'Asia Pacific (Hyderabad)'
                },
                {
                    regionCode: 'ap-southeast-1',
                    regionName: 'Asia Pacific (Singapore)'
                },
                {
                    regionCode: 'ap-southeast-2',
                    regionName: 'Asia Pacific (Sydney)'
                },
                {
                    regionCode: 'eu-north-1',
                    regionName: 'Europe (Stockholm)'
                },
                {
                    regionCode: 'eu-west-3',
                    regionName: 'Europe (Paris)'
                },
                {
                    regionCode: 'il-central-1',
                    regionName: 'Israel (Tel Aviv)'
                },
                {
                    regionCode: 'us-east-2',
                    regionName: 'US East (Ohio)'
                },
                {
                    regionCode: 'us-west-2',
                    regionName: 'US West (Oregon)'
                },
                {
                    regionCode: 'ap-east-1',
                    regionName: 'Asia Pacific (Hong Kong)'
                },
                {
                    regionCode: 'ap-northeast-1',
                    regionName: 'Asia Pacific (Tokyo)'
                },
                {
                    regionCode: 'ap-northeast-2',
                    regionName: 'Asia Pacific (Seoul)'
                },
                {
                    regionCode: 'ap-southeast-3',
                    regionName: 'Asia Pacific (Jakarta)'
                },
                {
                    regionCode: 'eu-central-1',
                    regionName: 'Europe (Frankfurt)'
                },
                {
                    regionCode: 'eu-central-2',
                    regionName: 'Europe (Zurich)'
                },
                {
                    regionCode: 'eu-south-2',
                    regionName: 'Europe (Spain)'
                },
                {
                    regionCode: 'eu-west-2',
                    regionName: 'Europe (London)'
                },
                {
                    regionCode: 'me-south-1',
                    regionName: 'Middle East (Bahrain)'
                },
                {
                    regionCode: 'sa-east-1',
                    regionName: 'South America (Sao Paulo)'
                },
                {
                    regionCode: 'ap-south-1',
                    regionName: 'Asia Pacific (Mumbai)'
                },
                {
                    regionCode: 'ap-southeast-4',
                    regionName: 'Asia Pacific (Melbourne)'
                },
                {
                    regionCode: 'ca-central-1',
                    regionName: 'Canada (Central)'
                },
                {
                    regionCode: 'eu-south-1',
                    regionName: 'Europe (Milan)'
                },
                {
                    regionCode: 'eu-west-1',
                    regionName: 'Europe (Ireland)'
                },
                {
                    regionCode: 'me-central-1',
                    regionName: 'Middle East (UAE)'
                },
                {
                    regionCode: 'us-east-1',
                    regionName: 'US East (N. Virginia)'
                },
                {
                    regionCode: 'us-west-1',
                    regionName: 'US West (N. California)'
                },
                {
                    regionCode: 'ap-northeast-3',
                    regionName: 'Asia Pacific (Osaka)'
                }
            ]
        };

        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;

        const response = await getFSxOntapRegionsList(credentialsType);
        expect(response).toEqual(fsxOntapRegionsResponse);
    });

    it('Put parameters in ssm parameter store', async () => {
        const params: SSMParamterObject[] = [
            {
                path: 'netapp/wlmdb/fs-1234',
                value: {
                    fsx: {
                        username: 'username',
                        password: 'SQLdev'
                    }
                }
            },
            {
                path: 'netapp/wlmdb/i-5678',
                value: {
                    sql: [
                        {
                            username: 'username',
                            password: 'SQLdev',
                            sqlinstancename: 'SQLinstanceName1'
                        },
                        {
                            username: 'username',
                            password: 'SQLdev',
                            sqlinstancename: 'SQLinstanceName2'
                        }
                    ]
                }
            }
        ];

        const response = await ssmPutParameters(credentialsId, 'us-east-1', params);
        expect(response).toBeUndefined();
    });
});
