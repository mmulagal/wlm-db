import { WORKLOAD_FACTORY_ENDPOINT, HEADERS } from '../../utils/consts';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getWfServiceToken } from './auth';

const logger = getLogger();

async function registerWadManagerService() {
    logger.info('Registering service with WAD manager');

    const { token } = await getWfServiceToken();

    try {
        const response = await gotInstanceForInternalRequest
            .post('wad-manager/internal/v1/registration', {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                },
                json: {}
            })
            .json<{ status: string }>();

        logger.info('WAD manager registration accepted', { status: response.status });
        return response;
    } catch (error: unknown) {
        logger.error('WAD manager registration failed', { error });
    }
}

export { registerWadManagerService };
