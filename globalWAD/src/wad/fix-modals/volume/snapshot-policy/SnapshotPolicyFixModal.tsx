import { memo, useCallback } from 'react';
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

const SnapshotPolicyFixModalTestIds = {
    modal: 'wlmdb-snapshot-policy-fix-modal',
    header: 'wlmdb-snapshot-policy-fix-modal-header',
    content: 'wlmdb-snapshot-policy-fix-modal-content',
    continueButton: 'wlmdb-snapshot-policy-fix-continue-btn',
    cancelButton: 'wlmdb-snapshot-policy-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends disabling scheduled snapshots for FSx for ONTAP volumes. Instead, manage snapshots externally using tools such as SnapCenter, which create application-consistent backups and help prevent data corruption during restore operations.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will disable the snapshot policy on the selected volumes.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

export const SnapshotPolicyFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeFixModalProps) => {
        const handleContinue = useCallback(async () => {
            try {
                await fix(
                    resources.map(resource => resource.id),
                    {}
                );
                onFixSuccess?.();
            } catch {
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
                        <Text>{ACTION_SUMMARY_TEXT}</Text>
                    </FixModalSection>
                    <FixModalSection>
                        <FixModalSectionTitle bold>What will happen</FixModalSectionTitle>
                        <Text>{WHAT_WILL_HAPPEN_TEXT}</Text>
                    </FixModalSection>
                    <FixModalSection>
                        <FixModalSectionTitle bold>Note</FixModalSectionTitle>
                        <BulletList>
                            <>{NOTE_NO_DISRUPTION}</>
                            <>{NOTE_AUTHORIZATION}</>
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
                            Continue
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={SnapshotPolicyFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
