import styles from './PermissionContent.module.scss';
import { ReactComponent as Copy } from '../../../../../../../assets/code snippets copy.svg';
import { DsTypography, Popover } from '@netapp/design-system';
import React from 'react';
import CopyToClipboardCommon from '../../../../../../../common/CopyToClipboard/copyToClipboard';

type PermissionBlock = {
    label: string;
    values: (string | { title: string; items: string[] })[];
    showCopy?: boolean;
};

type AccordionContentProps = {
    title: string;
    blocks: PermissionBlock[];
};

export const PermissionContent: React.FC<AccordionContentProps> = ({ title, blocks }) => {
    return (
        <div className={styles['permission-content']}>
            <DsTypography className={styles['permission-title']} variant="Semibold_14">
                {title}
            </DsTypography>
            {blocks.map((block, index) => (
                <div key={index} className={styles['permission-row']}>
                    <DsTypography variant="Semibold_14" className={styles['permission-label']}>
                        {block.label}
                    </DsTypography>
                    <div className={styles['permission-value']}>
                        {(() => {
                            const inlineValues = block.values.filter(v => typeof v === 'string') as string[];
                            const nestedValues = block.values.filter(v => typeof v === 'object') as {
                                title: string;
                                items: string[];
                            }[];

                            return (
                                <>
                                    {inlineValues.length > 0 && (
                                        <div className={styles['inline-container']}>
                                            {inlineValues.map((val, i) => (
                                                <React.Fragment key={i}>
                                                    <span className={styles['value-inline']}>{val}</span>
                                                    {i < inlineValues.length - 1 && (
                                                        <span className={styles['separator']}>|</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                    {nestedValues.map((val, i) => (
                                        <div key={i} className={styles['nested-section']}>
                                            <DsTypography variant="Semibold_14" className={styles['nested-title']}>
                                                {val.title}
                                            </DsTypography>
                                            {val.items.map((item, idx) => (
                                                <DsTypography variant="Regular_14" key={idx}>
                                                    {item}
                                                </DsTypography>
                                            ))}
                                        </div>
                                    ))}
                                </>
                            );
                        })()}
                    </div>
                    {block.showCopy && (
                        <Popover
                            popoverClass={styles['copy-popover']}
                            children={'Copied to clipboard'}
                            container={<CopyToClipboardCommon value={block.values} iconProvided={<Copy />} />}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};
