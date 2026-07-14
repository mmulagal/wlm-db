import type { ComponentType } from 'react';
import type { FixMetadata, ResourceScanRecord } from '@tlveng/workload-factory-components';
import { SnapshotPolicyFixModal } from '../volume/snapshot-policy/SnapshotPolicyFixModal';
import { SnapcenterSnapshotFixModal } from '../volume/snapcenter-snapshot/SnapcenterSnapshotFixModal';
import { ThinProvisioningFixModal } from '../volume/thin-provisioning/ThinProvisioningFixModal';

export interface VolumeFixModalProps {
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
    onFixSuccess?: () => void;
}

export const volumeFixModalComponents: Partial<Record<string, ComponentType<VolumeFixModalProps>>> = {
    'wlmdb-thin-provision': ThinProvisioningFixModal,
    'wlmdb-snapshot-policy': SnapshotPolicyFixModal,
    'wlmdb-snapcenter-snapshot': SnapcenterSnapshotFixModal
};
