import styled from '@emotion/styled';
import {
    InlineNotification,
    Modal,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Button,
    ButtonsGroup,
    Text
} from '@netapp/bxp-design-system-react';
import { FixModalRouterTestIds, FixPageRouterTestIds, PlaceholderFixModalTestIds } from './fixModalTestIds';

const UnsupportedWrapper = styled.div`
    padding: 16px 24px;
    background-color: var(--notification-error-bg);
`;

export const UnsupportedConfigurationNotice = ({ configurationId }: { configurationId: string }) => (
    <UnsupportedWrapper data-testid={FixModalRouterTestIds.unsupported}>
        <InlineNotification type="urgent">Fix modal not supported</InlineNotification>
        <Text>
            Configuration <code>{configurationId}</code> does not have a fix modal in the DB bundle.
        </Text>
    </UnsupportedWrapper>
);

export const UnsupportedTableNotice = ({ configurationId }: { configurationId: string }) => (
    <UnsupportedWrapper data-testid={FixPageRouterTestIds.unsupported}>
        <InlineNotification type="urgent">Table not supported</InlineNotification>
        <Text>
            Configuration <code>{configurationId}</code> is not yet supported by the DB bundle.
        </Text>
    </UnsupportedWrapper>
);

export const PlaceholderFixModal = ({ onClose }: { onClose: () => void }) => (
    <Modal dataTestId={PlaceholderFixModalTestIds.modal}>
        <ModalHeader dataTestId={PlaceholderFixModalTestIds.header}>Fix</ModalHeader>
        <ModalContent dataTestId={PlaceholderFixModalTestIds.content}>
            <Text>Fix modal coming soon.</Text>
        </ModalContent>
        <ModalFooter dataTestId={PlaceholderFixModalTestIds.footer}>
            <ButtonsGroup>
                <Button color="secondary" onClick={onClose} dataTestId={PlaceholderFixModalTestIds.cancelButton}>
                    Cancel
                </Button>
            </ButtonsGroup>
        </ModalFooter>
    </Modal>
);
