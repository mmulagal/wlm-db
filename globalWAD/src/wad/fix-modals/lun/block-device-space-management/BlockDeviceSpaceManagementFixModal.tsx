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
import type { LunFixModalProps } from '../../shared/lunFixModalComponents';

const BlockDeviceSpaceManagementFixModalTestIds = {
    modal: 'wlmdb-block-device-space-management-fix-modal',
    header: 'wlmdb-block-device-space-management-fix-modal-header',
    content: 'wlmdb-block-device-space-management-fix-modal-content',
    continueButton: 'wlmdb-block-device-space-management-fix-continue-btn',
    cancelButton: 'wlmdb-block-device-space-management-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_INTRO =
    'Workload Factory recommends configuring block device space settings for LUNs used by Microsoft SQL Server instances to prevent write failures and improve space efficiency on FSx for ONTAP. This configuration applies the recommended combination of settings for thin-provisioned volumes:';

const ACTION_SUMMARY_ITEMS = [
    'Space reservation: enabled - reserves enough space in the volume so writes to the LUN do not fail.',
    'Space allocation: enabled - allows FSx for ONTAP to notify the EC2 host when a volume is full and supports automatic space reclamation when the database deletes data.',
    'Fractional reserve: disabled - avoids unnecessary overwrite reservation, optimizing space utilization and cost effectiveness for thin provisioning.'
] as const;

const ACTION_SUMMARY_CLOSING =
    'Together, these settings help ensure predictable database behavior while minimizing wasted capacity.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will update the selected volumes to apply the recommended values for all three settings.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

export const BlockDeviceSpaceManagementFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: LunFixModalProps) => {
        const handleContinue = useCallback(async () => {
            if (!fix || !resources) {
                close();
                return;
            }

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
            <HeightCapModal dataTestId={BlockDeviceSpaceManagementFixModalTestIds.modal}>
                <ModalHeader dataTestId={BlockDeviceSpaceManagementFixModalTestIds.header}>
                    {recommendationName}
                </ModalHeader>
                <ModalContent dataTestId={BlockDeviceSpaceManagementFixModalTestIds.content}>
                    <FixModalSection>
                        <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                        <Text>{ACTION_SUMMARY_INTRO}</Text>
                        <BulletList>
                            {ACTION_SUMMARY_ITEMS.map(item => (
                                <Text key={item}>{item}</Text>
                            ))}
                        </BulletList>
                        <Text>{ACTION_SUMMARY_CLOSING}</Text>
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
                            dataTestId={BlockDeviceSpaceManagementFixModalTestIds.continueButton}
                        >
                            Continue
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={BlockDeviceSpaceManagementFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
