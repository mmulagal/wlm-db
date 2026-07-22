import type { ReactNode } from 'react';

type StubProps = {
    children?: ReactNode;
    dataTestId?: string;
    onClick?: () => void;
    [key: string]: unknown;
};

const stub =
    (name: string) =>
    ({ children, dataTestId, onClick, ...rest }: StubProps) => (
        <div data-testid={dataTestId ?? name} onClick={onClick} role={onClick ? 'button' : undefined} {...rest}>
            {children}
        </div>
    );

export const InlineNotification = ({ children, ...rest }: StubProps) => (
    <div data-testid="InlineNotification" {...rest}>
        {children}
    </div>
);

export const Modal = stub('Modal');
export const ModalContent = stub('ModalContent');
export const ModalFooter = stub('ModalFooter');
export const ModalHeader = stub('ModalHeader');
export const Button = stub('Button');
export const ButtonsGroup = ({ children }: StubProps) => <div>{children}</div>;
export const Text = ({ children }: StubProps) => <span>{children}</span>;
export const NumberedList = ({ children, dataTestId }: StubProps) => (
    <ol data-testid={dataTestId ?? 'NumberedList'}>{children}</ol>
);
export const BulletList = ({ children }: StubProps) => <ul>{children}</ul>;
export const InlineLoader = () => <div data-testid="InlineLoader" />;
