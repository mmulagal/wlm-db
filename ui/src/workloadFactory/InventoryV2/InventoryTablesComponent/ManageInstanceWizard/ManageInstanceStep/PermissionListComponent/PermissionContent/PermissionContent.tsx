import { DsButton, DsTypography, Popover, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { ReactComponent as Copy } from '../../../../../../../assets/code snippets copy.svg';
import styles from './PermissionContent.module.scss';
import CopyToClipboardCommon from '../../../../../../../common/CopyToClipboard/copyToClipboard';
import DialogComponent from '../../../../../../../common/Dialog/DialogComponent';
import PolicyDialog from './PolicyDialog/PolicyDialog';
import WellArchitectPolicyDialog from './WellArchitectPolicyDialog/WellArchitectPolicyDialog';
import { POLICIES_PERMISSIONS } from '../../../../../../../utils/consts';

type PermissionBlock = {
    label: string;
    values: (string | { title: string; items: string[] })[];
    secondLineValues?: (string | { title: string; items: string[] })[];
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
    policies: any;
    infoBlock?: string;
};

export const PermissionContent: React.FC<AccordionContentProps> = ({ title, blocks, policies, infoBlock }) => {
    const { t } = useTranslation();
    const { setDialog } = useDialog();
    const openDialog = (type: string | undefined, label: string) => {
        let data = null;
        if (label === t('databases.register-flow.aws-iam-policy-permissions')) {
            data = JSON.stringify(
                policies?.packages?.find?.((pkg: any) => pkg?.name === POLICIES_PERMISSIONS.VIEW_POLICY)?.permissions,
                null,
                2
            );
        } else {
            data = JSON.stringify(
                policies?.packages?.find?.((pkg: any) => pkg?.name === POLICIES_PERMISSIONS.INSTANCE_PROFILE_POLICY)
                    ?.permissions,
                null,
                2
            );
        }
        setDialog(
            <DialogComponent
                header={type}
                content={<PolicyDialog data={data} label={label} />}
                primaryButton={t('databases.general.close')}
                callback={() => {}}
            />
        );
    };
    const openWellArchitectPolicyDialog = (type: string | undefined, label: string) => {
        setDialog(
            <DialogComponent
                header={type}
                content={<WellArchitectPolicyDialog data={policies} label={label} />}
                primaryButton={t('databases.general.close')}
                callback={() => {}}
            />
        );
    };
    return (
        <div className={styles['permission-content']}>
            {infoBlock && (
                <div className={styles.infoSection}>
                    <DsTypography variant="Semibold_14" className={styles['info-heading']}>
                        {t('databases.log-analyzer.information')}
                    </DsTypography>
                    <div className={styles['info-block']}>
                        <DsTypography variant="Regular_14">{infoBlock}</DsTypography>
                    </div>
                </div>
            )}
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
                            const inlineSecondLineValues = block?.secondLineValues?.filter(
                                v => typeof v === 'string'
                            ) as string[];
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
                                                        <span className={styles.separator}>|</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                    {inlineSecondLineValues?.length > 0 && (
                                        <div className={styles['inline-container']}>
                                            {inlineSecondLineValues?.map((val, i) => (
                                                <React.Fragment key={i}>
                                                    <span className={styles['value-inline']}>{val}</span>
                                                    {i < inlineSecondLineValues?.length - 1 && (
                                                        <span className={styles.separator}>|</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                    {nestedValues.map((val, i) => (
                                        <div key={i} className={styles['nested-section']}>
                                            <DsTypography variant="Regular_14" className={styles['nested-title']}>
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
                            children={t('databases.general.copied-to-clipboard')}
                            container={<CopyToClipboardCommon value={block.values} iconProvided={<Copy />} />}
                        />
                    )}
                    {block?.viewPolicy?.value && !block?.viewPolicy?.withTabs && (
                        <DsButton type="text" onClick={() => openDialog(block?.dialogHeader, block?.label)}>
                            {t('databases.register-flow.view-policy')}
                        </DsButton>
                    )}

                    {block?.viewPolicy?.value && block?.viewPolicy?.withTabs && (
                        <DsButton
                            type="text"
                            onClick={() => openWellArchitectPolicyDialog(block?.dialogHeader, block?.label)}
                        >
                            {t('databases.register-flow.view-policy')}
                        </DsButton>
                    )}
                </div>
            ))}
        </div>
    );
};
