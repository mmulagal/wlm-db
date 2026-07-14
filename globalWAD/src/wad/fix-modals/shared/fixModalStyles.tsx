import { memo, type ReactNode, Children } from 'react';
import styled from '@emotion/styled';
import { Modal, NumberedList, Text } from '@netapp/bxp-design-system-react';

const fullWidthStyle = { width: '100%' } as const;

export const HeightCapModal = styled(Modal)`
    max-height: 640px;
`;

export const FixModalSection = styled.div`
    margin-bottom: 24px;
`;

export const FixModalSectionTitle = styled(Text)`
    margin-bottom: 8px;
`;

interface FixModalNumberedListProps {
    children: ReactNode;
    dataTestId?: string;
}

export const FixModalNumberedList = memo(({ children, dataTestId }: FixModalNumberedListProps) => (
    <NumberedList
        className="w-full"
        liClassName="w-full"
        includeTitles={false}
        style={fullWidthStyle}
        liStyle={fullWidthStyle}
        dataTestId={dataTestId}
    >
        {Children.toArray(children)}
    </NumberedList>
));
