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
import type { FileSystemFixModalProps } from '../../shared/WadFixModalProps';
import { readResourceWorkloadType, WorkloadType, type WorkloadTypeValue } from '../../../tables/shared/metadataUtils';

const FileSystemHeadroomFixModalTestIds = {
    modal: 'wlmdb-headroom-fix-modal',
    header: 'wlmdb-headroom-fix-modal-header',
    content: 'wlmdb-headroom-fix-modal-content',
    continueButton: 'wlmdb-headroom-fix-continue-btn',
    cancelButton: 'wlmdb-headroom-fix-cancel-btn'
} as const;

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends increasing the FSx for ONTAP file system capacity to maintain the right headroom.';

const HEADROOM_COPY: Record<
    WorkloadTypeValue,
    {
        whatWillHappen: string;
    }
> = {
    [WorkloadType.MSSQL]: {
        whatWillHappen: 'Storage capacity update: The capacity of your FSx for ONTAP file system will be increased'
    },
    [WorkloadType.ORACLE]: {
        whatWillHappen:
            'Storage capacity update: The capacity of your FSx for ONTAP file system will be increased to maintain ~20% free space in the aggregate.'
    }
};

const NOTE_NO_DISRUPTION = 'No disruption to your services are expected during this process.';

const NOTE_AUTHORIZATION =
    'Click continue to authorize Workload Factory to automatically perform these actions on your behalf.';

export const FileSystemHeadroomFixModal = memo(
    ({ recommendationName, resources, close, fix, isFixing, onFixSuccess }: FileSystemFixModalProps) => {
        const copy = useMemo(() => {
            const workloadType = readResourceWorkloadType(resources[0]) ?? WorkloadType.MSSQL;
            return HEADROOM_COPY[workloadType];
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
            <HeightCapModal dataTestId={FileSystemHeadroomFixModalTestIds.modal}>
                <ModalHeader dataTestId={FileSystemHeadroomFixModalTestIds.header}>{recommendationName}</ModalHeader>
                <ModalContent dataTestId={FileSystemHeadroomFixModalTestIds.content}>
                    <FixModalSection>
                        <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                        <Text>{ACTION_SUMMARY_TEXT}</Text>
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
                            dataTestId={FileSystemHeadroomFixModalTestIds.continueButton}
                        >
                            Continue
                        </Button>
                        <Button
                            color="secondary"
                            onClick={close}
                            dataTestId={FileSystemHeadroomFixModalTestIds.cancelButton}
                        >
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </HeightCapModal>
        );
    }
);
