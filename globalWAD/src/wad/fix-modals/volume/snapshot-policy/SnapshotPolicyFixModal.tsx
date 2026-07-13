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
import { SnapshotPolicyFixModalTestIds } from './testIds';

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends disabling scheduled snapshots for FSx for ONTAP volumes. Instead, manage snapshots externally using tools such as SnapCenter, which create application-consistent backups and help prevent data corruption during restore operations.';

const WHAT_WILL_HAPPEN_TEXT =
    'Workload Factory will disable the snapshot policy on the selected volumes.';

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

export const SnapshotPolicyFixModal = memo(
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
            <Modal dataTestId={SnapshotPolicyFixModalTestIds.modal}>
                <ModalHeader dataTestId={SnapshotPolicyFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={SnapshotPolicyFixModalTestIds.content}>
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
            </Modal>
        );
    }
);
