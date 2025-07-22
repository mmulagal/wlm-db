import {
    DsAccordion,
    DsSelect,
    DsTypography,
    Spinner,
    DsButton,
    useDialog,
    TooltipInfo,
    Button
} from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useState, useEffect, useMemo } from 'react';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';

import { ReactComponent as RowArrow } from '../../assets/row arrow-down.svg';
import { ReactComponent as Light } from '../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../assets/Light-Disabled.svg';
import { ReactComponent as Error } from '../../assets/error-icon.svg';
import { ReactComponent as Union } from '../../assets/Union.svg';
import { ReactComponent as Download } from '../../assets/download.svg';
import { ReactComponent as Close } from '../../assets/ic_close_blue.svg';
import { clearNotifications } from '../../store/notificationSlice';

import {
    ASSESSMENT_CONFIG_NAMES,
    CONFIG_STATES,
    JOB_MONITORING_STATUS,
    OPTIMIZE_POLLING_INTERVAL,
    WLF_TABS
} from '../../utils/consts';
import RecommendationTable from './RecommendationTable/RecommendationTable';
import Tag from '../../common/Tag/Tag';
import RecommendationText from './RecommendationText/RecommendationText';
import {
    getUniqueEntries,
    groupByType,
    removeEntry,
    removeObjectFromArray,
    generateDate,
    applyFilter,
    resetGwValuesOnRefresh
} from './GetWellUtils';
import {
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setSelectedHeaderTab
} from '../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../store/storeHooks';
import GetWellApi from './GetWellApi';
import {
    setGwAdhocError,
    setGwRefreshPage,
    setIsInnerPageOptimize
} from '../../store/workloadFactory/getWellOptimizeSlice';
// @ts-ignore
// import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';
import DialogComponent from '../../common/Dialog/DialogComponent';
import LearnHowDialog from '../ExploreSavings/SavingsCalculator/SavingsSelection/LearnHowDialog/LearnHowDialog';
import downloadPdf from '../../common/pdfGenerator';
import { useLazyGetSubTaskListQuery, useTriggerInstanceAssessmentMutation } from '../../utils/apiService';
import AssessmentContainer from './AssessmentContainer/AssessmentContainer';
import PartialDataContainer from './PartialDataContainer/PartialDataContainer';

