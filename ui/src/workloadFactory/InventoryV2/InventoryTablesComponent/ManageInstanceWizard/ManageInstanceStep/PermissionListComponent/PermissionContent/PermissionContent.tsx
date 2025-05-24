import styles from './PermissionContent.module.scss';
import { ReactComponent as Copy } from '../../../../../../../assets/code snippets copy.svg';
import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import React from 'react';
import CopyToClipboardCommon from '../../../../../../../common/CopyToClipboard/copyToClipboard';
import DialogComponent from '../../../../../../../common/Dialog/DialogComponent';
import PolicyDialog from './PolicyDialog/PolicyDialog';
import { GENERAL } from '../../../../../../../utils/appConstants';
import WellArchitectPolicyDialog from './WellArchitectPolicyDialog/WellArchitectPolicyDialog';

type PermissionBlock = {
    label: string;
    values: (string | { title: string; items: string[] })[];
    showCopy?: boolean;
    viewPolicy?: {
        value: boolean;
        withTabs?: boolean;
    };
    dialogHeader?: string;
};

type AccordionContentProps = {
    title: string;
    blocks: PermissionBlock[];
};

export const PermissionContent: React.FC<AccordionContentProps> = ({ title, blocks }) => {
    const { setDialog } = useDialog();
    const openDialog = (type: string | undefined, label: string) => {
        const data = 'mockData';
        setDialog(
            <DialogComponent
                header={type}
                content={<PolicyDialog data={data} label={label} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };
    const openWellArchitectPolicyDialog = (type: string | undefined, label: string) => {
        const data = 'mockData';
        setDialog(
            <DialogComponent
                header={type}
                content={<WellArchitectPolicyDialog data={data} label={label} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
    };
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
                    {block?.viewPolicy?.value && !block?.viewPolicy?.withTabs && (
                        <DsButton type="text" onClick={() => openDialog(block?.dialogHeader, block?.label)}>
                            View policy
                        </DsButton>
                    )}

                    {block?.viewPolicy?.value && block?.viewPolicy?.withTabs && (
                        <DsButton
                            type="text"
                            onClick={() => openWellArchitectPolicyDialog(block?.dialogHeader, block?.label)}
                        >
                            View policy
                        </DsButton>
                    )}
                </div>
            ))}
        </div>
    );
};
