import type { FixMetadata, ResourceScanRecord } from '@tlveng/workload-factory-components';

export interface WadFixModalProps {
    recommendationName: string;
    resources: ResourceScanRecord[];
    close: () => void;
    credentialId: string;
    region: string;
    fsxId: string;
    originPath: string;
    navigate: (target: { pathname: string }) => void;
    fix: (selectedIds: string[], metadata: FixMetadata) => Promise<void>;
    isFixing: boolean;
    isLoading?: boolean | undefined;
    dataError?: string | undefined;
    onFixSuccess?: () => void;
}
