import { TableScope, type WadElementProps } from '@tlveng/workload-factory-components';
import { VolumeResourcesTable } from './tables/volume/VolumeResourcesTable';
import { VolumeConfigurationIds } from './tables/volume/configurations';
import { UnsupportedTableNotice } from './shared/fixModalShared';

/**
 * Routes to the appropriate DB table component based on `configurationId`.
 *
 * Volume configs → VolumeResourcesTable
 * File system configs → FileSystemResourcesTable
 * Unknown configs → UnsupportedTableNotice
 */
export const FixPageRouter = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (VolumeConfigurationIds.has(configurationId)) {
        return <VolumeResourcesTable wadApi={wadApi} tableScope={TableScope.GLOBAL_WAD} />;
    }

    return <UnsupportedTableNotice configurationId={configurationId} />;
};
