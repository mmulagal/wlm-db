import type { WadElementProps } from '@tlveng/workload-factory-components';
import { LunFixModalWrapper } from './fix-modals/wad/LunFixModalWrapper';
import { VolumeFixModalWrapper } from './fix-modals/wad/VolumeFixModalWrapper';
import { UnsupportedConfigurationNotice } from './shared/fixModalShared';
import { LunConfigurationIds } from './tables/lun/configurations';
import { VolumeConfigurationIds } from './tables/volume/configurations';

export { PlaceholderFixModal, UnsupportedConfigurationNotice } from './shared/fixModalShared';

/**
 * Routes to the appropriate DB fix modal component based on `configurationId`.
 *
 * Volume configs → VolumeFixModalWrapper
 * LUN configs → LunFixModalWrapper
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

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
