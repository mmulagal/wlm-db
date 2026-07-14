import { flatten, map } from 'lodash-es';
import throat from 'throat';
import { callProxyForwarder } from '../../lib/cloud-manager/proxy-forwarder';
import getLogger from '../../utils/logger';
import {
    COMBINED_OPTIMIZE_DESCRIPTORS,
    OptimizeStorageApiData,
    OptimizeStorageConfigs,
    QUERY_PARAMS,
    isCombinedOptimizeConfig
} from '../../utils/continous-optimization-consts';

const logger = getLogger();

const CONFIG_KEY_BY_ID: Record<string, string> = Object.fromEntries(
    Object.entries(OptimizeStorageConfigs).map(([key, value]) => [value, key])
);

interface OntapStorageFixParams {
    accountId: string;
    fsxId: string;
    region: string;
    svmName: string;
    configurationId: string;
    resourceIds: string[];
    value?: string;
}

interface OntapStorageFixResult {
    resourceId: string;
    success: boolean;
    failureReason?: string;
}

function buildOntapFixSearchParams(
    type: string,
    svmName: string,
    resourceIds: string[],
    configKey: string,
    value: string
): Record<string, string | number | boolean> {
    if (
        ['DEDUPLICATION', 'COMPACTION', 'EXPORT_POLICY'].includes(configKey) ||
        (value === 'none' && configKey === 'COMPRESSION')
    ) {
        return { svm: svmName, name: resourceIds.join('|') };
    }
    if (configKey === 'NFS_ROOTONLY') {
        return { vserver: svmName };
    }
    const queryParamKey = QUERY_PARAMS[type as keyof typeof QUERY_PARAMS] ?? type;
    return { vserver: svmName, [queryParamKey]: resourceIds.join(',') };
}

async function applyOntapStorageFix(params: OntapStorageFixParams): Promise<OntapStorageFixResult[]> {
    const { accountId, fsxId, region, svmName, configurationId, resourceIds, value = '' } = params;

    logger.info('Applying ONTAP storage fix via proxy', {
        accountId,
        fsxId,
        configurationId,
        resourceCount: resourceIds.length
    });

    const endpoint = `management.${fsxId}.fsx.${region}.amazonaws.com`;
    const base = { accountId, targetId: fsxId, endpoint };

    const configs = isCombinedOptimizeConfig(configurationId)
        ? COMBINED_OPTIMIZE_DESCRIPTORS[configurationId].components.map(({ configKey }) => ({
              configurationId: configKey,
              resourceIds
          }))
        : [{ configurationId, resourceIds }];

    const results = await Promise.all(
        configs.map(
            throat(3, async ({ configurationId: cfgId, resourceIds: ids }) => {
                const configKey = CONFIG_KEY_BY_ID[cfgId];
                if (!configKey) {
                    logger.warn('Unsupported configurationId', { cfgId });
                    return map(ids, id => ({
                        resourceId: id,
                        success: false,
                        failureReason: `Unsupported configurationId: ${cfgId}`
                    }));
                }

                const apiFn = OptimizeStorageApiData[configKey as keyof typeof OptimizeStorageApiData];
                const { api, body, type } = apiFn(value || undefined);
                const ontapPath = `api${api}`;

                try {
                    await callProxyForwarder({
                        ...base,
                        ontapPath,
                        method: 'PATCH',
                        body,
                        searchParams: buildOntapFixSearchParams(type, svmName, ids, configKey, value)
                    });
                    return map(ids, id => ({ resourceId: id, success: true }));
                } catch (err) {
                    const failureReason = err instanceof Error ? err.message : String(err);
                    logger.error('ONTAP PATCH failed', { cfgId, fsxId, failureReason });
                    return map(ids, id => ({ resourceId: id, success: false, failureReason }));
                }
            })
        )
    );

    return flatten(results);
}

export { applyOntapStorageFix };
