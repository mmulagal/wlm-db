import { faker } from '@faker-js/faker';
import { executeSSMDocument, getFSxOntapRegionsList } from '../../../src/operations/aws/ssm-operations';
import { SSM_PARAMS, DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';

describe('executeSsmDocument', () => {
    it('executeSsmDocument', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;

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
                    regionCode: 'us-gov-west-1',
                    regionName: 'AWS GovCloud (US-West)'
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
                    regionCode: 'us-gov-east-1',
                    regionName: 'AWS GovCloud (US-East)'
                },
                {
                    regionCode: 'us-west-1',
                    regionName: 'US West (N. California)'
                }
            ]
        };

        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;

        const response = await getFSxOntapRegionsList(credentialsType);
        expect(response).toEqual(fsxOntapRegionsResponse);
    });
});
