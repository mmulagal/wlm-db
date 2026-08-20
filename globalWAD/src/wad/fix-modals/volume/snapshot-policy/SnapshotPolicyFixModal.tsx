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

const SnapshotPolicyFixModalTestIds = {
    modal: 'wlmdb-snapshot-policy-fix-modal',
    header: 'wlmdb-snapshot-policy-fix-modal-header',
    content: 'wlmdb-snapshot-policy-fix-modal-content',
    continueButton: 'wlmdb-snapshot-policy-fix-continue-btn',
    cancelButton: 'wlmdb-snapshot-policy-fix-cancel-btn'
} as const;

const SNAPSHOT_POLICY_COPY: Record<
    WorkloadTypeValue,
    {
        actionSummary: string;
        whatWillHappen: string;
    }
> = {
    [WorkloadType.MSSQL]: {
        actionSummary:
            'Workload Factory recommends disabling scheduled snapshots for FSx for ONTAP volumes used by Microsoft SQL Server. Instead, manage snapshots externally using tools such as SnapCenter, which create application-consistent backups and help prevent data corruption during restore operations.',
        whatWillHappen: 'Workload Factory will disable the snapshot policy on the selected volumes.'
    },
    [WorkloadType.ORACLE]: {
        actionSummary:
            'Workload Factory recommends disabling the native ONTAP snapshots for FSx ONTAP volumes for Oracle databases. Oracle snapshots should be managed externally via tools like SnapCenter, which creates application-consistent snapshots, preventing corruption during restoration.',
        whatWillHappen: 'Workload Factory will disable the snapshot policy on the selected volumes.'
    }
};

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click fix to authorize Workload Factory to automatically perform these actions on your behalf.';

export const SnapshotPolicyFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeFixModalProps) => {
        const copy = useMemo(() => {
            const workloadType = readResourceWorkloadType(resources[0]) ?? WorkloadType.MSSQL;
            return SNAPSHOT_POLICY_COPY[workloadType];
        }, [resources]);

        const handleContinue = useCallback(async () => {
            try {
                const metaData = {
                    workload: resources[0]?.metadata?.workload
                } 
                await fix(
                    resources.map(resource => resource.id),
                    metaData
                );
                onFixSuccess?.();
            } catch {
                // ponytail: errors surface via modal close; success path uses onFixSuccess
            } finally {
                close();
            }
        }, [close, fix, onFixSuccess, resources]);

        return (
            <HeightCapModal dataTestId={SnapshotPolicyFixModalTestIds.modal}>
                <ModalHeader dataTestId={SnapshotPolicyFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={SnapshotPolicyFixModalTestIds.content}>
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
                            dataTestId={SnapshotPolicyFixModalTestIds.continueButton}
                        >
                            Fix
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={SnapshotPolicyFixModalTestIds.cancelButton}
                        >
                            Close
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