const GetWell = () => {
    const dispatch = useDispatch();
    const { optimizeFilterTags, defaultFilterOptions, breadCrumbSelectedFrom } = useAppSelector(
        state => state.inventoryV2
    );
    const totalConfigCount = useAppSelector(state => state.getWellOptimize.optimizationBreakDown?.total?.total);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const {
        cardData,
        ontapConfigTableData,
        osConfigTableData,
        mssqlHighAvailabilityTableData,
        isAssessmentAvailable,
        selectedResourceId,
        selectedDatabaseInstance,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseStorageType,
        isInnerPageOptimize,
        gwTimestamp
    } = useAppSelector(state => state.getWellOptimize);
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
    const [configCount, setConfigCount] = useState(0);
    const [showChartArea, setShowChartArea] = useState(true);
    const [triggerAssessmentInProgress, setTriggerAssessmentInProgress] = useState(false);
    const { setDialog, closeDialog } = useDialog();
    // @ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const [triggerAssessmentApi] = useTriggerInstanceAssessmentMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    useEffect(() => {
        handleFilterClearAll();
        dispatch(setGwAdhocError(''));
    }, []);

    useEffect(() => {
        if (!loading) {
            setShowChartArea(Boolean(gwTimestamp && gwTimestamp !== '0'));
        } else {
            setShowChartArea(true);
        }
    }, [loading]);

    const handleSelect = (filters: any, filterLabel: any) => {
        let updatedFilters = [...optimizeFilterTags];

        const selectedIds = new Set(filters.map((filter: any) => filter.id));

        updatedFilters = updatedFilters.filter(
            (filter: any) => !(filter.type === filterLabel && !selectedIds.has(filter.id))
        );

        filters.forEach((filter: any) => {
            const existingFilterIndex = updatedFilters.findIndex(
                (selectedFilter: any) => selectedFilter.value === filter.value && selectedFilter.type === filterLabel
            );

            if (existingFilterIndex === -1) {
                updatedFilters.push({ ...filter, type: filterLabel });
            }
        });

        const uniqueArray = getUniqueEntries([updatedFilters]);
        const reArrange = groupByType(uniqueArray);

        dispatch(setOptimizeFilterTags(uniqueArray));
        dispatch(setDefaultFilterOptions(reArrange));
    };

    const handleCancelFilter = (option: any) => {
        const defaultFilterRemove = removeEntry(defaultFilterOptions, option);
        const updatedOptimizeFilter = removeObjectFromArray(optimizeFilterTags, option);
        dispatch(setOptimizeFilterTags(updatedOptimizeFilter));
        dispatch(setDefaultFilterOptions(defaultFilterRemove));
    };

    const handleTriggerAssessment = () => {
        setTriggerAssessmentInProgress(true);
        triggerAssessmentApi({
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance
        }).then((res: any) => {
            const jobId = res?.data?.jobId;
            if (jobId) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.INFO,
                        message: (
                            <div>
                                {'Assessment process initiated. Track progress in '}
                                <Button
                                    Component="button"
                                    variant="text"
                                    onClick={() => {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.JOB_MONITORING));
                                        dispatch(clearNotifications());
                                    }}
                                >
                                    {GENERAL.JOB_MONITORING}.
                                </Button>
                            </div>
                        )
                    })
                );
                const jobInterval = setInterval(() => {
                    getJobDetailApi({
                        id: jobId
                    }).then((jobRes: any) => {
                        const status = jobRes?.data?.status;
                        if (status === JOB_MONITORING_STATUS.COMPLETED) {
                            setTriggerAssessmentInProgress(false);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: 'Assessment completed'
                                })
                            );
                            refreshGetWellPage();
                            clearInterval(jobInterval);
                        } else if (status === JOB_MONITORING_STATUS.FAILED) {
                            setTriggerAssessmentInProgress(false);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: 'Assessment failed'
                                })
                            );
                            refreshGetWellPage();
                            dispatch(setGwAdhocError(jobRes?.data?.error));
                            clearInterval(jobInterval);
                        } else if (status === JOB_MONITORING_STATUS.WARNING) {
                            setTriggerAssessmentInProgress(false);
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.WARNING,
                                    message: 'Assessment completed with warnings'
                                })
                            );
                            refreshGetWellPage();
                            jobRes?.data?.subJobs?.forEach((job: { error?: string }) => {
                                const errorMessage = job?.error;
                                if (errorMessage) {
                                    dispatch(setGwAdhocError(errorMessage));
                                }
                            });
                            clearInterval(jobInterval);
                        }
                    });
                }, OPTIMIZE_POLLING_INTERVAL);
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message: 'Error in triggering assessment'
                    })
                );
                setTriggerAssessmentInProgress(false);
                dispatch(setGwAdhocError(res?.error?.data?.message));
            }
        });
    };

    const printDocument = () => {
        setOptimizePrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-optimize-pdf') as HTMLElement;
            const options = {
                filename: `Optimization_Report_MSSQLSERVER_${generateDate()}.pdf`,
                compression: 'MEDIUM'
            };

            // @ts-ignore
            downloadPdf(elem, options, (pdf: any) => {
                setOptimizePrintState(false);
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: GENERAL.REPORT_DOWNLOAD_SUCCESS
                    })
                );
            });
        }, 100);
    };

    // To apply filters on change of filters or card data
    useEffect(() => {
        const { data, configCount } = applyFilter(cardData, optimizeFilterTags, selectedDatabaseStorageType);
        setFilteredCardData(data);
        setConfigCount(configCount);
    }, [cardData, optimizeFilterTags, ontapConfigTableData, osConfigTableData, selectedDatabaseStorageType]);

    const refreshGetWellPage = () => {
        handleFilterClearAll();
        resetGwValuesOnRefresh(dispatch);
        dispatch(setGwRefreshPage(true));
    };

    useEffect(() => {
        if (isInnerPageOptimize) {
            refreshGetWellPage();
            dispatch(setIsInnerPageOptimize(false));
        }
    }, [isInnerPageOptimize]);

    const handleFilterClearAll = () => {
        dispatch(setOptimizeFilterTags([]));
        dispatch(setDefaultFilterOptions({}));
    };

    const generateSubCategoryOptions = useMemo(() => {
        const selectedCategories = optimizeFilterTags
            .filter((tag: any) => tag && tag.type === 'all-catagories')
            .map((tag: any) => tag.value);
        const options = [
            {
                id: 0,
                label: 'Storage sizing',
                value: 'Storage sizing',
                category: 'Storage'
            },
            {
                id: 1,
                label: 'Storage layout',
                value: 'Storage layout',
                category: 'Storage'
            },
            {
                id: 2,
                label: 'Storage configuration',
                value: 'Storage configuration',
                category: 'Storage'
            },
            {
                id: 3,
                label: 'Compute',
                value: 'Compute_sub',
                category: 'Compute'
            },
            {
                id: 4,
                label: GENERAL.APPLICATION,
                value: 'Application_sub',
                category: 'Application'
            },
            {
                id: 5,
                label: 'Protection',
                value: 'Protection',
                category: GENERAL.RESILIENCY
            },
            {
                id: 6,
                label: 'Cloning',
                value: 'Cloning',
                category: GENERAL.CLONING
            }
        ];
        const filteredOptions = selectedCategories.length
            ? options.filter((option: any) => selectedCategories.includes(option.category))
            : options;
        const selectedSubCategories =
            defaultFilterOptions['sub-catagories']?.filter((id: any) =>
                filteredOptions.find((option: any) => option.id === id)
            ) || [];
        const selectedOptimizeTags = optimizeFilterTags.filter(
            (tag: any) => tag.type !== 'sub-catagories' || filteredOptions.find((option: any) => option.id === tag.id)
        );
        if (optimizeFilterTags.length !== selectedOptimizeTags.length) {
            dispatch(setOptimizeFilterTags(selectedOptimizeTags));
        }
        dispatch(setDefaultFilterOptions({ ...defaultFilterOptions, 'sub-catagories': selectedSubCategories }));
        return filteredOptions;
    }, [optimizeFilterTags]);

    GetWellApi();

    const handleLearnHowClick = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LEARN_HOW_DIALOG.ASSESSMENT_TITLE}
                content={<LearnHowDialog type="assessment" />}
                primaryButton={GENERAL.CLOSE}
                callback={() => closeDialog()}
            />
        );
    };

    const [expandedValue, setExpandedValue] = useState(undefined);
    const [clickedAccordionId, setClickedAccordionId] = useState<string | undefined>(undefined);

    const isAccordionExpanded = (id: string, optimizePrintState: any): boolean | undefined => {
        if (optimizePrintState) {
            return true;
        }

        return clickedAccordionId === expandedValue && expandedValue === id;
    };

    const handleAccordionExpanded = (id: any, isExpanded: boolean) => {
        isExpanded && clickedAccordionId === id && setExpandedValue(id);
    };

    return (
        <div style={{ height: 'inherit', overflow: 'auto', backgroundColor: 'var(--main-background)' }}>
            {optimizePrintState && (
                <>
                    <div className={commonStyles.loaderOverlay} />
                    <div className={commonStyles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div className={styles.getWell} id="export-optimize-pdf">
                {/* {!optimizePrintState && (
                    <div className={commonStyles.commonBreadCrumb} style={{ left: '0%', paddingLeft: '40px' }}>
                        <BreadCrumbs
                            items={[
                                {
                                    title: breadCrumbSelectedFrom === WLF_TABS.INVENTORY ? 'Inventory' : 'Dashboard',
                                    onClick: () => {
                                        if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                        } else {
                                            dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                        }
                                        dispatch(resetGwData({}));
                                    }
                                },
                                {
                                    title:
                                        `${selectedHostname}/${selectedDatabaseInstanceName}` ||
                                        'Host name/instance name'
                                }
                            ]}
                        />
                    </div>
                )} */}
                {/* <div className={styles.header}>
                    <div className={styles['header-top-section']}>
                        <DsTypography
                            data-testid={`wlm-db-optimize-instance`}
                            className={styles.optimizeHeader}
                            variant="Semibold_16"
                        >
                            Well-architected dashboard
                        </DsTypography>

                        {!optimizePrintState &&
                            (loading || triggerAssessmentInProgress ? (
                                <div
                                    className={styles.refreshIconDisable}
                                    style={{ marginRight: '0px' }}
                                    id={'assessment-refresh'}
                                >
                                    <RefreshIcon />
                                </div>
                            ) : (
                                <Popover
                                    popoverClass={styles['copy-popover']}
                                    children={`Last update: ${gwRefreshTimestamp || GENERAL.NOT_AVAILABLE}`}
                                    trigger="hover"
                                    container={
                                        <div
                                            className={styles.refreshIcon}
                                            onClick={refreshGetWellPage}
                                            id={'assessment-refresh'}
                                        >
                                            <RefreshIcon />
                                        </div>
                                    }
                                />
                            ))}
                    </div>
                    {!optimizePrintState && (
                        <DsTypography
                            data-testid={`wlm-db-${selectedDatabaseInstanceName.toLowerCase().replace(/ /g, '-')}`}
                            variant="Regular_14"
                        >
                            {selectedDatabaseInstanceName || 'instance name'}
                        </DsTypography>
                    )}
                    {optimizePrintState && (
                        <div className={styles.reportSubHeading}>
                            <DsTypography className={styles.title} variant="Semibold_16">
                                Host name {selectedHostname}
                            </DsTypography>
                            <div className={styles.separator} />
                            <DsTypography className={styles.title} variant="Semibold_16">
                                instance name {selectedDatabaseInstanceName}
                            </DsTypography>
                            <div className={styles.separator} />
                            <DsTypography className={styles.title} variant="Semibold_16">
                                Report date {generateDate()}
                            </DsTypography>
                        </div>
                    )}
                </div> */}

                {/* Partial data warning here - based on condition */}

                {cardData?.compute_rightsizing?.errorMessage?.includes('not authorized') && <PartialDataContainer />}

                {/* Assessment Section here */}
                <AssessmentContainer onClick={handleTriggerAssessment} isLoading={triggerAssessmentInProgress} />
                {showChartArea && (
                    <>
                        <div className={styles.getWellSecondLevel}>
                            <TotalOptimizationScore />
                            <OptimizationBreakdown />
                        </div>

                        <div className={styles.sectionTwo}>
                            <div className={styles.downloadSectionHeader}>
                                {!optimizePrintState && (
                                    <div
                                        className={
                                            loading || !isAssessmentAvailable
                                                ? styles.downloadSectionDisable
                                                : styles.downloadSection
                                        }
                                    >
                                        <div />
                                        <div
                                            id="assessment-export-pdf"
                                            className={styles.buttonStyle}
                                            onClick={loading || !isAssessmentAvailable ? () => {} : printDocument}
                                        >
                                            <div>
                                                <Download />
                                            </div>
                                            <DsTypography
                                                style={{
                                                    color:
                                                        loading || !isAssessmentAvailable
                                                            ? 'var(--text-disabled)'
                                                            : 'var(--text-button-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                Export PDF
                                            </DsTypography>
                                        </div>
                                    </div>
                                )}
                                <div className={styles.filterComponent}>
                                    <DsAccordion
                                        id="100"
                                        variant="Default"
                                        isDisabled={loading || !isAssessmentAvailable}
                                        onExpandChange={setsAccordionOpen}
                                        expandCollapseIcon={{
                                            className: styles['expand-collapse-icon'],
                                            collapsedIcon: <RowArrow />,
                                            expandedIcon: (
                                                <div style={{ transform: 'rotate(180deg)' }}>
                                                    <RowArrow />
                                                </div>
                                            )
                                        }}
                                        title={
                                            <div className={styles.filterHeaderStyle}>
                                                <div className={isDarkTheme ? styles['dark-theme-union'] : ''}>
                                                    <Union />
                                                </div>
                                                <DsTypography
                                                    style={{
                                                        color:
                                                            loading || !isAssessmentAvailable
                                                                ? 'var(--text-disabled)'
                                                                : 'var(--text-primary)'
                                                    }}
                                                    variant="Semibold_14"
                                                >
                                                    Configurations:{' '}
                                                    {loading
                                                        ? GENERAL.NOT_AVAILABLE
                                                        : `${
                                                              totalConfigCount === configCount
                                                                  ? `All(${totalConfigCount})`
                                                                  : `${configCount}/${totalConfigCount}`
                                                          }`}
                                                </DsTypography>
                                            </div>
                                        }
                                        children={
                                            <div
                                                className={styles.mainSection}
                                                style={{ gap: optimizeFilterTags.length > 0 ? '42px' : '0px' }}
                                            >
                                                <div className={styles.dropdownList}>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions['all-catagories']
                                                                    ? defaultFilterOptions['all-catagories']
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Categories: ${
                                                                    !defaultFilterOptions['all-catagories']?.length ||
                                                                    defaultFilterOptions['all-catagories'].length === 2
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions['all-catagories']?.length > 0
                                                                        ? defaultFilterOptions['all-catagories']?.length
                                                                        : 5
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Storage ',
                                                                    value: 'Storage'
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Compute',
                                                                    value: 'Compute'
                                                                },
                                                                {
                                                                    id: 2,
                                                                    label: GENERAL.APPLICATION,
                                                                    value: 'Application'
                                                                },
                                                                {
                                                                    id: 3,
                                                                    label: GENERAL.RESILIENCY,
                                                                    value: 'Resiliency'
                                                                },
                                                                {
                                                                    id: 4,
                                                                    label: GENERAL.CLONING,
                                                                    value: 'Cloning'
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'all-catagories')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions['sub-catagories']
                                                                    ? defaultFilterOptions['sub-catagories']
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            formatLabel={() =>
                                                                `Sub categories: ${
                                                                    !defaultFilterOptions['sub-catagories']?.length ||
                                                                    defaultFilterOptions['sub-catagories'].length ===
                                                                        generateSubCategoryOptions.length
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions['sub-catagories']?.length > 0
                                                                        ? defaultFilterOptions['sub-catagories']?.length
                                                                        : generateSubCategoryOptions.length
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            isCleanable={false}
                                                            options={generateSubCategoryOptions}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'sub-catagories')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div
                                                        className={`${styles.dropDown} ${styles['optimized-drop-down']}`}
                                                    >
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.status
                                                                    ? defaultFilterOptions.status
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Status: ${
                                                                    !defaultFilterOptions.status?.length ||
                                                                    defaultFilterOptions.status.length === 2
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.status?.length > 0
                                                                        ? defaultFilterOptions.status?.length
                                                                        : 2
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Optimized',
                                                                    value: 'Optimized'
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Not optimized',
                                                                    value: 'Not optimized'
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'status')}
                                                            variant="underline"
                                                            formatOptionLabel={(option: any) => {
                                                                if (option?.label === 'Optimized') {
                                                                    return <div>{option?.label}</div>;
                                                                }
                                                                return (
                                                                    <div className={styles['not-optimized-tooltip']}>
                                                                        <div>{option?.label}</div>
                                                                        <TooltipInfo trigger="hover" isAppendedToBody>
                                                                            {' '}
                                                                            Not optimized includes over-provisioned and
                                                                            under-provisioned instances.
                                                                        </TooltipInfo>
                                                                    </div>
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.severity
                                                                    ? defaultFilterOptions.severity
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Severity: ${
                                                                    !defaultFilterOptions.severity?.length ||
                                                                    defaultFilterOptions.severity.length === 2
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.severity?.length > 0
                                                                        ? defaultFilterOptions.severity?.length
                                                                        : 2
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Critical',
                                                                    value: 'Critical'
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Warning',
                                                                    value: 'Warning'
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'severity')}
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.tags
                                                                    ? defaultFilterOptions.tags
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Tags: ${
                                                                    !defaultFilterOptions.tags?.length ||
                                                                    defaultFilterOptions.tags.length === 6
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.tags?.length > 0
                                                                        ? defaultFilterOptions.tags?.length
                                                                        : 6
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Cost optimization',
                                                                    value: 'Cost optimization'
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Cost efficiency',
                                                                    value: 'Cost efficiency'
                                                                },
                                                                {
                                                                    id: 2,
                                                                    label: 'Performance efficiency',
                                                                    value: 'Performance efficiency'
                                                                },
                                                                {
                                                                    id: 3,
                                                                    label: 'Operational excellence',
                                                                    value: 'Operational excellence'
                                                                },
                                                                {
                                                                    id: 4,
                                                                    label: 'Reliability',
                                                                    value: 'Reliability'
                                                                },
                                                                {
                                                                    id: 5,
                                                                    label: 'Security',
                                                                    value: 'Security'
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) => handleSelect(option, 'tags')}
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.configState
                                                                    ? defaultFilterOptions.configState
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Analysis state: ${
                                                                    !defaultFilterOptions.configState?.length ||
                                                                    defaultFilterOptions.configState.length === 3
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.configState?.length > 0
                                                                        ? defaultFilterOptions.configState?.length
                                                                        : 3
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Active',
                                                                    value: CONFIG_STATES.ACTIVE
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Postponed',
                                                                    value: CONFIG_STATES.POSTPONED
                                                                },
                                                                {
                                                                    id: 2,
                                                                    label: 'Dismissed',
                                                                    value: CONFIG_STATES.DISMISSED
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'configState')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                    <div className={styles.dropDown}>
                                                        <DsSelect
                                                            title=""
                                                            selectedOptionIds={
                                                                defaultFilterOptions.resourceType
                                                                    ? defaultFilterOptions.resourceType
                                                                    : []
                                                            }
                                                            isExpanded={isAccordionOpen ? undefined : false}
                                                            isCleanable={false}
                                                            formatLabel={() =>
                                                                `Resource type: ${
                                                                    !defaultFilterOptions.resourceType?.length ||
                                                                    defaultFilterOptions.resourceType.length === 9
                                                                        ? 'All'
                                                                        : ''
                                                                }(${
                                                                    defaultFilterOptions.resourceType?.length > 0
                                                                        ? defaultFilterOptions.resourceType?.length
                                                                        : 9
                                                                })`
                                                            }
                                                            placeholder="Placeholder text"
                                                            options={[
                                                                {
                                                                    id: 0,
                                                                    label: 'Database',
                                                                    value: 'Database'
                                                                },
                                                                {
                                                                    id: 1,
                                                                    label: 'Volume',
                                                                    value: 'Volume'
                                                                },
                                                                {
                                                                    id: 2,
                                                                    label: 'File system (FSx for ONTAP)',
                                                                    value: 'File system (FSx for ONTAP)'
                                                                },
                                                                {
                                                                    id: 3,
                                                                    label: 'Drive',
                                                                    value: 'Drive'
                                                                },
                                                                {
                                                                    id: 4,
                                                                    label: 'LUN path',
                                                                    value: 'LUN path'
                                                                },
                                                                {
                                                                    id: 5,
                                                                    label: 'Storage multipath',
                                                                    value: 'Storage multipath'
                                                                },
                                                                {
                                                                    id: 6,
                                                                    label: 'EC2 instance',
                                                                    value: 'EC2 instance'
                                                                },
                                                                {
                                                                    id: 8,
                                                                    label: 'SQL instance',
                                                                    value: 'SQL instance'
                                                                },
                                                                {
                                                                    id: 9,
                                                                    label: 'Network Adapter',
                                                                    value: 'Network Adapter'
                                                                }
                                                            ]}
                                                            selectionType="multi"
                                                            isWithActions
                                                            onSelect={(option: any) =>
                                                                handleSelect(option, 'resourceType')
                                                            }
                                                            variant="underline"
                                                        />
                                                    </div>
                                                </div>

                                                <div
                                                    className={styles.filtersOption}
                                                    style={{
                                                        marginBottom: optimizeFilterTags.length > 0 ? '18px' : '16px'
                                                    }}
                                                >
                                                    <div className={styles.tagsContainer}>
                                                        {optimizeFilterTags.map((item: any, index: number) => (
                                                            <div className={styles.filterTag} key={index}>
                                                                <DsTypography
                                                                    style={{ color: 'var(--header-notification-text)' }}
                                                                    variant="Semibold_13"
                                                                >
                                                                    {item.label}
                                                                </DsTypography>
                                                                <div
                                                                    onClick={() => handleCancelFilter(item)}
                                                                    className={styles.closeButton}
                                                                >
                                                                    <Close />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {optimizeFilterTags.length ? (
                                                        <div className={styles.clearAll}>
                                                            <DsButton type="text" onClick={handleFilterClearAll}>
                                                                {GENERAL.CLEAR_ALL}
                                                            </DsButton>
                                                        </div>
                                                    ) : (
                                                        ''
                                                    )}
                                                </div>
                                            </div>
                                        }
                                        value={
                                            <div className={styles.filterHeader}>
                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Categories:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions['all-catagories']?.length ||
                                                        defaultFilterOptions['all-catagories']?.length === 5
                                                            ? 'All(5)'
                                                            : `${defaultFilterOptions['all-catagories']?.length}/5`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Sub categories:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions['sub-catagories']?.length ||
                                                        defaultFilterOptions['sub-catagories']?.length ===
                                                            generateSubCategoryOptions.length
                                                            ? `All(${generateSubCategoryOptions.length})`
                                                            : `${defaultFilterOptions['sub-catagories']?.length}/${generateSubCategoryOptions.length}`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Status:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.status?.length ||
                                                        defaultFilterOptions.status?.length === 2
                                                            ? 'All(2)'
                                                            : `${defaultFilterOptions.status?.length}/2`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Severity:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.severity?.length ||
                                                        defaultFilterOptions.severity?.length === 2
                                                            ? 'All(2)'
                                                            : `${defaultFilterOptions.severity?.length}/2`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Tags:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.tags?.length ||
                                                        defaultFilterOptions.tags?.length === 6
                                                            ? 'All(6)'
                                                            : `${defaultFilterOptions.tags?.length}/6`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Analysis state:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.configState?.length ||
                                                        defaultFilterOptions.configState?.length === 3
                                                            ? 'All(3)'
                                                            : `${defaultFilterOptions.configState?.length}/3`}
                                                    </DsTypography>
                                                </div>

                                                <div className={styles.items}>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Regular_14"
                                                    >
                                                        Resource type:
                                                    </DsTypography>
                                                    <DsTypography
                                                        style={{
                                                            color:
                                                                loading || !isAssessmentAvailable
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-primary)'
                                                        }}
                                                        variant="Semibold_14"
                                                    >
                                                        {!defaultFilterOptions.resourceType?.length ||
                                                        defaultFilterOptions.resourceType?.length === 9
                                                            ? 'All(9)'
                                                            : `${defaultFilterOptions.resourceType?.length}/9`}
                                                    </DsTypography>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                            </div>

                            {/* Section one */}
                            {(filteredCardData?.storage_tier ||
                                filteredCardData?.file_system_headroom ||
                                filteredCardData?.transaction_log_drive_size ||
                                filteredCardData?.tempdb_drive_size) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            Storage sizing
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.storage_tier && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.storage_tier}
                                                    optimizePrintState={optimizePrintState}
                                                    type="Storage tier"
                                                />
                                                <DsAccordion
                                                    id="1"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.storage_tier?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('1', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('1', isExpanded);
                                                        // accordion.onExpandChange && accordion.onExpandChange(isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('1')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.storage_tier?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.storage_tier?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.storage_tier?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.storage_tier?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.file_system_headroom && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.file_system_headroom}
                                                    optimizePrintState={optimizePrintState}
                                                    type="File system headroom"
                                                />
                                                <DsAccordion
                                                    id="2"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.file_system_headroom?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('2', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('2', isExpanded);
                                                        // accordion.onExpandChange && accordion.onExpandChange(isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('2')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.file_system_headroom?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.file_system_headroom?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.file_system_headroom?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.file_system_headroom?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.transaction_log_drive_size && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.transaction_log_drive_size}
                                                    optimizePrintState={optimizePrintState}
                                                    type="Log drive size"
                                                />
                                                <DsAccordion
                                                    id="3"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        !cardData?.transaction_log_drive_size?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('3', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('3', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('3')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.transaction_log_drive_size?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.transaction_log_drive_size?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.transaction_log_drive_size?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.transaction_log_drive_size
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.tempdb_drive_size && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.tempdb_drive_size}
                                                    optimizePrintState={optimizePrintState}
                                                    type="TempDB drive size"
                                                />
                                                <DsAccordion
                                                    id="4"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.tempdb_drive_size?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('4', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('4', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('4')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.tempdb_drive_size?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.tempdb_drive_size?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.tempdb_drive_size?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.tempdb_drive_size?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section two */}
                            {(filteredCardData?.user_data_files ||
                                filteredCardData?.transaction_log_files ||
                                filteredCardData?.tempdb_files) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            Storage layout
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.user_data_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.user_data_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type="Data files"
                                                />
                                                <DsAccordion
                                                    id="5"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.user_data_files?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('5', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('5', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('5')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.user_data_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.user_data_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.user_data_files?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.user_data_files?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.transaction_log_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.transaction_log_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type="Log files"
                                                />
                                                <DsAccordion
                                                    id="6"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.transaction_log_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={
                                                        loading || !cardData?.transaction_log_files?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('6', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('6', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('6')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.transaction_log_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.transaction_log_files?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.transaction_log_files?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.tempdb_files && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.tempdb_files}
                                                    optimizePrintState={optimizePrintState}
                                                    type={ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT}
                                                />
                                                <DsAccordion
                                                    id="7"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.tempdb_files?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('7', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('7', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('7')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.tempdb_files?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.tempdb_files?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.tempdb_files?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.tempdb_files?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section three */}
                            {(filteredCardData?.ontap_configuration || filteredCardData?.os_configuration) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            Storage configuration
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.ontap_configuration && (
                                            <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.ontap_configuration}
                                                    optimizePrintState={optimizePrintState}
                                                />
                                                <DsAccordion
                                                    id="9"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.ontap_configuration?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('9', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('9', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('9')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.ontap_configuration?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.ontap_configuration?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.ontap_configuration?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendations & optimizations
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationTable
                                                            tableData={ontapConfigTableData}
                                                            isLoading={loading}
                                                            optimizePrintState={optimizePrintState}
                                                            from={WLF_TABS.INVENTORY}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.os_configuration && (
                                            <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.os_configuration}
                                                    optimizePrintState={optimizePrintState}
                                                />
                                                <DsAccordion
                                                    id="10"
                                                    isDisabled={
                                                        loading || !cardData?.os_configuration?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('10', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('10', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('10')}
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.os_configuration?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.os_configuration?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.os_configuration?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendations & optimizations
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationTable
                                                            tableData={osConfigTableData}
                                                            isLoading={loading}
                                                            optimizePrintState={optimizePrintState}
                                                            from={WLF_TABS.INVENTORY}
                                                        />
                                                    }
                                                    style={{ marginBottom: '40px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section four */}
                            {(filteredCardData?.compute_rightsizing ||
                                filteredCardData?.host_os_patch ||
                                filteredCardData?.rss_config) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            Compute
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.compute_rightsizing && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.compute_rightsizing}
                                                    optimizePrintState={optimizePrintState}
                                                    type="Compute rightsizing"
                                                />
                                                <DsAccordion
                                                    id="11"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        !cardData?.compute_rightsizing?.block_two?.value ||
                                                        filteredCardData?.compute_rightsizing?.isMissingPermissions
                                                    }
                                                    onClick={() => setClickedAccordionId('11')}
                                                    isExpanded={isAccordionExpanded('11', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('11', isExpanded);
                                                    }}
                                                    title={
                                                        filteredCardData?.compute_rightsizing?.isMissingPermissions ? (
                                                            <div className={styles.missingPermissionText}>
                                                                <Error />
                                                                <DsTypography
                                                                    variant="Semibold_14"
                                                                    style={{ marginLeft: '8px' }}
                                                                >
                                                                    Error:
                                                                </DsTypography>
                                                                &nbsp;
                                                                <DsTypography variant="Regular_14">
                                                                    Compute rightsizing details are unavailable due to
                                                                    missing permissions.
                                                                </DsTypography>
                                                                &nbsp;
                                                                <DsButton
                                                                    type="text"
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        handleLearnHowClick();
                                                                    }}
                                                                >
                                                                    Learn how to get compute rightsizing
                                                                    recommendations.
                                                                </DsButton>
                                                            </div>
                                                        ) : (
                                                            <div className={styles.tagPlacement}>
                                                                {filteredCardData?.compute_rightsizing?.tags?.map(
                                                                    (perTag: string, index: number) => (
                                                                        <div key={index}>
                                                                            <Tag text={perTag} />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.compute_rightsizing?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.compute_rightsizing?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.compute_rightsizing?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.host_os_patch && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.host_os_patch}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.OPERATING_SYSTEM_PATCH}
                                                />
                                                <DsAccordion
                                                    id="12"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.host_os_patch?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={loading || !cardData?.host_os_patch?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('12', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('12', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('12')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.host_os_patch?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.host_os_patch?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.host_os_patch?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.rss_config && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.rss_config}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.RSS_CONFIGURATION}
                                                />
                                                <DsAccordion
                                                    id="13"
                                                    variant="Default"
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.rss_config?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    isDisabled={loading || !cardData?.rss_config?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('13', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('13', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('13')}
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading || !cardData?.rss_config?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.rss_config?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.rss_config?.recommendation}
                                                        />
                                                    }
                                                    style={{ marginBottom: '40px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section five */}
                            {(filteredCardData?.sql_licenses ||
                                filteredCardData?.microsoft_sql_patch ||
                                filteredCardData?.maxdop) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.APPLICATION}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.sql_licenses && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.sql_licenses}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.LICENSE_SQL_SERVER}
                                                />
                                                <DsAccordion
                                                    id="14"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.sql_licenses?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('14', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('14', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('14')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.sql_licenses?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.sql_licenses?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.sql_licenses?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.sql_licenses?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.microsoft_sql_patch && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.microsoft_sql_patch}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.MICROSOFT_SQL_PATCH}
                                                />
                                                <DsAccordion
                                                    id="15"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.microsoft_sql_patch?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('15', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('15', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('15')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.microsoft_sql_patch?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.microsoft_sql_patch?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.microsoft_sql_patch?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.microsoft_sql_patch?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.maxdop && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.maxdop}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.MAXDOP_PATCH}
                                                />
                                                <DsAccordion
                                                    id="16"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.maxdop?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('16', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('16', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('16')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.maxdop?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading || !cardData?.maxdop?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading || !cardData?.maxdop?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.maxdop?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section six */}
                            {(filteredCardData?.scheduled_local_snapshot ||
                                filteredCardData?.crr ||
                                (selectedDatabaseStorageType === GENERAL.FCI &&
                                    filteredCardData?.mssql_high_availability)) && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.RESILIENCY}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.scheduled_local_snapshot && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.scheduled_local_snapshot}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.SCHEDULED_LOCAL_SNAPSHOT}
                                                />
                                                <DsAccordion
                                                    id="17"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.scheduled_local_snapshot?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('17', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('17', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('17')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.scheduled_local_snapshot?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.scheduled_local_snapshot?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.scheduled_local_snapshot?.block_two
                                                                            ?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.scheduled_local_snapshot
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                        {filteredCardData?.crr && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.crr}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.CRR}
                                                />
                                                <DsAccordion
                                                    id="18"
                                                    variant="Default"
                                                    isDisabled={loading || !cardData?.crr?.block_two?.value}
                                                    isExpanded={isAccordionExpanded('18', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('18', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('18')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.crr?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading || !cardData?.crr?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading || !cardData?.crr?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.crr?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {filteredCardData?.scheduled_FSx_for_ONTAP_backups && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.scheduled_FSx_for_ONTAP_backups}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS}
                                                />
                                                <DsAccordion
                                                    id="19"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading ||
                                                        !cardData?.scheduled_FSx_for_ONTAP_backups?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('19', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('19', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('19')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.scheduled_FSx_for_ONTAP_backups?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.scheduled_FSx_for_ONTAP_backups?.block_two
                                                                    ?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.scheduled_FSx_for_ONTAP_backups
                                                                            ?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={
                                                                filteredCardData?.scheduled_FSx_for_ONTAP_backups
                                                                    ?.recommendation
                                                            }
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}

                                        {selectedDatabaseStorageType === GENERAL.FCI &&
                                            filteredCardData?.mssql_high_availability && (
                                                <div className={`${styles.combineComponent} ${styles.storageConfig}`}>
                                                    <StorageCardComponent
                                                        cardData={filteredCardData?.mssql_high_availability}
                                                        optimizePrintState={optimizePrintState}
                                                        type={GENERAL.MSSQL_HIGH_AVAILABILITY}
                                                    />
                                                    <DsAccordion
                                                        id="22"
                                                        variant="Default"
                                                        isDisabled={
                                                            loading ||
                                                            !cardData?.mssql_high_availability?.block_two?.value
                                                        }
                                                        isExpanded={isAccordionExpanded('22', optimizePrintState)}
                                                        onExpandChange={isExpanded => {
                                                            handleAccordionExpanded('22', isExpanded);
                                                        }}
                                                        onClick={() => setClickedAccordionId('22')}
                                                        title={
                                                            <div className={styles.tagPlacement}>
                                                                {filteredCardData?.mssql_high_availability?.tags?.map(
                                                                    (perTag: string, index: number) => (
                                                                        <div key={index}>
                                                                            <Tag text={perTag} />
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        }
                                                        headerActions={[
                                                            <div className={styles.headerAction}>
                                                                <div
                                                                    className={
                                                                        isDarkTheme && !loading
                                                                            ? styles['dark-theme-light']
                                                                            : ''
                                                                    }
                                                                >
                                                                    {loading ||
                                                                    !cardData?.mssql_high_availability?.block_two
                                                                        ?.value ? (
                                                                        <LightDisabled />
                                                                    ) : (
                                                                        <Light />
                                                                    )}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        color:
                                                                            loading ||
                                                                            !cardData?.mssql_high_availability
                                                                                ?.block_two?.value
                                                                                ? 'var(--text-disabled)'
                                                                                : 'var(--text-button-primary)'
                                                                    }}
                                                                >
                                                                    View recommendations & optimizations
                                                                </div>
                                                            </div>
                                                        ]}
                                                        children={
                                                            <RecommendationTable
                                                                tableData={mssqlHighAvailabilityTableData}
                                                                isLoading={loading}
                                                                optimizePrintState={optimizePrintState}
                                                                from={WLF_TABS.INVENTORY}
                                                            />
                                                        }
                                                    />
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                            {/* Section seven */}
                            {filteredCardData?.clone_management && (
                                <div className={styles.sectionClass}>
                                    <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                        <DsTypography
                                            style={{
                                                padding: '0 0 8px'
                                            }}
                                            variant="Semibold_16"
                                        >
                                            {GENERAL.CLONING}
                                        </DsTypography>
                                    </div>

                                    <div className={styles.accordionGroups}>
                                        {filteredCardData?.clone_management && (
                                            <div className={styles.combineComponent}>
                                                <StorageCardComponent
                                                    cardData={filteredCardData?.clone_management}
                                                    optimizePrintState={optimizePrintState}
                                                    type={GENERAL.CLONE_MANAGEMENT}
                                                />
                                                <DsAccordion
                                                    id="20"
                                                    variant="Default"
                                                    isDisabled={
                                                        loading || !cardData?.clone_management?.block_two?.value
                                                    }
                                                    isExpanded={isAccordionExpanded('20', optimizePrintState)}
                                                    onExpandChange={isExpanded => {
                                                        handleAccordionExpanded('20', isExpanded);
                                                    }}
                                                    onClick={() => setClickedAccordionId('20')}
                                                    title={
                                                        <div className={styles.tagPlacement}>
                                                            {filteredCardData?.clone_management?.tags?.map(
                                                                (perTag: string, index: number) => (
                                                                    <div key={index}>
                                                                        <Tag text={perTag} />
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    }
                                                    headerActions={[
                                                        <div className={styles.headerAction}>
                                                            <div
                                                                className={
                                                                    isDarkTheme && !loading
                                                                        ? styles['dark-theme-light']
                                                                        : ''
                                                                }
                                                            >
                                                                {loading ||
                                                                !cardData?.clone_management?.block_two?.value ? (
                                                                    <LightDisabled />
                                                                ) : (
                                                                    <Light />
                                                                )}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    color:
                                                                        loading ||
                                                                        !cardData?.clone_management?.block_two?.value
                                                                            ? 'var(--text-disabled)'
                                                                            : 'var(--text-button-primary)'
                                                                }}
                                                            >
                                                                View recommendation
                                                            </div>
                                                        </div>
                                                    ]}
                                                    children={
                                                        <RecommendationText
                                                            data={filteredCardData?.clone_management?.recommendation}
                                                        />
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GetWell;
