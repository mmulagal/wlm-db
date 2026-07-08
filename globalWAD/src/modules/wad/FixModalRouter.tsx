import type { WadElementProps } from '@tlveng/workload-factory-components';
import { MssqlConfigurationIds } from './configurations/mssqlConfigurationIds';
import { OracleConfigurationIds, OracleSharedConfigurationIds } from './configurations/oracleConfigurationIds';
import { FileSystemFixModalWrapper } from './fix-modals/wad/FileSystemFixModalWrapper';
import { VolumeFixModalWrapper } from './fix-modals/wad/VolumeFixModalWrapper';
import { FileSystemConfigurationIds } from './tables/file-system/configurations';
import { UnsupportedConfigurationNotice } from './shared/fixModalShared';

export { PlaceholderFixModal, UnsupportedConfigurationNotice } from './shared/fixModalShared';

const isSupportedConfiguration = (configurationId: string) =>
    MssqlConfigurationIds.has(configurationId) ||
    OracleConfigurationIds.has(configurationId) ||
    OracleSharedConfigurationIds.has(configurationId);

/**
 * Routes to the appropriate DB fix modal component based on `configurationId`.
 *
 * Supported MSSQL and Oracle configs → VolumeFixModalWrapper
 * File system configs → FileSystemFixModalWrapper
 * Unknown configs → UnsupportedConfigurationNotice
 */
export const FixModalRouter = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (isSupportedConfiguration(configurationId)) {
        return <VolumeFixModalWrapper wadApi={wadApi} />;
    }

    if (FileSystemConfigurationIds.has(configurationId)) {
        return <FileSystemFixModalWrapper wadApi={wadApi} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
