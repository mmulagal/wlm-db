import { memo } from 'react';
import {
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text,
    BulletList
} from '@netapp/bxp-design-system-react';
import { FixModalNumberedList, FixModalSection, FixModalSectionTitle, HeightCapModal } from '../../shared/fixModalStyles';
import type { LunFixModalProps } from '../../shared/lunFixModalComponents';

const OsTypeFixModalTestIds = {
    modal: 'wlmdb-os-type-fix-modal',
    header: 'wlmdb-os-type-fix-modal-header',
    content: 'wlmdb-os-type-fix-modal-content',
    closeButton: 'wlmdb-os-type-fix-close-btn',
    optimizationSteps: 'wlmdb-os-type-fix-modal-optimization-steps'
} as const;

const ACTION_SUMMARY_TEXT =
    'Workload Factory recommends ensuring that the ONTAP LUN operating system (OS) type value matches the operating system partitioning scheme to achieve I/O alignment. Incorrect configuration might reduce performance.';

const OPTIMIZATION_STEPS = [
    'Create a LUN on the NetApp controller with the correct OS type',
    'Map the new LUN to the host system',
    'Copy data from the existing LUN using host-level tools',
    'Update multipathing configuration as needed and unmap the old LUN',
    'Verify application functionality and remove the old LUN from the NetApp controller'
] as const;

const NOTE_ITEMS = [
    'Schedule this activity during a maintenance window to minimize operational impact',
    'The process may require downtime and could result in data loss if not handled properly',
    'Perform full backups before starting',
    'Notify all affected users in advance'
] as const;

export const OsTypeFixModal = memo(({ recommendationName, close }: LunFixModalProps) => (
    <HeightCapModal dataTestId={OsTypeFixModalTestIds.modal}>
        <ModalHeader dataTestId={OsTypeFixModalTestIds.header}>{recommendationName}</ModalHeader>
        <ModalContent dataTestId={OsTypeFixModalTestIds.content}>
            <FixModalSection>
                <FixModalSectionTitle bold>Action summary</FixModalSectionTitle>
                <Text>{ACTION_SUMMARY_TEXT}</Text>
            </FixModalSection>
            <FixModalSection>
                <FixModalSectionTitle bold>Optimization steps</FixModalSectionTitle>
                <FixModalNumberedList dataTestId={OsTypeFixModalTestIds.optimizationSteps}>
                    {OPTIMIZATION_STEPS.map(step => (
                        <Text key={step}>{step}</Text>
                    ))}
                </FixModalNumberedList>
            </FixModalSection>
            <FixModalSection>
                <FixModalSectionTitle bold>Note</FixModalSectionTitle>
                <BulletList>
                    {NOTE_ITEMS.map(note => (
                        <Text key={note}>{note}</Text>
                    ))}
                </BulletList>
            </FixModalSection>
        </ModalContent>
        <ModalFooter>
            <ButtonsGroup>
                <Button onClick={close} dataTestId={OsTypeFixModalTestIds.closeButton}>
                    Close
                </Button>
            </ButtonsGroup>
        </ModalFooter>
    </HeightCapModal>
));
