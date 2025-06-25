import getLogger from '../../utils/logger';
import { getDatabaseHostSummaryV2 } from '../database-hosts-operations';
import { execAwsdac, generateDiagramDefinition } from '../../lib/awsdac/diagram-definition';
import { DatabaseHostSummaryForMultiInstanceResponseType } from '../../routes/types/database-hosts.types';

const logger = getLogger();

async function getDiagramOfDatabaseHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    requestId?: string
) {
    logger.info('Fetching diagram for database host', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        requestId
    });

    let response: DatabaseHostSummaryForMultiInstanceResponseType;
    try {
        response = await getDatabaseHostSummaryV2(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            'nodeTopology,databaseInstanceTopology'
        );
    } catch (error) {
        logger.error('Error fetching database host summary', { error });
        return { error: `Failed to fetch database host summary; ${error}` };
    }

    const { nodeTopology, databaseInstancesSummary } = response;

    if (
        !nodeTopology ||
        !databaseInstancesSummary ||
        databaseInstancesSummary.length === 0 ||
        !nodeTopology.ec2Details ||
        nodeTopology.ec2Details.length === 0
    ) {
        logger.warn('No database instances found for the given database host', { databaseHostId });
        return { error: `No database instances found for the given database host: ${databaseHostId}` };
    }

    const diagramDefn = generateDiagramDefinition(nodeTopology, databaseInstancesSummary);
    return execAwsdac(diagramDefn, requestId);
}

export default getDiagramOfDatabaseHost;
