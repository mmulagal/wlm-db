import nock from 'nock';
import { CLOUD_MANAGER_ENDPOINT } from '../../../../src/utils/consts';
import { faker } from '@faker-js/faker';

nock(`${CLOUD_MANAGER_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post(/^\/accounts\/[a-zA-Z0-9-]+\/links\/v1\/links$/, {
        type: 'ssm',
        name: 'name',
        arn: 'arn',
        tags: [],
        ssmAgentInfo: {
            credentialsId: 'credentialsId',
            osType: 'linux'
        }
    })
    .reply(() => [
        200,
        {
            id: faker.string.uuid(),
            name: faker.string.alphanumeric(10)
        }
    ])
    .post(/^\/accounts\/[a-zA-Z0-9-]+\/links\/v1\/links$/, {
        type: 'ssm',
        name: 'name',
        arn: 'invalid arn',
        tags: [],
        ssmAgentInfo: {
            credentialsId: 'credentialsId',
            osType: 'linux'
        }
    })
    .reply(500, { errorMessage: 'Internal server error' });
