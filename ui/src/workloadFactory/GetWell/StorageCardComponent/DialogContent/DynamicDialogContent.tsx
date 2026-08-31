/**
 * DynamicDialogContent - Single Dynamic Dialog for ALL GetWell Configs
 *
 * Replaces ALL separate dialog files and switch-case logic.
 * Renders dialog content from DIALOG_CONTENT_MAP in the registry using i18n keys and API data.
 * Supports: text sections, bullets, numbered steps, code boxes, permissions,
 */

import { useState, useEffect, useMemo } from 'react';
import { DsTypography, SelectField, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsCheckbox } from '@tlveng/wlm-ds';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import {
    ASSESSMENT_CONFIG_IDS,
    ASSESSMENT_CONFIG_NAMES,
    DBType,
    PATCH_SCAN_FIELD,
    WELL_ARCHITECTED_STATUS,
    WIZARD_TYPE
} from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setRecommendedInstanceInBulk,
    setSelectedRecommendedInstance
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    setRequireAcknowledge,
    setDialogErrorWithTooltip,
    resetDialogComponent
} from '../../../../store/workloadFactory/dialogComponentSlice';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../utils/apiService';
import { getTableLazyLoadingComponentProps } from '../../../../common/Lib/Table/tableLazyLoadingProps';
import { getLinkedConfigNames } from '../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import LinkedConfigBanner from '../../../../common/LinkedConfigBanner/LinkedConfigBanner';
import {
    createSection,
    createContentWithBullets,
    createCodeBox,
    createStandardNotesSection,
    createOSNotesSection,
    createFailoverClusterNotesSection,
    createClusterQuorumSQLNotesSection,
    createDriveLetterNotesSection,
    createNumberedActionSteps,
    createCodeBoxWithCopy
} from './DialogContentHelper';
import ScheduledAWSBackupDialog from './ScheduledAWSBackupDialog';
import {
    getDialogContentConfig,
    DialogSectionDef,
    DialogContentConfig,
    hasFixSupport
} from '../../../../utils/configRegistry';
import { ViolationObject } from '../../../../utils/types/getWellTypes';

interface RecommendationOption {
    instanceType?: string;
    rank?: number;
    savingsOpportunity?: { savingsOpportunityPercentage?: number };
    [key: string]: unknown;
}

interface BulkRecommendationOption {
    hostName?: string;
    recommendationOptions?: RecommendationOption[];
    missingPermissions?: boolean;
    [key: string]: unknown;
}

interface DynamicDialogContentProps {
    configId: string;
    configName?: string;
    engineType: string;
    isWad?: boolean;
    assessmentStatus?: boolean;
    status?: string;
    missingPermissions?: string[];
    objectsInViolation?: Array<string | ViolationObject>;
    recommendationOptions?: RecommendationOption[];
    bulkRecommendationOptions?: BulkRecommendationOption[];
    operation?: string;
    recommendedSizeInGib?: number;
}

