import styled from '@emotion/styled';
import { Button, InlineLoader, Modal, ModalContent, ModalFooter, ModalHeader } from '@netapp/bxp-design-system-react';
import { KeyValueTable, type ResourceScanRecord } from '@tlveng/workload-factory-components';
import { TagIcon } from '@netapp/bxp-style/react-icons/General';

const LoaderWrapper = styled.div`
    display: flex;
    justify-content: center;
`;

export type ResourceTag = { key: string; value: string };

interface ResourceTagsDialogProps {
    resource?: ResourceScanRecord | null;
    isOpen?: boolean;
    tags?: ResourceTag[];
    isPending?: boolean;
    onClose: () => void;
}

const readTagsFromResource = (resource: ResourceScanRecord | null | undefined): ResourceTag[] => {
    if (!resource?.metadata) {
        return [];
    }
    const candidate = (resource.metadata as { tags?: unknown }).tags;
    return Array.isArray(candidate) ? (candidate as ResourceTag[]) : [];
};

export const ResourceTagsDialog = ({
    resource,
    isOpen,
    tags: tagsProp,
    onClose,
    isPending = false
}: ResourceTagsDialogProps) => {
    const isVisible = resource != null || isOpen === true;
    if (!isVisible) {
        return null;
    }
    const tags = tagsProp ?? readTagsFromResource(resource);
    return (
        <Modal>
            <ModalHeader>Tags</ModalHeader>
            <ModalContent>
                {isPending ? (
                    <LoaderWrapper>
                        <InlineLoader />
                    </LoaderWrapper>
                ) : (
                    <KeyValueTable
                        data={tags}
                        keyTitle="Tag key"
                        valueTitle="Tag value"
                        EmptyStateIcon={TagIcon}
                        emptyStateText="No tags available."
                    />
                )}
            </ModalContent>
            <ModalFooter>
                <Button onClick={onClose}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};
