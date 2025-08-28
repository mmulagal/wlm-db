import React from 'react';
import { useTranslation } from 'react-i18next';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import styles from './ManageInstanceAccordion.module.scss';
import { ReactComponent as Arrow } from '../../../../../../assets/row arrow2.svg';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { ACTION_TYPE } from '../../../../../../utils/consts';

export type AccordionItem = {
    id: string;
    title: string;
    subtitle?: string;
    readinessStatus: string;
    disabled?: boolean;
    content: React.ReactNode;
    image: any;
    missingPermission?: boolean;
};

type AccordionProps = {
    items: AccordionItem[];
    expandedId: string | null;
    setExpandedId: any;
    disableAll?: boolean;
    loading?: boolean;
    errorInvestigationLoading?: boolean;
};

export const ManageInstanceAccordion: React.FC<AccordionProps> = ({
    items,
    expandedId,
    setExpandedId,
    disableAll = false,
    loading = false,
    errorInvestigationLoading = false
}) => {
    const { t } = useTranslation();
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    const handleToggle = (id: string) => {
        if (disableAll) return;
        setExpandedId((prev: any) => (prev === id ? null : id));
    };

    return (
        <div className={styles['accordion-container']}>
            {items.map(item => (
                <div
                    key={item.id}
                    className={`${styles['accordion-item']} 
            ${expandedId === item.id ? styles.expanded : ''} 
            ${wizardOperationType !== ACTION_TYPE.BULK ? disableAll || item.disabled : false ? styles.disabled : ''}`}
                >
                    <div className={styles['accordion-header-wrapper']}>
                        {wizardOperationType !== ACTION_TYPE.BULK && (
                            <div className={styles['accordion-header']} onClick={() => handleToggle(item.id)}>
                                <div className={styles['accordion-title']}>
                                    <div className={styles.imageContainer}>{item.image}</div>

                                    <div className={styles.valueSection}>
                                        <DsTypography variant="Semibold_14">{item.title}</DsTypography>
                                        <DsTypography variant="Regular_14">{item.subtitle}</DsTypography>
                                    </div>
                                </div>

                                <div className={styles.readinessSection}>
                                    <div className={styles.valueSection}>
                                        {loading ||
                                        (errorInvestigationLoading && item?.title === 'Error investigation') ? (
                                            <div className={styles.loadingSection}>
                                                <DsFlashingDotsLoader />
                                            </div>
                                        ) : (
                                            <div className={styles.statusSection}>
                                                {!item?.missingPermission && <Success />}
                                                {item?.missingPermission && <Cross />}
                                                <DsTypography variant="Semibold_14">
                                                    {item.readinessStatus}
                                                </DsTypography>
                                            </div>
                                        )}

                                        <DsTypography variant="Regular_14">
                                            {t('databases.register-flow.readiness')}
                                        </DsTypography>
                                    </div>
                                </div>
                                <div className={styles['accordion-status']}>
                                    <DsTypography className={styles.text} variant="Semibold_14">
                                        {t('databases.register-flow.view-prerequisites-list')}
                                    </DsTypography>
                                    <Arrow />
                                </div>
                            </div>
                        )}
                        {wizardOperationType === ACTION_TYPE.BULK && (
                            <div className={styles['accordion-header-bulk']} onClick={() => handleToggle(item.id)}>
                                <div className={styles['accordion-title-bulk']}>
                                    <div className={styles.imageContainer}>{item.image}</div>

                                    <div className={styles.valueSection}>
                                        <div className={styles.nameSection}>
                                            <DsTypography variant="Semibold_14">{item.title}</DsTypography>
                                            {errorInvestigationLoading && item?.title === 'Error investigation' && (
                                                <DsFlashingDotsLoader />
                                            )}
                                        </div>
                                        <DsTypography variant="Regular_14">{item.subtitle}</DsTypography>
                                    </div>
                                </div>

                                <div className={styles['accordion-status']}>
                                    <DsTypography className={styles.text} variant="Semibold_14">
                                        {t('databases.register-flow.view-prerequisites-list')}
                                    </DsTypography>
                                    <Arrow />
                                </div>
                            </div>
                        )}
                    </div>
                    {expandedId === item.id && <div className={styles['accordion-content']}>{item.content}</div>}
                </div>
            ))}
        </div>
    );
};
