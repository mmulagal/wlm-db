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

const TieringTcoOptimizationFixModalTestIds = {
    modal: 'wlmdb-tiering-tco-optimization-fix-modal',
    header: 'wlmdb-tiering-tco-optimization-fix-modal-header',
    content: 'wlmdb-tiering-tco-optimization-fix-modal-content',
    continueButton: 'wlmdb-tiering-tco-optimization-fix-continue-btn',
    cancelButton: 'wlmdb-tiering-tco-optimization-fix-cancel-btn'
} as const;

const TIERING_COPY: Record<
    WorkloadTypeValue,
    {
        actionSummary: string;
        whatWillHappen: string;
    }
> = {
    [WorkloadType.MSSQL]: {
        actionSummary:
            'For optimal database performance and cost efficiency, Workload Factory recommends using the snapshot-only tiering policy, which moves only snapshot data to the capacity tier while keeping active data on the SSD tier. This approach preserves low-latency performance for SQL workloads while reducing storage costs. Workload Factory recommends tiering snapshot data after a 7-day cooling period.',
        whatWillHappen:
            'Workload Factory will modify the tiering policy and the cooling period configuration of the selected volumes to align with the recommended settings.'
    },
    [WorkloadType.ORACLE]: {
        actionSummary:
            'Workload Factory recommends enabling tiering for some Oracle database volumes on Amazon FSx for NetApp ONTAP where appropriate, to move cold data to lower-cost capacity storage and reduce overall storage costs, while keeping active database data on high-performance SSDs to preserve critical performance. Recommended policies are based on the data type in each volume, with tiering disabled (none) for data files and redo logs, and auto for archive logs. For archive/FRA volumes, it is also recommended to set an appropriate cooling period before data is tiered—typically 2 days for compressed backups and 14 days for uncompressed backups—to balance cost efficiency and performance.',
        whatWillHappen:
            'Workload Factory will update the tiering policy and cooling period settings for the selected volumes based on the type of data stored in each volume, aligning them with the recommended configuration.'
    }
};

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click fix to authorize Workload Factory to automatically perform these actions on your behalf.';

export const TieringTcoOptimizationFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeFixModalProps) => {
        const copy = useMemo(() => {
            const workloadType = readResourceWorkloadType(resources[0]) ?? WorkloadType.MSSQL;
            return TIERING_COPY[workloadType];
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
            <HeightCapModal dataTestId={TieringTcoOptimizationFixModalTestIds.modal}>
                <ModalHeader dataTestId={TieringTcoOptimizationFixModalTestIds.header}>
                    {recommendationName}
                </ModalHeader>
                <ModalContent dataTestId={TieringTcoOptimizationFixModalTestIds.content}>
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
                            dataTestId={TieringTcoOptimizationFixModalTestIds.continueButton}
                        >
                            Fix
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={TieringTcoOptimizationFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
