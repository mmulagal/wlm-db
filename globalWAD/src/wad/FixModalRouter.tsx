import type { WadElementProps } from '@tlveng/workload-factory-components/wad';
import { FileSystemFixModalWrapper } from './fix-modals/wad/FileSystemFixModalWrapper';
import { LunFixModalWrapper } from './fix-modals/wad/LunFixModalWrapper';
import { VolumeFixModalWrapper } from './fix-modals/wad/VolumeFixModalWrapper';
import { UnsupportedConfigurationNotice } from './shared/fixModalShared';
import { FileSystemConfigurationIds } from './tables/filesystem/configurations';
import { LunConfigurationIds } from './tables/lun/configurations';
import { VolumeConfigurationIds } from './tables/volume/configurations';

export { PlaceholderFixModal, UnsupportedConfigurationNotice } from './shared/fixModalShared';

/**
 * Routes to the appropriate DB fix modal component based on `configurationId`.
 *
 * Volume configs → VolumeFixModalWrapper
 * LUN configs → LunFixModalWrapper
 * File system configs → FileSystemFixModalWrapper
 * Unknown configs → UnsupportedConfigurationNotice
 */
export const FixModalRouter = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (VolumeConfigurationIds.has(configurationId)) {
        return <VolumeFixModalWrapper wadApi={wadApi} />;
    }

    if (LunConfigurationIds.has(configurationId)) {
        return <LunFixModalWrapper wadApi={wadApi} />;
    }

    if (FileSystemConfigurationIds.has(configurationId)) {
        return <FileSystemFixModalWrapper wadApi={wadApi} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
