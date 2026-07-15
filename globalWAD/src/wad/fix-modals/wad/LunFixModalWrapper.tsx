import { useCallback, useMemo, useState } from 'react';
import type { FixMetadata, WadElementProps } from '@tlveng/workload-factory-components';
import { UnsupportedConfigurationNotice } from '../../shared/fixModalShared';
import { buildVolumeFixTargets } from '../shared/buildVolumeFixTargets';
import { lunWadModals } from './lunWadModals';

export const LunFixModalWrapper = ({ wadApi }: WadElementProps) => {
    const { configurationId, configurationName } = wadApi.context;
    const { resources } = wadApi.fixModalPayload;
    const [isFixing, setIsFixing] = useState(false);

    const fix = useCallback(
        async (selectedResourceIds: string[], metadata: FixMetadata) => {
            setIsFixing(true);
            try {
                const targets = buildVolumeFixTargets(resources, selectedResourceIds);
                await wadApi.fix(targets, metadata);
            } finally {
                setIsFixing(false);
            }
        },
        [resources, wadApi]
    );

    const onFixSuccess = useCallback(() => {
        void wadApi.fetchResources();
    }, [wadApi]);

    const lunFixModalProps = useMemo(
        () => ({
            recommendationName: configurationName,
            close: wadApi.closeFixModal,
            resources,
            fix,
            isFixing,
            onFixSuccess
        }),
        [configurationName, wadApi.closeFixModal, resources, fix, isFixing, onFixSuccess]
    );

    const FixModalComponent = lunWadModals[configurationId];

    if (FixModalComponent) {
        return <FixModalComponent {...lunFixModalProps} />;
    }

    return <UnsupportedConfigurationNotice configurationId={configurationId} />;
};
