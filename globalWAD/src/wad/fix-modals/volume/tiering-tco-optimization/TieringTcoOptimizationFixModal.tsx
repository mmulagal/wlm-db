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

const TieringTcoOptimizationFixModalTestIds = {
    modal: 'wlmdb-tiering-tco-optimization-fix-modal',
    header: 'wlmdb-tiering-tco-optimization-fix-modal-header',
    content: 'wlmdb-tiering-tco-optimization-fix-modal-content',
    continueButton: 'wlmdb-tiering-tco-optimization-fix-continue-btn',
    cancelButton: 'wlmdb-tiering-tco-optimization-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_TEXT =
    'For optimal database performance and cost efficiency, Workload Factory recommends using the snapshot-only tiering policy, which moves only snapshot data to the capacity tier while keeping active data on the SSD tier. This approach preserves low-latency performance for SQL workloads while reducing storage costs. Workload Factory recommends tiering snapshot data after a 7-day cooling period.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will modify the tiering policy and the cooling period configuration of the selected volumes to align them with the recommended settings.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

export const TieringTcoOptimizationFixModal = memo(
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
            <HeightCapModal dataTestId={TieringTcoOptimizationFixModalTestIds.modal}>
                <ModalHeader dataTestId={TieringTcoOptimizationFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={TieringTcoOptimizationFixModalTestIds.content}>
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
                            dataTestId={TieringTcoOptimizationFixModalTestIds.continueButton}
                        >
                            Continue
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
