import type { ComponentType } from 'react';
import type { FixMetadata, ResourceScanRecord } from '@tlveng/workload-factory-components/wad';
import { BlockDeviceSpaceManagementFixModal } from '../lun/block-device-space-management/BlockDeviceSpaceManagementFixModal';
import { OsTypeFixModal } from '../lun/os-type/OsTypeFixModal';

export interface LunFixModalProps {
    recommendationName: string;
    close: () => void;
    resources?: ResourceScanRecord[];
    fix?: (selectedResourceIds: string[], metadata: FixMetadata) => Promise<void>;
    isFixing?: boolean;
    onFixSuccess?: () => void;
}

export const lunFixModalComponents: Partial<Record<string, ComponentType<LunFixModalProps>>> = {
    'wlmdb-os-type': OsTypeFixModal,
    'wlmdb-block-device-space-management': BlockDeviceSpaceManagementFixModal
};
