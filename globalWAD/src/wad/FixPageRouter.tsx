import { TableScope, type WadElementProps } from '@tlveng/workload-factory-components';
import { LunResourcesTable } from './tables/lun/LunResourcesTable';
import { LunConfigurationIds } from './tables/lun/configurations';
import { VolumeResourcesTable } from './tables/volume/VolumeResourcesTable';
import { VolumeConfigurationIds } from './tables/volume/configurations';
import { UnsupportedTableNotice } from './shared/fixModalShared';

/**
 * Routes to the appropriate DB table component based on `configurationId`.
 *
 * Volume configs → VolumeResourcesTable
 * LUN configs → LunResourcesTable
 * Unknown configs → UnsupportedTableNotice
 */
export const FixPageRouter = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (VolumeConfigurationIds.has(configurationId)) {
        return <VolumeResourcesTable wadApi={wadApi} tableScope={TableScope.GLOBAL_WAD} />;
    }

    if (LunConfigurationIds.has(configurationId)) {
        return <LunResourcesTable wadApi={wadApi} tableScope={TableScope.GLOBAL_WAD} />;
    }

    return <UnsupportedTableNotice configurationId={configurationId} />;
};
