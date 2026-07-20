import { ReactNode, useEffect, useRef, useState } from 'react';
import styles from './EllipsisTooltipText.module.scss';

type EllipsisTooltipTextProps = {
    text: string;
    className?: string;
    wrapperClassName?: string;
    children?: ReactNode;
};

const EllipsisTooltipText = ({ text, className = '', wrapperClassName = '', children }: EllipsisTooltipTextProps) => {
    const textRef = useRef<HTMLSpanElement>(null);
    const [isTruncated, setIsTruncated] = useState(false);

    useEffect(() => {
        const element = textRef.current;
        if (!element) {
            return undefined;
        }

        const updateTruncation = () => {
            setIsTruncated(element.scrollWidth > element.clientWidth);
        };

        updateTruncation();

        const resizeObserver = new ResizeObserver(updateTruncation);
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [text]);

    return (
        <span
            ref={textRef}
            className={`${styles.ellipsisText} ${className} ${wrapperClassName}`}
            title={isTruncated ? text : undefined}
        >
            {children ?? text}
        </span>
    );
};

export default EllipsisTooltipText;
