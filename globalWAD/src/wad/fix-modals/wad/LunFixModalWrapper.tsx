import { useMemo } from 'react';
import type { WadElementProps } from '@tlveng/workload-factory-components';
import { UnsupportedConfigurationNotice } from '../../shared/fixModalShared';
import { lunWadModals } from './lunWadModals';

export const LunFixModalWrapper = ({ wadApi }: WadElementProps) => {
    const { configurationId, configurationName } = wadApi.context;

    const lunFixModalProps = useMemo(
        () => ({
            recommendationName: configurationName,
            close: wadApi.closeFixModal
        }),
        [configurationName, wadApi.closeFixModal]
    );

    const FixModalComponent = lunWadModals[configurationId];

    if (FixModalComponent) {
        return <FixModalComponent {...lunFixModalProps} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
