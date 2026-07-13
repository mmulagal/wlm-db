import { memo } from 'react';
import styled from '@emotion/styled';
import {
    Modal,
    ModalHeader,
    ModalContent,
    ModalFooter,
    ButtonsGroup,
    Button,
    Text,
    BulletList,
    NumberedList
} from '@netapp/bxp-design-system-react';
import { OsTypeFixModalTestIds } from './testIds';
import { LunWadFixModalProps } from '../../wad/lunWadModals';

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

export const OsTypeFixModal = memo(({ recommendationName, close }: LunWadFixModalProps) => (
    <Modal dataTestId={OsTypeFixModalTestIds.modal}>
        <ModalHeader dataTestId={OsTypeFixModalTestIds.header}>{recommendationName}</ModalHeader>
        <ModalContent dataTestId={OsTypeFixModalTestIds.content}>
            <BodyWrapper>
                <Section>
                    <Text bold>Action summary</Text>
                    <Text>{ACTION_SUMMARY_TEXT}</Text>
                </Section>
                <Section>
                    <Text bold>Optimization steps</Text>
                    <NumberedList>
                        {OPTIMIZATION_STEPS.map(step => (
                            <Text key={step}>{step}</Text>
                        ))}
                    </NumberedList>
                </Section>
                <Section>
                    <Text bold>Note</Text>
                    <BulletList>
                        {NOTE_ITEMS.map(note => (
                            <Text key={note}>{note}</Text>
                        ))}
                    </BulletList>
                </Section>
            </BodyWrapper>
        </ModalContent>
        <ModalFooter>
            <ButtonsGroup>
                <Button onClick={close} dataTestId={OsTypeFixModalTestIds.closeButton}>
                    Close
                </Button>
            </ButtonsGroup>
        </ModalFooter>
    </Modal>
));
