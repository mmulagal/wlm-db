import { useCallback, useMemo, useState } from 'react';
import type { FixMetadata, WadElementProps } from '@tlveng/workload-factory-components';
import { PlaceholderFixModal, UnsupportedConfigurationNotice } from '../../shared/fixModalShared';
import { buildVolumeFixTargets } from '../shared/buildVolumeFixTargets';
import { volumeWadModals } from './volumeWadModals';

export const VolumeFixModalWrapper = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;
    const { resources } = wadApi.fixModalPayload;
    const parentResource = resources[0]?.parentResource;
    const credentialId = parentResource?.credentialsIds?.[0];
    const region = parentResource?.region;
    const fsxId = parentResource?.id;
    const [isFixing, setIsFixing] = useState(false);

    const fix = useCallback(
        async (selectedVolumeIds: string[], metadata: FixMetadata) => {
            setIsFixing(true);
            try {
                const targets = buildVolumeFixTargets(resources, selectedVolumeIds);
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

    const volumeFixModalProps = useMemo(
        () => ({
            recommendationName: wadApi.context.configurationName,
            resources,
            close: wadApi.closeFixModal,
            credentialId: credentialId ?? '',
            region: region ?? '',
            fsxId: fsxId ?? '',
            navigate: wadApi.navigate,
            originPath: wadApi.getLocation(),
            fix,
            isFixing,
            onFixSuccess
        }),
        [
            wadApi.context.configurationName,
            wadApi.closeFixModal,
            credentialId,
            region,
            fsxId,
            wadApi.navigate,
            wadApi.getLocation,
            fix,
            isFixing,
            onFixSuccess,
            resources
        ]
    );

    if (!credentialId || !region || !fsxId) {
        return <UnsupportedConfigurationNotice configurationId={configurationId} />;
    }

    const FixModalComponent = volumeWadModals[configurationId];

    if (FixModalComponent) {
        return <FixModalComponent {...volumeFixModalProps} />;
    }

    return <PlaceholderFixModal onClose={wadApi.closeFixModal} />;
};