const DynamicDialogContent = ({
    configId,
    configName,
    engineType,
    isWad = false,
    status,
    missingPermissions,
    objectsInViolation,
    recommendationOptions = [],
    bulkRecommendationOptions = [],
    operation = 'single',
    recommendedSizeInGib
}: DynamicDialogContentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const driftAssessmentData = useAppSelector(state => state.getWellOptimize.driftAssessmentData);
    const { selectedRecommendedInstance, recommendedInstanceInBulk } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    // Get user-friendly engine name for i18n substitution
    const engineDisplayName = useMemo(() => {
        if (engineType === DBType.MSSQL) return 'SQL Server';
        if (engineType === DBType.ORACLE) return 'Oracle';
        return engineType;
    }, [engineType]);

    // Default translation params (can be overridden by section-specific params)
    const defaultTranslationParams = useMemo(
        () => ({
            engineType: engineDisplayName
        }),
        [engineDisplayName]
    );

    // Resolve dialog config from registry
    const dialogConfig = getDialogContentConfig(configId, engineType);

    // Resolve conditional overrides
    const resolvedConfig = useMemo((): DialogContentConfig | undefined => {
        if (!dialogConfig) return undefined;
        if (!dialogConfig.conditionalOverrides?.length) return dialogConfig;

        for (const override of dialogConfig.conditionalOverrides) {
            const { field, equals } = override.when;
            let fieldValue: string | undefined;

            if (field === 'status') fieldValue = status?.toLowerCase();
            else if (field === 'hasMissingPermissions')
                fieldValue = missingPermissions && missingPermissions.length > 0 ? 'true' : 'false';

            if (fieldValue === equals) {
                return {
                    ...dialogConfig,
                    sections: override.sections,
                    notes: override.notes !== undefined ? override.notes : dialogConfig.notes
                };
            }
        }
        return dialogConfig;
    }, [dialogConfig, status, missingPermissions, configId]);

    // Linked config banner state (Oracle layout configs only)
    // Check showLinkedConfigBannerInDialog if present, otherwise fall back to showLinkedConfigBanner.
    // Only layout configs that are still not-optimized appear in the banner; if all three are
    // optimized the banner is hidden entirely. Redo logs placement has an extra exclusion: if
    // its recommended is "Multiplexed copies on two or more volumes" the violation is about
    // multiplexing only, so it is also hidden.
    const linkedConfigNames = useMemo(() => {
        const showInDialog = resolvedConfig?.features?.showLinkedConfigBannerInDialog;
        if (showInDialog === false) return [];
        if (showInDialog === true || resolvedConfig?.features?.showLinkedConfigBanner) {
            const EXCLUDED_RECOMMENDED = 'Multiplexed copies on two or more volumes';
            return getLinkedConfigNames(configId).filter(layoutConfig => {
                const assessmentItem = driftAssessmentData?.assessments?.find(a => a.name === layoutConfig);
                if (!assessmentItem || assessmentItem.status !== WELL_ARCHITECTED_STATUS.NOT_OPTIMIZED) return false;
                if (layoutConfig === ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT) {
                    return assessmentItem.recommended !== EXCLUDED_RECOMMENDED;
                }
                return true;
            });
        }
        return [];
    }, [configId, resolvedConfig, driftAssessmentData]);

    // Only show checkbox when fix is supported AND there are linked configs
    const canFixConfiguration = hasFixSupport(configId, engineType, status, missingPermissions);
    const showDependencyWarning = linkedConfigNames.length > 0 && canFixConfiguration;
    const [acknowledged, setAcknowledged] = useState(false);

    useEffect(() => {
        if (showDependencyWarning && !isWad) {
            dispatch(setRequireAcknowledge(true));
        }
        return () => {
            dispatch(resetDialogComponent());
        };
    }, [dispatch, showDependencyWarning, isWad]);

    const handleCheckboxChange = () => {
        const newValue = !acknowledged;
        setAcknowledged(newValue);
        dispatch(setRequireAcknowledge(!newValue));
        if (newValue) {
            dispatch(setDialogErrorWithTooltip({ showDialogError: false, showTooltipInfo: false }));
        }
    };

    // Instance selector (compute rightsizing)
    const generateRecommendedInstanceTypes = useMemo<optionType[]>(() => {
        const options: optionType[] = [];
        recommendationOptions?.forEach((option: RecommendationOption) => {
            const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                : '';
            options.push(generateOptionType(option?.instanceType, option?.instanceType, label2, false, ''));
        });
        if (options.length > 1) {
            dispatch(setSelectedRecommendedInstance(options[0]));
        }
        return options;
    }, [recommendationOptions, dispatch]);

    // Render a single section based on its definition
    const renderSection = (section: DialogSectionDef, index: number) => {
        if (section.hideWhenWad && isWad) return null;

        // Merge default params with section-specific params
        const translationParams = { ...defaultTranslationParams, ...(section.params || {}) };
        const heading = section.heading ? t(section.heading, translationParams) : '';

        switch (section.type) {
            case 'text': {
                let content = section.content ? t(section.content, translationParams) : '';
                if (
                    configId.includes('headroom') &&
                    section.content?.includes('permission-content') &&
                    recommendedSizeInGib
                ) {
                    content = `${content} to ${recommendedSizeInGib} GiB.`;
                }

                // Check if there's a Learn more link
                if (section.learnMoreLink) {
                    return (
                        <div key={index} className={styles['first-section']}>
                            {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                            <DsTypography variant="Regular_14" style={section.style}>
                                {content}{' '}
                                <a href={section.learnMoreLink} target="_blank" rel="noopener noreferrer">
                                    Learn more <span className={styles.externalIcon}>↗</span>
                                </a>
                            </DsTypography>
                        </div>
                    );
                }

                return createSection(heading, content, section.style);
            }
            case 'bullets': {
                const items = (section.items || []).map(key => t(key, translationParams));
                return createSection(heading, createContentWithBullets(items), section.style);
            }
            case 'textList': {
                const textItems = (section.items || []).map(key => t(key, translationParams));
                return (
                    <div key={index} className={styles['first-section']}>
                        {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                        <div className={styles.content}>
                            {textItems.map((text, i) => (
                                <DsTypography key={i} variant="Regular_14">
                                    {text}
                                </DsTypography>
                            ))}
                        </div>
                    </div>
                );
            }
            case 'numberedList': {
                const steps = (section.items || []).map(key => t(key, translationParams));
                return (
                    <div key={index} className={styles['first-section']}>
                        {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                        {createNumberedActionSteps(steps)}
                    </div>
                );
            }
            case 'numberedSteps': {
                const steps = (section.items || []).map(key => t(key, translationParams));
                return (
                    <div key={index} className={styles['first-section']}>
                        {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                        <div className={styles.content}>
                            {steps.map((step, i) => (
                                <div key={i} className={styles.row}>
                                    <DsTypography variant="Semibold_14">{i + 1}|</DsTypography>
                                    <DsTypography variant="Regular_14">{step}</DsTypography>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }
            case 'numberedStepsWithCode': {
                const steps = (section.items || []).map((key: string) => t(key, translationParams));
                return (
                    <div key={index} className={styles['first-section']}>
                        {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                        <div className={styles.content}>
                            {steps.map((step: string, i: number) => {
                                // Improved regex: stops at double spaces to allow text after commands
                                // Matches $ followed by characters, stopping at two consecutive spaces
                                const commandRegex = /(\$(?:[^\s]|\s(?!\s))+)/g;
                                const matches = step.match(commandRegex);

                                if (matches) {
                                    // Split by all commands and render parts
                                    const parts: (string | { type: 'command'; text: string })[] = [];
                                    let lastIndex = 0;

                                    matches.forEach(match => {
                                        const matchIndex = step.indexOf(match, lastIndex);
                                        // Add text before command
                                        if (matchIndex > lastIndex) {
                                            parts.push(step.substring(lastIndex, matchIndex));
                                        }
                                        // Add command
                                        parts.push({ type: 'command', text: match });
                                        lastIndex = matchIndex + match.length;
                                    });

                                    // Add remaining text after last command
                                    if (lastIndex < step.length) {
                                        parts.push(step.substring(lastIndex));
                                    }

                                    return (
                                        <div key={i} className={styles.row}>
                                            <DsTypography variant="Semibold_14">{i + 1}|</DsTypography>
                                            <div style={{ flex: 1 }}>
                                                {parts.map((part, partIdx: number) => {
                                                    if (typeof part === 'object' && part.type === 'command') {
                                                        return (
                                                            <div key={partIdx} style={{ margin: '8px 0' }}>
                                                                {createCodeBoxWithCopy(
                                                                    section.copyWithoutPrefix
                                                                        ? part.text.replace(/^\$/, '').trim()
                                                                        : part.text.trim(),
                                                                    t('databases.general.copied-to-clipboard')
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    if (part && typeof part === 'string' && part.trim()) {
                                                        return (
                                                            <DsTypography key={partIdx} variant="Regular_14">
                                                                {part.trim()}
                                                            </DsTypography>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // No command found, render as normal text
                                return (
                                    <div key={i} className={styles.row}>
                                        <DsTypography variant="Semibold_14">{i + 1}|</DsTypography>
                                        <DsTypography variant="Regular_14">{step}</DsTypography>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            case 'permissions': {
                if (!missingPermissions?.length) return null;
                const description = section.content ? t(section.content, translationParams) : '';
                return (
                    <div key={index} className={styles['first-section']}>
                        {heading && <DsTypography variant="Semibold_14">{heading}</DsTypography>}
                        {description && (
                            <DsTypography variant="Regular_14" style={section.style}>
                                {description}
                            </DsTypography>
                        )}
                        <div className={styles['dialog-body']}>
                            <div className={styles['code-box']}>
                                <div className={styles.code}>
                                    <DsTypography variant="Regular_14">
                                        {missingPermissions.map((permission: string) => (
                                            <DsTypography key={permission} variant="Regular_14">
                                                {permission}
                                            </DsTypography>
                                        ))}
                                    </DsTypography>
                                    <div className={styles.copy}>
                                        <CopyToClipboardCommon
                                            value={missingPermissions}
                                            iconProvided={
                                                <div className={styles.menuItem}>
                                                    <CopyIcon />
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            default:
                return null;
        }
    };

    // Render notes section
    const renderNotes = () => {
        if (!resolvedConfig?.notes) return null;
        const { type, content, items } = resolvedConfig.notes;

        switch (type) {
            case 'standard':
                return createStandardNotesSection(t, isWad);
            case 'os':
                return createOSNotesSection(isWad);
            case 'failover':
                return createFailoverClusterNotesSection(t, isWad);
            case 'clusterQuorum':
                return createClusterQuorumSQLNotesSection(t, isWad);
            case 'driveLetter':
                return createDriveLetterNotesSection(t);
            case 'custom':
                if (items?.length) {
                    return createSection(
                        t('databases.well-architect.note'),
                        createContentWithBullets(items.map(key => t(key))),
                        { width: '712px' }
                    );
                }
                if (content) {
                    return createSection(t('databases.well-architect.note'), t(content));
                }
                return null;
            default:
                return null;
        }
    };

    // Fallback if no config found in registry
    if (!resolvedConfig) {
        return (
            <div className={styles['storage-tier-block']}>
                {createSection(
                    t('databases.well-architect.action-summary'),
                    t('databases.well-architect.default-action-summary', {
                        configName: configName || configId
                    })
                )}
                {createStandardNotesSection(t, isWad)}
            </div>
        );
    }

    return (
        <div className={`${styles['storage-tier-block']} ${isWad ? styles['wad-spacing'] : ''}`}>
            {/* Linked Config Banner (Oracle ONTAP) */}
            {showDependencyWarning && (
                <div className={styles.dependencyWarningSection}>
                    <LinkedConfigBanner linkedConfigNames={linkedConfigNames} configName={configId} />
                    {!isWad && (
                        <div className={styles.acknowledgeCheckbox}>
                            <DsCheckbox
                                id="wlm-db-linked-config-acknowledge"
                                title={t('databases.well-architect.linked-config.acknowledge-checkbox')}
                                onSelect={handleCheckboxChange}
                                isSelected={acknowledged}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Render all sections from config */}
            {resolvedConfig.sections.map((section, index) => (
                <div key={index}>{renderSection(section, index)}</div>
            ))}

            {/* ONTAP Config Code Box */}
            {resolvedConfig.features?.showOntapConfigCodeBox &&
                (() => {
                    let codeBoxContent;

                    // Only drive-letter config uses objectsInViolation (dynamic drive names)
                    // All other configs use static wellArchitectedConfig from registry
                    if (configId === ASSESSMENT_CONFIG_IDS.DRIVE_LETTER && objectsInViolation?.length) {
                        codeBoxContent = objectsInViolation.map(item => {
                            if (typeof item === 'string') {
                                return item;
                            }
                            // Extract ontapVolumeName from object, fallback to JSON string
                            return item.ontapVolumeName || JSON.stringify(item);
                        });
                    } else {
                        codeBoxContent = resolvedConfig.wellArchitectedConfig;
                    }

                    if (codeBoxContent) {
                        return createSection(
                            t('databases.well-architect.well-architected-configuration'),
                            createCodeBox(codeBoxContent),
                            { width: '712px' }
                        );
                    }
                    return null;
                })()}

            {/* Custom Backup UI */}
            {resolvedConfig.features?.showCustomBackupUI && (
                <ScheduledAWSBackupDialog type={configId} engineType={engineType} />
            )}

            {/* Post-Patch Sections (Action Required, etc.) */}
            {resolvedConfig.postPatchSections?.map((section: any, index: number) => (
                <div key={index}>{renderSection(section, index)}</div>
            ))}

            {/* Instance Selector (Compute Rightsizing) */}
            {resolvedConfig.features?.showInstanceSelector && (
                <div className={styles['first-section']}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.well-architect.user-action-required')}
                    </DsTypography>
                    <div className={styles.content}>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.compute-rightsizing-select-instance')}
                        </DsTypography>
                        {operation === 'single' && (
                            <div className={styles.instanceTypeContainer}>
                                <SelectField
                                    label={t('databases.well-architect.recommended-instance-type')}
                                    isClearable={false}
                                    isDisabled={false}
                                    variant="two-lines"
                                    value={selectedRecommendedInstance}
                                    onChange={(selectedOptions: optionType[]): void => {
                                        dispatch(
                                            setSelectedRecommendedInstance(
                                                // @ts-ignore
                                                selectedOptions[0] || selectedOptions
                                            )
                                        );
                                    }}
                                    isSearchable={generateRecommendedInstanceTypes?.length > 5}
                                    options={generateRecommendedInstanceTypes}
                                    className={`${styles.widthSet}`}
                                />
                            </div>
                        )}
                        {operation === 'bulk' &&
                            bulkRecommendationOptions
                                ?.reduce((acc: BulkRecommendationOption[], perInstance: BulkRecommendationOption) => {
                                    if (!acc.some(item => item.hostName === perInstance.hostName)) {
                                        acc.push(perInstance);
                                    }
                                    return acc;
                                }, [])
                                ?.map((perInstance: BulkRecommendationOption) => {
                                    const options: optionType[] = [];
                                    perInstance?.recommendationOptions?.forEach((option: RecommendationOption) => {
                                        const label2 = option?.savingsOpportunity?.savingsOpportunityPercentage
                                            ? `Savings opportunity: ${option?.savingsOpportunity?.savingsOpportunityPercentage}%`
                                            : '';
                                        options.push(
                                            generateOptionType(
                                                option?.instanceType,
                                                option?.instanceType,
                                                label2,
                                                false,
                                                ''
                                            )
                                        );
                                    });
                                    if (
                                        options.length > 1 &&
                                        perInstance?.hostName &&
                                        !recommendedInstanceInBulk?.[perInstance.hostName]
                                    ) {
                                        dispatch(
                                            setRecommendedInstanceInBulk({
                                                type: perInstance.hostName,
                                                value: options[0]
                                            })
                                        );
                                    }
                                    return (
                                        <div key={perInstance.hostName} className={styles.instanceTypeContainer}>
                                            <SelectField
                                                label={t('databases.well-architect.recommended-instance-type')}
                                                isClearable={false}
                                                isDisabled={perInstance?.missingPermissions}
                                                variant="two-lines"
                                                value={recommendedInstanceInBulk?.[perInstance?.hostName || '']}
                                                onChange={(selectedOptions: optionType[]): void => {
                                                    if (perInstance?.hostName && selectedOptions.length > 0) {
                                                        dispatch(
                                                            setRecommendedInstanceInBulk({
                                                                type: perInstance.hostName,
                                                                value: selectedOptions[0]
                                                            })
                                                        );
                                                    }
                                                }}
                                                isSearchable={options?.length > 5}
                                                options={options}
                                                className={`${styles.widthSet}`}
                                            />
                                        </div>
                                    );
                                })}
                    </div>
                </div>
            )}

            {/* Notes Section */}
            {renderNotes()}
        </div>
    );
};

export default DynamicDialogContent;
