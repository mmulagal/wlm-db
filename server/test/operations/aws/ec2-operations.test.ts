import { faker } from '@faker-js/faker';
import {
    getAmiList,
    getVpcsList,
    getFSxAvailableRegionsList,
    getKeyPairsList
} from '../../../src/operations/aws/ec2-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION } from '../../../../server/src/utils/consts';

const WINDOWS = 'windows';
const SQL = 'sql';

describe('EC2 Operations', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;
        const resp = await getAmiList(credentialsType, DEFAULT_AWS_REGION, WINDOWS, SQL);
        expect(resp).toBeDefined();
    });

    it('list of vpc', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getVpcsList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });
});

describe('List AWS regions supporting Amazon FSx for NetApp ONTAP', () => {
    it('List of Amazon FSx for NetApp ONTAP regions', async () => {
        const fsxRegionsResponse = {
            regions: [
                {
                    regionCode: 'ap-south-2',
                    regionName: 'Asia Pacific (Hyderabad)'
                },
                {
                    regionCode: 'ap-south-1',
                    regionName: 'Asia Pacific (Mumbai)'
                },
                {
                    regionCode: 'eu-south-1',
                    regionName: 'Europe (Milan)'
                },
                {
                    regionCode: 'eu-south-2',
                    regionName: 'Europe (Spain)'
                },
                {
                    regionCode: 'me-central-1',
                    regionName: 'Middle East (UAE)'
                },
                {
                    regionCode: 'ca-central-1',
                    regionName: 'Canada (Central)'
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
                    regionCode: 'us-west-1',
                    regionName: 'US West (N. California)'
                },
                {
                    regionCode: 'us-west-2',
                    regionName: 'US West (Oregon)'
                },
                {
                    regionCode: 'af-south-1',
                    regionName: 'Africa (Cape Town)'
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
                    regionCode: 'eu-west-2',
                    regionName: 'Europe (London)'
                },
                {
                    regionCode: 'eu-west-1',
                    regionName: 'Europe (Ireland)'
                },
                {
                    regionCode: 'ap-northeast-2',
                    regionName: 'Asia Pacific (Seoul)'
                },
                {
                    regionCode: 'me-south-1',
                    regionName: 'Middle East (Bahrain)'
                },
                {
                    regionCode: 'ap-northeast-1',
                    regionName: 'Asia Pacific (Tokyo)'
                },
                {
                    regionCode: 'sa-east-1',
                    regionName: 'South America (Sao Paulo)'
                },
                {
                    regionCode: 'ap-east-1',
                    regionName: 'Asia Pacific (Hong Kong)'
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
                    regionCode: 'ap-southeast-3',
                    regionName: 'Asia Pacific (Jakarta)'
                },
                {
                    regionCode: 'ap-southeast-4',
                    regionName: 'Asia Pacific (Melbourne)'
                },
                {
                    regionCode: 'us-east-1',
                    regionName: 'US East (N. Virginia)'
                },
                {
                    regionCode: 'us-east-2',
                    regionName: 'US East (Ohio)'
                }
            ]
        };

        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;

        const response = await getFSxAvailableRegionsList(credentialsType);
        expect(response).toEqual(fsxRegionsResponse);
    });
});

describe('List key-pairs for a given region', () => {
    it('List of key-pairs for a given region', async () => {
        const keyPairsResponse = {
            keyPairs: [
                {
                    id: 'key-04f1051b36abc1204',
                    name: 'occm_qa'
                },
                {
                    id: 'key-06265c604f218fdef',
                    name: 'kanikaj_key'
                },
                {
                    id: 'key-0a03292a613b2664a',
                    name: 'nithin_xcp_sg'
                },
                {
                    id: 'key-068f2936f9d8832d0',
                    name: 'sonamy_key'
                },
                {
                    id: 'key-0f0fe217f3d4ebbd8',
                    name: 'mshreyas'
                },
                {
                    id: 'key-0e5dc6e98586e1c33',
                    name: 'Shri_Key'
                },
                {
                    id: 'key-01a3bbe0d86f50d64',
                    name: 'mshreyas_key'
                },
                {
                    id: 'key-05443864696a2e0e1',
                    name: 'krithi_key'
                },
                {
                    id: 'key-0d591bc32a2d90343',
                    name: 'rranga-key-pair'
                },
                {
                    id: 'key-031d0d4e6255adefb',
                    name: 'nithin_dbs'
                },
                {
                    id: 'key-0202510d315019a51',
                    name: 'krithi_new_key'
                }
            ]
        };

        const response = await getKeyPairsList(DEFAULT_AWS_CREDENTIALS_TYPE, DEFAULT_AWS_REGION);
        expect(response).toEqual(keyPairsResponse);
    });
});
