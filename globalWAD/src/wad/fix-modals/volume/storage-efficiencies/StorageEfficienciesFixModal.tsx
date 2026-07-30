import { memo, useCallback, useMemo } from 'react';
import {
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text,
    BulletList
} from '@netapp/bxp-design-system-react';
import { FixModalSection, FixModalSectionTitle, HeightCapModal } from '../../shared/fixModalStyles';
import type { VolumeFixModalProps } from '../../shared/volumeFixModalComponents';
import { readResourceWorkloadType, WorkloadType, type WorkloadTypeValue } from '../../../tables/shared/metadataUtils';

const StorageEfficienciesFixModalTestIds = {
    modal: 'wlmdb-storage-efficiencies-fix-modal',
    header: 'wlmdb-storage-efficiencies-fix-modal-header',
    content: 'wlmdb-storage-efficiencies-fix-modal-content',
    continueButton: 'wlmdb-storage-efficiencies-fix-continue-btn',
    cancelButton: 'wlmdb-storage-efficiencies-fix-cancel-btn'
} as const;

const STORAGE_EFFICIENCIES_COPY: Record<
    WorkloadTypeValue,
    {
        actionSummary: string;
        whatWillHappen: string;
    }
> = {
    [WorkloadType.MSSQL]: {
        actionSummary:
            'Workload Factory recommends enabling storage efficiencies—deduplication, adaptive compression, and compaction—on volumes used by Microsoft SQL Server to reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance.',
        whatWillHappen:
            'Workload Factory will update the selected volumes to apply the recommended settings for deduplication, adaptive compression, and compaction.'
    },
    [WorkloadType.ORACLE]: {
        actionSummary:
            'Workload Factory recommends implementing storage efficiencies—compression, compaction, and deduplication—in NetApp ONTAP for Oracle database environments to significantly reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance. Tailored settings for each volume type ensure alignment with Oracle’s I/O patterns: Data and archive Volumes benefit from inline adaptive compression (8KB), compaction and deduplication while Redo Log Volumes prioritize performance with minimal savings from these features.',
        whatWillHappen:
            'Workload Factory will set the recommended efficiency mechanisms based on the type of file that is located in the volume.'
    }
};

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click fix to authorize Workload Factory to automatically perform these actions on your behalf.';

export const StorageEfficienciesFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeFixModalProps) => {
        const copy = useMemo(() => {
            const workloadType = readResourceWorkloadType(resources[0]) ?? WorkloadType.MSSQL;
            return STORAGE_EFFICIENCIES_COPY[workloadType];
        }, [resources]);

        const handleContinue = useCallback(async () => {
            try {
                await fix(
                    resources.map(resource => resource.id),
                    {}
                );
                onFixSuccess?.();
            } catch {
                // ponytail: errors surface via modal close; success path uses onFixSuccess
            } finally {
                close();
            }
        }, [close, fix, onFixSuccess, resources]);

        return (
            <HeightCapModal dataTestId={StorageEfficienciesFixModalTestIds.modal}>
                <ModalHeader dataTestId={StorageEfficienciesFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={StorageEfficienciesFixModalTestIds.content}>
                    <FixModalSection>
                        <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                        <Text>{copy.actionSummary}</Text>
                    </FixModalSection>
                    <FixModalSection>
                        <FixModalSectionTitle bold>What will happen</FixModalSectionTitle>
                        <Text>{copy.whatWillHappen}</Text>
                    </FixModalSection>
                    <FixModalSection>
                        <FixModalSectionTitle bold>Note</FixModalSectionTitle>
                        <BulletList>
                            {NOTE_NO_DISRUPTION}
                            {NOTE_AUTHORIZATION}
                        </BulletList>
                    </FixModalSection>
                </ModalContent>
                <ModalFooter>
                    <ButtonsGroup>
                        <Button
                            onClick={handleContinue}
                            isSubmitting={isFixing}
                            dataTestId={StorageEfficienciesFixModalTestIds.continueButton}
                        >
                            Fix
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={StorageEfficienciesFixModalTestIds.cancelButton}
                        >
                            Close
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
