import React, { useRef, useState } from 'react';
import styles from './copyToClipboard.module.scss';
import { ReactComponent as CopyIcon } from '@netapp/icons/ic_copy.svg';
import { DsTooltipInfo, DsTypography } from '@netapp/design-system';

interface CopyToClipboardProps {
    tooltipTitle?: string;
    value: string | any;
    className?: string;
    iconProvided?: any;
    tooltipMessage?: boolean;
}

const CopyToClipboardCommon = ({
    value = '',
    tooltipTitle,
    className,
    iconProvided,
    tooltipMessage = false
}: CopyToClipboardProps) => {
    const contentForCopyRef = useRef<HTMLInputElement>(null);

    const [visible, setVisible] = useState<boolean>(false);

    const handleCopy = () => {
        if (contentForCopyRef.current) {
            contentForCopyRef.current.select(); // Select the text in the textarea
            navigator.clipboard
                .writeText(contentForCopyRef.current.value) // Use Clipboard API to copy
                .then(() => {
                    setVisible(true);
                    setTimeout(() => setVisible(false), 1500); // Show tooltip for 1.5 seconds
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                });
        }
    };

    return (
        <div className={styles.copyToClipboardContainer}>
            <textarea
                className={styles.contentForCopy}
                //@ts-ignore
                ref={contentForCopyRef}
                readOnly
                value={value}
                style={{ position: 'absolute', left: '-9999px' }} // Hide textarea offscreen
            />
            <DsTooltipInfo
                placement="bottomRight"
                trigger="click"
                className={tooltipMessage ? styles.tooltipCopyClipShowMessage : styles.tooltipCopyClipNotShowMessage}
                status={visible ? 'opened' : 'closed'}
                icon={
                    <div onClick={() => handleCopy()}>
                        {iconProvided ? iconProvided : <CopyIcon className={styles.copyToClipboard} />}
                    </div>
                }
            >
                <DsTypography
                    style={{ display: tooltipMessage ? 'block' : 'none' }}
                    className={styles['tooltipDescription']}
                    variant="Regular_14"
                >
                    {tooltipTitle}
                </DsTypography>
            </DsTooltipInfo>
        </div>
    );
};

export default CopyToClipboardCommon;
