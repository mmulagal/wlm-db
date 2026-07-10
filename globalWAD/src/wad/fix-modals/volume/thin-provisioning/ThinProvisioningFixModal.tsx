import { memo, useCallback } from 'react';
import styled from '@emotion/styled';
import {
    Modal,
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text,
    BulletList
} from '@netapp/bxp-design-system-react';
import type { VolumeWadFixModalProps } from '../../wad/volumeWadModals';
import { ThinProvisioningFixModalTestIds } from './testIds';

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends configuring thin provisioning for FSx for ONTAP volumes. This approach optimizes storage efficiency and cost-effectiveness by allowing more logical data to be stored than physically available.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will update the selected volumes to enable thin provisioning by setting the space guarantee to none.';

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

const BodyWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
`;

const Section = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

export const ThinProvisioningFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: VolumeWadFixModalProps) => {
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
            <Modal dataTestId={ThinProvisioningFixModalTestIds.modal}>
                <ModalHeader dataTestId={ThinProvisioningFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={ThinProvisioningFixModalTestIds.content}>
                    <BodyWrapper>
                        <Section>
                            <Text bold>Action summary</Text>
                            <Text>{ACTION_SUMMARY_TEXT}</Text>
                        </Section>
                        <Section>
                            <Text bold>What will happen</Text>
                            <Text>{WHAT_WILL_HAPPEN_TEXT}</Text>
                        </Section>
                        <Section>
                            <Text bold>Note</Text>
                            <BulletList>
                                <>{NOTE_NO_DISRUPTION}</>
                                <>{NOTE_AUTHORIZATION}</>
                            </BulletList>
                        </Section>
                    </BodyWrapper>
                </ModalContent>
                <ModalFooter>
                    <ButtonsGroup>
                        <Button
                            onClick={handleContinue}
                            isSubmitting={isFixing}
                            dataTestId={ThinProvisioningFixModalTestIds.continueButton}
                        >
                            Continue
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={ThinProvisioningFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </Modal>
        );
    }
);
