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

const StorageEfficienciesFixModalTestIds = {
    modal: 'wlmdb-storage-efficiencies-fix-modal',
    header: 'wlmdb-storage-efficiencies-fix-modal-header',
    content: 'wlmdb-storage-efficiencies-fix-modal-content',
    continueButton: 'wlmdb-storage-efficiencies-fix-continue-btn',
    cancelButton: 'wlmdb-storage-efficiencies-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends enabling storage efficiencies—deduplication, adaptive compression, and compaction—on volumes used by Microsoft SQL Server to reduce storage footprint, lower costs, and optimize resource utilization while maintaining performance.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will update the selected volumes to apply the recommended settings for deduplication, adaptive compression, and compaction.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

export const StorageEfficienciesFixModal = memo(
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
            <HeightCapModal dataTestId={StorageEfficienciesFixModalTestIds.modal}>
                <ModalHeader dataTestId={StorageEfficienciesFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={StorageEfficienciesFixModalTestIds.content}>
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
                            dataTestId={StorageEfficienciesFixModalTestIds.continueButton}
                        >
                            Continue
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={StorageEfficienciesFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
