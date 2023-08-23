import { RESOURCESTYPE } from '../utils/consts';
import { getTenancyResourcesByType, getTenancyResourcesByTypeAndId } from '../lib/cloud-manager/tenancy';
import getLogger from '../utils/logger';

const logger = getLogger();
async function getWorkingEnvironments() {
    const workingEnvironments: { id: string; provider: string; name?: string; state: string }[] = [];
    const mssqlCredentials = await getTenancyResourcesByType(RESOURCESTYPE.MSSQL);
    mssqlCredentials.forEach((credentials: any) => {
        let state = '';
        try {
            state =
                typeof credentials.metadata === 'string' && credentials.metadata.includes('state')
                    ? JSON.parse(credentials.metadata)
                    : 'initializing';
        } catch (error) {
            logger.error('Unable to parse JSON', error);
            state = 'initializing';
        }
        workingEnvironments.push({
            id: credentials.resourceIdentifier,
            provider: RESOURCESTYPE.MSSQL,
            name: credentials.name,
            state
        });
    });
    return workingEnvironments;
}

async function getWorkingEnvironment(id: string) {
    const tenancyResource = await getTenancyResourcesByTypeAndId(RESOURCESTYPE.MSSQL, id);
    if (tenancyResource) {
        switch (tenancyResource.resourceType) {
            case RESOURCESTYPE.MSSQL:
                return {
                    id: id,
                    serverName: '',
                    databasesCount: 0,
                    state: 'initializing'
                };
        }
    }
}

export { getWorkingEnvironments, getWorkingEnvironment };
