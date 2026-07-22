import React from 'react';
import { useTranslation } from 'react-i18next';
import { Popover } from '@netapp/design-system';
import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import styles from './ManageInstanceAccordion.module.scss';
import CommonStyles from '../../../../../../utils/CommonStyles.module.scss';
import { ReactComponent as Arrow } from '../../../../../../assets/row arrow2.svg';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { ReactComponent as InfoIcon } from '../../../../../../assets/ic_info.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { ACTION_TYPE, DBType, MANAGE_STATES } from '../../../../../../utils/consts';
import SeparatorComponent from '../../../../../../common/SeparatorComponent/SeparatorComponent';

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
    prerequisitesLoading?: boolean;
    type?: string;
    readinessCounts?: Record<
        string,
        { ready: number; total: number; missingInstances?: { name: string; hostName: string }[] }
    > | null;
    engineType?: string;
    aiAnalysisEnabled?: boolean;
};

export const ManageInstanceAccordion: React.FC<AccordionProps> = ({
    items,
    expandedId,
    setExpandedId,
    disableAll = false,
    loading = false,
    errorInvestigationLoading = false,
    prerequisitesLoading = false,
    type,
    readinessCounts = null,
    engineType,
    aiAnalysisEnabled = true
}) => {
    const { t } = useTranslation();
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);

    // Helper to get capability key from item id based on engine type
    const getCapabilityKey = (itemId: string, engine?: string): string | null => {
        // Oracle has 2 capabilities: remediation, errorInvestigation
        if (engine === DBType.ORACLE) {
            const oracleMapping: Record<string, string> = {
                '1': 'remediation',
                '2': 'errorInvestigation'
            };
            return oracleMapping[itemId] || null;
        }
        // MSSQL has 4 capabilities
        const mssqlMapping: Record<string, string> = {
            '1': 'remediation',
            '2': 'dbcreation',
            '3': 'sandbox',
            '4': 'errorInvestigation'
        };
        return mssqlMapping[itemId] || null;
    };

    // Helper to check if an item is Error analysis
    const isErrorAnalysisItem = (itemId: string, engine?: string): boolean => {
        const capabilityKey = getCapabilityKey(itemId, engine);
        return capabilityKey === 'errorInvestigation';
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
        if (readinessStr === MANAGE_STATES.AI_ANALYSIS_DISABLED) {
            return t('databases.log-analyzer.readiness-status-incomplete');
        }
        return readinessStr;
    };

    return (
        <div className={styles['accordion-container']}>
            {items.map(item => {
                const isAiAnalysisDisabledRow =
                    !aiAnalysisEnabled &&
                    (type === 'log-analyzer' || item.readinessStatus === MANAGE_STATES.AI_ANALYSIS_DISABLED);
                const disabledTextClass = isAiAnalysisDisabledRow ? styles.disabledText : '';

                return (
                    <div
                        key={item.id}
                        className={`${styles['accordion-item']} 
            ${expandedId === item.id ? styles.expanded : ''} 
            ${wizardOperationType !== ACTION_TYPE.BULK && (disableAll || item.disabled) ? styles.disabled : ''}`}
                    >
                        <div className={styles['accordion-header-wrapper']}>
                            {wizardOperationType !== ACTION_TYPE.BULK && (
                                <>
                                    {isAiAnalysisDisabledRow && type !== 'log-analyzer' ? (
                                        <Popover
                                            trigger="hover"
                                            container={
                                                <div className={styles['accordion-header']}>
                                                    <div className={styles['accordion-title']}>
                                                        <div className={styles.imageContainer}>{item.image}</div>
                                                        <div className={styles.valueSection}>
                                                            <DsTypography
                                                                variant="Semibold_14"
                                                                className={disabledTextClass}
                                                            >
                                                                {item.title}
                                                            </DsTypography>
                                                            <DsTypography
                                                                variant="Regular_14"
                                                                className={disabledTextClass}
                                                            >
                                                                {item.subtitle}
                                                            </DsTypography>
                                                        </div>
                                                    </div>
                                                    <div className={styles.readinessSection}>
                                                        <div className={styles.valueSection}>
                                                            {loading ||
                                                            (errorInvestigationLoading &&
                                                                isErrorAnalysisItem(item?.id, engineType)) ||
                                                            (prerequisitesLoading &&
                                                                !isErrorAnalysisItem(item?.id, engineType)) ? (
                                                                <div className={styles.loadingSection}>
                                                                    <DsFlashingDotsLoader />
                                                                </div>
                                                            ) : (
                                                                <div className={styles.statusSection}>
                                                                    {!item?.missingPermission && <Success />}
                                                                    {item?.missingPermission && <Cross />}
                                                                    <DsTypography
                                                                        variant="Semibold_14"
                                                                        className={disabledTextClass}
                                                                    >
                                                                        {readinessString(item.readinessStatus)}
                                                                    </DsTypography>
                                                                </div>
                                                            )}
                                                            <DsTypography
                                                                variant="Regular_14"
                                                                className={disabledTextClass}
                                                            >
                                                                {t('databases.register-flow.readiness')}
                                                            </DsTypography>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={`${styles['accordion-status']} ${styles.disabledAccordionStatus}`}
                                                    >
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
                                            }
                                        >
                                            {t('databases.log-analyzer.ai-analysis-disabled')}
                                        </Popover>
                                    ) : (
                                        <div
                                            className={styles['accordion-header']}
                                            onClick={() => !isAiAnalysisDisabledRow && handleToggle(item.id)}
                                        >
                                            <div className={styles['accordion-title']}>
                                                <div className={styles.imageContainer}>{item.image}</div>
                                                <div className={styles.valueSection}>
                                                    <DsTypography variant="Semibold_14" className={disabledTextClass}>
                                                        {item.title}
                                                    </DsTypography>
                                                    <DsTypography variant="Regular_14" className={disabledTextClass}>
                                                        {item.subtitle}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                            <div className={styles.readinessSection}>
                                                <div className={styles.valueSection}>
                                                    {loading ||
                                                    (errorInvestigationLoading &&
                                                        isErrorAnalysisItem(item?.id, engineType)) ||
                                                    (prerequisitesLoading &&
                                                        !isErrorAnalysisItem(item?.id, engineType)) ? (
                                                        <div className={styles.loadingSection}>
                                                            <DsFlashingDotsLoader />
                                                        </div>
                                                    ) : (
                                                        <div className={styles.statusSection}>
                                                            {!item?.missingPermission && <Success />}
                                                            {item?.missingPermission && <Cross />}
                                                            <DsTypography
                                                                variant="Semibold_14"
                                                                className={disabledTextClass}
                                                            >
                                                                {readinessString(item.readinessStatus)}
                                                            </DsTypography>
                                                        </div>
                                                    )}
                                                    <DsTypography variant="Regular_14" className={disabledTextClass}>
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
                                </>
                            )}
                            {wizardOperationType === ACTION_TYPE.BULK && (
                                <Popover
                                    trigger="hover"
                                    container={
                                        <div
                                            className={styles['accordion-header-bulk']}
                                            onClick={() => !isAiAnalysisDisabledRow && handleToggle(item.id)}
                                        >
                                            <div className={styles['accordion-title-bulk']}>
                                                <div className={styles.imageContainer}>{item.image}</div>

                                                <div className={styles.valueSection}>
                                                    <div className={styles.nameSection}>
                                                        <DsTypography
                                                            variant="Semibold_14"
                                                            className={disabledTextClass}
                                                        >
                                                            {item.title}
                                                        </DsTypography>
                                                    </div>
                                                    <DsTypography variant="Regular_14" className={disabledTextClass}>
                                                        {item.subtitle}
                                                    </DsTypography>
                                                </div>
                                            </div>

                                            {/* Readiness status column for bulk MSSQL/Oracle */}
                                            {(engineType === DBType.MSSQL || engineType === DBType.ORACLE) &&
                                                readinessCounts &&
                                                (() => {
                                                    const capKey = getCapabilityKey(item.id, engineType);
                                                    const counts = capKey ? readinessCounts[capKey] : null;

                                                    if (!counts) return null;

                                                    if (isAiAnalysisDisabledRow) {
                                                        return (
                                                            <div className={styles.readinessSectionBulk}>
                                                                <div className={styles.statusRow}>
                                                                    <span className={styles.iconWrapper}>
                                                                        <Cross
                                                                            className={`${styles.statusIcon} ${styles.greyIcon}`}
                                                                        />
                                                                    </span>
                                                                    <DsTypography
                                                                        variant="Semibold_14"
                                                                        className={disabledTextClass}
                                                                    >
                                                                        {t(
                                                                            'databases.log-analyzer.readiness-status-incomplete'
                                                                        )}
                                                                    </DsTypography>
                                                                </div>
                                                                <DsTypography
                                                                    variant="Regular_14"
                                                                    className={disabledTextClass}
                                                                >
                                                                    {t('databases.register-flow.readiness')}
                                                                </DsTypography>
                                                            </div>
                                                        );
                                                    }

                                                    // Show loading indicator for errorInvestigation while API call is in progress
                                                    // Also show loading for other checks when prerequisitesLoading is true
                                                    const isErrorAnalysis = isErrorAnalysisItem(item?.id, engineType);
                                                    const isLoadingThisCheck =
                                                        (errorInvestigationLoading && isErrorAnalysis) ||
                                                        (prerequisitesLoading && !isErrorAnalysis);

                                                    if (isLoadingThisCheck) {
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
                                                    const partialReady =
                                                        counts.ready > 0 && counts.ready < counts.total;

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
                                                                    <Popover
                                                                        popoverClass={CommonStyles.scrollablePopover}
                                                                        trigger="hover"
                                                                        placement="bottom"
                                                                        delayHide={200}
                                                                        interactive
                                                                        isAppendedToBody
                                                                        container={
                                                                            <InfoIcon className={styles.blueIcon} />
                                                                        }
                                                                    >
                                                                        <div
                                                                            className={
                                                                                CommonStyles.popoverTooltipContent
                                                                            }
                                                                        >
                                                                            <DsTypography
                                                                                variant="Semibold_14"
                                                                                className={
                                                                                    CommonStyles.popoverTooltipTitle
                                                                                }
                                                                            >
                                                                                {t(
                                                                                    'databases.register-flow.missing-prerequisite'
                                                                                )}
                                                                            </DsTypography>
                                                                            {counts.missingInstances?.map(instance => (
                                                                                <React.Fragment
                                                                                    key={`${instance.name}-${instance.hostName}`}
                                                                                >
                                                                                    <SeparatorComponent variant="horizontal" />
                                                                                    <div
                                                                                        className={
                                                                                            CommonStyles.popoverInstanceHostRow
                                                                                        }
                                                                                    >
                                                                                        <DsTypography variant="Semibold_14">
                                                                                            {instance.name}
                                                                                        </DsTypography>
                                                                                        <DsTypography variant="Regular_14">
                                                                                            {t(
                                                                                                'databases.general.host'
                                                                                            )}
                                                                                            {': '}
                                                                                            {instance.hostName}
                                                                                        </DsTypography>
                                                                                    </div>
                                                                                </React.Fragment>
                                                                            ))}
                                                                        </div>
                                                                    </Popover>
                                                                )}
                                                                <DsTypography variant="Semibold_14">
                                                                    {allReady &&
                                                                        t('databases.register-flow.prepare-all-ready')}
                                                                    {noneReady &&
                                                                        t('databases.register-flow.prepare-none-ready')}
                                                                    {partialReady &&
                                                                        t(
                                                                            'databases.register-flow.prepare-partial-ready',
                                                                            {
                                                                                readyCount: counts.ready,
                                                                                totalCount: counts.total
                                                                            }
                                                                        )}
                                                                </DsTypography>
                                                            </div>
                                                            <DsTypography variant="Regular_14">
                                                                {t('databases.register-flow.readiness')}
                                                            </DsTypography>
                                                        </div>
                                                    );
                                                })()}

                                            <div
                                                className={`${styles['accordion-status']} ${
                                                    isAiAnalysisDisabledRow ? styles.disabledAccordionStatus : ''
                                                }`}
                                            >
                                                <DsTypography className={styles.text} variant="Semibold_14">
                                                    {engineType === DBType.MSSQL || engineType === DBType.ORACLE
                                                        ? t('databases.log-analyzer.setup-details')
                                                        : t('databases.register-flow.view-prerequisites-list')}
                                                </DsTypography>
                                                <Arrow />
                                            </div>
                                        </div>
                                    }
                                >
                                    {isAiAnalysisDisabledRow ? t('databases.log-analyzer.ai-analysis-disabled') : ''}
                                </Popover>
                            )}
                        </div>
                        {expandedId === item.id && <div className={styles['accordion-content']}>{item.content}</div>}
                    </div>
                );
            })}
        </div>
    );
};
