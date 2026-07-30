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

const ThinProvisioningFixModalTestIds = {
    modal: 'wlmdb-thin-provisioning-fix-modal',
    header: 'wlmdb-thin-provisioning-fix-modal-header',
    content: 'wlmdb-thin-provisioning-fix-modal-content',
    continueButton: 'wlmdb-thin-provisioning-fix-continue-btn',
    cancelButton: 'wlmdb-thin-provisioning-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends configuring thin provisioning for FSx for ONTAP volumes. This approach optimizes storage efficiency and cost-effectiveness by allowing more logical data to be stored than physically available.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will update the selected volumes to enable thin provisioning by setting the space guarantee to none.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click fix to authorize Workload Factory to automatically perform these actions on your behalf.';

export const ThinProvisioningFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeFixModalProps) => {
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
            <HeightCapModal dataTestId={ThinProvisioningFixModalTestIds.modal}>
                <ModalHeader dataTestId={ThinProvisioningFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={ThinProvisioningFixModalTestIds.content}>
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
                            dataTestId={ThinProvisioningFixModalTestIds.continueButton}
                        >
                            Fix
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={ThinProvisioningFixModalTestIds.cancelButton}
                        >
                            Close
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
