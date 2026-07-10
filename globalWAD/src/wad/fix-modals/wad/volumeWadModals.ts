import type { ComponentType } from 'react';
import type { FixMetadata, ResourceScanRecord } from '@tlveng/workload-factory-components';
import { ThinProvisioningFixModal } from '../volume/thin-provisioning/ThinProvisioningFixModal';

export interface VolumeWadFixModalProps {
    recommendationName: string;
    resources: ResourceScanRecord[];
    close: () => void;
    credentialId: string;
    region: string;
    fsxId: string;
    originPath: string;
    navigate: (target: { pathname: string }) => void;
    fix: (selectedVolumeIds: string[], metadata: FixMetadata) => Promise<void>;
    isFixing: boolean;
    onFixSuccess: () => void;
}

export const volumeWadModals: Partial<Record<string, ComponentType<VolumeWadFixModalProps>>> = {
    'wlmdb-thin-provision': ThinProvisioningFixModal
};
