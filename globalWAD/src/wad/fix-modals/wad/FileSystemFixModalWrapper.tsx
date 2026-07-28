import { useCallback, useMemo, useState } from 'react';
import type { FixMetadata, WadElementProps } from '@tlveng/workload-factory-components/wad';
import { PlaceholderFixModal, UnsupportedConfigurationNotice } from '../../shared/fixModalShared';
import { buildFileSystemFixTargets } from '../shared/modalUtils';
import { fileSystemWadModals } from './fileSystemWadModals';

export const FileSystemFixModalWrapper = ({ wadApi }: WadElementProps) => {
    const { configurationId } = wadApi.context;
    const { resources } = wadApi.fixModalPayload;
    const parentResource = resources[0]?.parentResource;
    const credentialId = parentResource?.credentialsIds?.[0];
    const region = parentResource?.region;
    const fsxId = parentResource?.id;
    const [isFixing, setIsFixing] = useState(false);

    const fix = useCallback(
        async (selectedFileSystemIds: string[], metadata: FixMetadata) => {
            setIsFixing(true);
            try {
                const targets = buildFileSystemFixTargets(resources, selectedFileSystemIds);
                await wadApi.fix(targets, metadata);
            } finally {
                setIsFixing(false);
            }
        },
        [resources, wadApi]
    );

    const onFixSuccess = useCallback(() => {
        wadApi.fetchResources().catch(() => undefined);
    }, [wadApi]);

    const fileSystemFixModalProps = useMemo(
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
        [wadApi, credentialId, region, fsxId, fix, isFixing, onFixSuccess, resources]
    );

    if (!credentialId || !region || !fsxId) {
        return <UnsupportedConfigurationNotice configurationId={configurationId} />;
    }

    const FixModalComponent = fileSystemWadModals[configurationId];

    if (FixModalComponent) {
        return <FixModalComponent {...fileSystemFixModalProps} />;
    }

    return <PlaceholderFixModal onClose={wadApi.closeFixModal} />;
};
