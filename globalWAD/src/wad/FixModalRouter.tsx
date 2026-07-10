import type { WadElementProps } from '@tlveng/workload-factory-components';
import { VolumeFixModalWrapper } from './fix-modals/wad/VolumeFixModalWrapper';
import { UnsupportedConfigurationNotice } from './shared/fixModalShared';
import { VolumeConfigurationIds } from './tables/volume/configurations';

export { PlaceholderFixModal, UnsupportedConfigurationNotice } from './shared/fixModalShared';

/**
 * Routes to the appropriate DB fix modal component based on `configurationId`.
 *
 * Volume configs → VolumeFixModalWrapper
 * Unknown configs → UnsupportedConfigurationNotice
 */
export const FixModalRouter = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;

    if (VolumeConfigurationIds.has(configurationId)) {
        return <VolumeFixModalWrapper wadApi={wadApi} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
