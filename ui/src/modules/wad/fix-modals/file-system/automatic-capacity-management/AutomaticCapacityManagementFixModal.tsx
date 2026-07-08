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
    Span,
    BulletList,
    ExternalLink
} from '@netapp/bxp-design-system-react';

export interface AutomaticCapacityManagementFixModalProps {
    recommendationName: string;
    credentialId: string;
    region: string;
    fsxId: string;
    navigate: (target: { pathname: string }) => void;
    close: () => void;
}

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

const TrailingText = styled(Text)`
    margin-top: 16px;
`;

export const AutomaticCapacityManagementFixModal = memo(
    ({
        recommendationName,
        credentialId,
        region,
        fsxId,
        navigate,
        close
    }: AutomaticCapacityManagementFixModalProps) => {
        const onContinue = useCallback(() => {
            close();
            navigate({ pathname: `/wlmfsx/fsx/clusters/${credentialId}/${region}/${fsxId}/auto-capacity` });
        }, [close, navigate, credentialId, region, fsxId]);

        return (
            <Modal>
                <ModalHeader>{recommendationName}</ModalHeader>
                <ModalContent>
                    <BodyWrapper>
                        <Section>
                            <Text bold>Action summary</Text>
                            <Text>
                                Workload Factory manages SSD capacity settings for this file system based on CloudWatch
                                metrics to optimize storage usage and review projected capacity impact.
                            </Text>
                        </Section>
                        <Section>
                            <Text bold>What will happen</Text>
                            <Text>
                                Workload Factory scans the FSx for ONTAP file system every 30 minutes to determine
                                whether additional SSD capacity is needed.
                            </Text>
                        </Section>
                        <Section>
                            <Text bold>Note</Text>
                            <BulletList>
                                <>
                                    Don't enable this feature during data migration. AWS enforces a minimum 6 hour
                                    cooldown between SSD capacity increases that might delay adjustments.
                                </>
                                <>Only one credential set can manage this feature.</>
                                <>
                                    The maximum SSD capacity for an FSx for ONTAP file system depends on the file system
                                    generation and deployed architecture.{' '}
                                    <ExternalLink
                                        href="https://docs.netapp.com/us-en/ontap"
                                        variant="text"
                                        includeArrow
                                    >
                                        Learn more
                                    </ExternalLink>
                                </>
                            </BulletList>
                            <TrailingText>
                                Select <Span bold>Continue</Span> to enable automatic capacity management.
                            </TrailingText>
                        </Section>
                    </BodyWrapper>
                </ModalContent>
                <ModalFooter>
                    <ButtonsGroup>
                        <Button onClick={onContinue}>Continue</Button>
                        <Button color="secondary" onClick={close}>
                            Cancel
                        </Button>
                    </ButtonsGroup>
                </ModalFooter>
            </Modal>
        );
    }
);
