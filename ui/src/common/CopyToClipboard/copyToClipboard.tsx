import React, { useRef, useState } from 'react';
import { ReactComponent as CopyIcon } from '@netapp/icons/ic_copy.svg';
import { DsTooltipInfo, DsTypography } from '@netapp/design-system';
import styles from './copyToClipboard.module.scss';

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
        try {
            // Create a temporary textarea element
            const textarea = document.createElement('textarea');
            textarea.value = value; // Set the text to copy
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px'; // Move it offscreen
            document.body.appendChild(textarea); // Append to the document

            // Select the text and copy
            textarea.select();
            document.execCommand('copy'); // Fallback method for older browsers

            // Clean up
            document.body.removeChild(textarea);

            // Show success message
            setVisible(true);
            setTimeout(() => setVisible(false), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className={styles.copyToClipboardContainer}>
            <textarea
                className={styles.contentForCopy}
                // @ts-ignore
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
                        {iconProvided || <CopyIcon className={styles.copyToClipboard} />}
                    </div>
                }
            >
                <DsTypography
                    style={{ display: tooltipMessage ? 'block' : 'none' }}
                    className={styles.tooltipDescription}
                    variant="Regular_14"
                >
                    {tooltipTitle}
                </DsTypography>
            </DsTooltipInfo>
        </div>
    );
};

export default CopyToClipboardCommon;
