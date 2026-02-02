import React from 'react';
import { useTranslation } from 'react-i18next';
import { DsFlashingDotsLoader, DsTooltipInfo, DsTypography } from '@tlveng/wlm-ds';
import styles from './ManageInstanceAccordion.module.scss';
import { ReactComponent as Arrow } from '../../../../../../assets/row arrow2.svg';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { ReactComponent as InfoIcon } from '../../../../../../assets/ic_info.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { ACTION_TYPE, DBType } from '../../../../../../utils/consts';

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
    type?: string;
    readinessCounts?: Record<string, { ready: number; total: number; missingInstances?: string[] }> | null;
    engineType?: string;
};

export const ManageInstanceAccordion: React.FC<AccordionProps> = ({
    items,
    expandedId,
    setExpandedId,
    disableAll = false,
    loading = false,
    errorInvestigationLoading = false,
    type,
    readinessCounts = null,
    engineType
}) => {
    const { t } = useTranslation();
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    // Helper to get capability key from item id based on engine type
    const getCapabilityKey = (itemId: string, engine?: string): string | null => {
        // Oracle has 3 capabilities: assessment, remediation, errorInvestigation
        if (engine === DBType.ORACLE) {
            const oracleMapping: Record<string, string> = {
                '1': 'assessment',
                '2': 'remediation',
                '5': 'errorInvestigation'
            };
            return oracleMapping[itemId] || null;
        }
        // MSSQL has 5 capabilities
        const mssqlMapping: Record<string, string> = {
            '1': 'assessment',
            '2': 'remediation',
            '3': 'dbcreation',
            '4': 'sandbox',
            '5': 'errorInvestigation'
        };
        return mssqlMapping[itemId] || null;
    };

    const handleToggle = (id: string) => {
        if (disableAll) return;
        setExpandedId((prev: any) => (prev === id ? null : id));
    };

    const readinessString = (readinessStr: any) => {
        if (readinessStr === 'Ready') {
            return t('databases.log-analyzer.readiness-status-complete');
        }
        if (readinessStr === 'Missing') {
            return t('databases.log-analyzer.readiness-status-incomplete');
        }
        return readinessStr;
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
                                        {loading || (errorInvestigationLoading && item?.id === '5') ? (
                                            <div className={styles.loadingSection}>
                                                <DsFlashingDotsLoader />
                                            </div>
                                        ) : (
                                            <div className={styles.statusSection}>
                                                {!item?.missingPermission && <Success />}
                                                {item?.missingPermission && <Cross />}
                                                <DsTypography variant="Semibold_14">
                                                    {readinessString(item.readinessStatus)}
                                                </DsTypography>
                                            </div>
                                        )}
                                        <DsTypography variant="Regular_14">
                                            {t('databases.register-flow.readiness')}
                                        </DsTypography>
                                    </div>
                                </div>
                                <div className={styles['accordion-status']}>
                                    {type !== 'log-analyzer' && (
                                        <DsTypography className={styles.text} variant="Semibold_14">
                                            {t('databases.register-flow.view-prerequisites-list')}
                                        </DsTypography>
                                    )}
                                    {type === 'log-analyzer' && (
                                        <DsTypography className={styles.text} variant="Semibold_14">
                                            {t('databases.log-analyzer.setup-details')}
                                        </DsTypography>
                                    )}
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
                                        </div>
                                        <DsTypography variant="Regular_14">{item.subtitle}</DsTypography>
                                    </div>
                                </div>

                                {/* Readiness status column for bulk MSSQL/Oracle */}
                                {(engineType === DBType.MSSQL || engineType === DBType.ORACLE) &&
                                    readinessCounts &&
                                    (() => {
                                        const capKey = getCapabilityKey(item.id, engineType);
                                        const counts = capKey ? readinessCounts[capKey] : null;

                                        if (!counts) return null;

                                        // Show loading indicator for errorInvestigation while API call is in progress
                                        const isErrorInvestigationLoading =
                                            errorInvestigationLoading && item?.id === '5';

                                        if (isErrorInvestigationLoading) {
                                            return (
                                                <div className={styles.readinessSectionBulk}>
                                                    <div className={styles.statusRow}>
                                                        <DsFlashingDotsLoader />
                                                    </div>
                                                    <DsTypography variant="Regular_14">
                                                        {t('databases.register-flow.readiness')}
                                                    </DsTypography>
                                                </div>
                                            );
                                        }

                                        const allReady = counts.ready === counts.total && counts.total > 0;
                                        const noneReady = counts.ready === 0;
                                        const partialReady = counts.ready > 0 && counts.ready < counts.total;

                                        return (
                                            <div className={styles.readinessSectionBulk}>
                                                <div className={styles.statusRow}>
                                                    {allReady && (
                                                        <span className={styles.iconWrapper}>
                                                            <Success className={styles.statusIcon} />
                                                        </span>
                                                    )}
                                                    {noneReady && (
                                                        <span className={styles.iconWrapper}>
                                                            <Cross
                                                                className={`${styles.statusIcon} ${styles.greyIcon}`}
                                                            />
                                                        </span>
                                                    )}
                                                    {partialReady && (
                                                        <DsTooltipInfo
                                                            placement="bottom"
                                                            trigger="hover"
                                                            icon={<InfoIcon className={styles.blueIcon} />}
                                                        >
                                                            <div className={styles.tooltipContent}>
                                                                <DsTypography variant="Semibold_14">
                                                                    {t('databases.register-flow.missing-prerequisite')}
                                                                </DsTypography>
                                                                {counts.missingInstances?.map(name => (
                                                                    <React.Fragment key={name}>
                                                                        <hr className={styles.tooltipDivider} />
                                                                        <DsTypography variant="Regular_14">
                                                                            {name}
                                                                        </DsTypography>
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        </DsTooltipInfo>
                                                    )}
                                                    <DsTypography variant="Semibold_14">
                                                        {allReady && t('databases.register-flow.prepare-all-ready')}
                                                        {noneReady && t('databases.register-flow.prepare-none-ready')}
                                                        {partialReady &&
                                                            t('databases.register-flow.prepare-partial-ready', {
                                                                readyCount: counts.ready,
                                                                totalCount: counts.total
                                                            })}
                                                    </DsTypography>
                                                </div>
                                                <DsTypography variant="Regular_14">
                                                    {t('databases.register-flow.readiness')}
                                                </DsTypography>
                                            </div>
                                        );
                                    })()}

                                <div className={styles['accordion-status']}>
                                    <DsTypography className={styles.text} variant="Semibold_14">
                                        {engineType === DBType.MSSQL || engineType === DBType.ORACLE
                                            ? t('databases.log-analyzer.setup-details')
                                            : t('databases.register-flow.view-prerequisites-list')}
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
