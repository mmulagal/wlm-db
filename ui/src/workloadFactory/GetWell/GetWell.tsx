import {
    DsAccordion,
    DsSelect,
    DsTypography,
    Spinner,
    DsTooltipInfo,
    Popover,
    DsButton,
    useDialog
} from '@netapp/design-system';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as Light } from '../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../assets/Light-Disabled.svg';
import { ReactComponent as Error } from '../../assets/error-icon.svg';
import { ReactComponent as Union } from '../../assets/Union.svg';
import { ReactComponent as Download } from '../../assets/download.svg';
import { ReactComponent as Close } from '../../assets/ic_close_blue.svg';
import { useDispatch } from 'react-redux';

import { WLF_TABS } from '../../utils/consts';
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
import { useState, useEffect, useMemo } from 'react';
import GetWellApi from './GetWellApi';
import { resetGwData, setGwRefreshPage } from '../../store/workloadFactory/getWellOptimizeSlice';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';
import DialogComponent from '../../common/Dialog/DialogComponent';
import LearnHowDialog from '../ExploreSavings/SavingsCalculator/SavingsSelection/LearnHowDialog/LearnHowDialog';

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
        selectedHostname,
        selectedDatabaseInstanceName,
        gwTimestamp,
        isAssessmentAvailable
    } = useAppSelector(state => state.getWellOptimize);
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
    const [configCount, setConfigCount] = useState(0);
    const { setDialog, closeDialog } = useDialog();
    //@ts-ignore
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    const handleSelect = (filters: any, filterLabel: any) => {
        let updatedFilters = [...optimizeFilterTags];

        if (defaultFilterOptions[filterLabel] && defaultFilterOptions[filterLabel]?.length > filters?.length) {
            const idArray = filters.map((item: any) => item.id);

            const findRemovedElement = defaultFilterOptions[filterLabel].filter((item: any) => !idArray.includes(item));

            const typeToRemove = filterLabel;
            const idsToRemove = findRemovedElement;

            const filteredArray = updatedFilters.filter(
                (item: any) => !(idsToRemove.includes(item.id) && item.type === typeToRemove)
            );

            const reArrange = groupByType(filteredArray);
            dispatch(setOptimizeFilterTags(filteredArray));
            dispatch(setDefaultFilterOptions(reArrange));
        } else {
            filters.forEach((filter: any) => {
                const isSelected = optimizeFilterTags.some(
                    (selectedFilter: any) => selectedFilter.value === filter.value
                );

                if (isSelected) {
                    // Remove the filter if it is already selected
                    updatedFilters = updatedFilters.filter(selectedFilter => selectedFilter.label !== filter.label);
                } else {
                    // Add the filter if it is not selected
                    updatedFilters.push({ ...filter, type: filterLabel });
                }
            });

            const uniqueArray = getUniqueEntries([optimizeFilterTags, updatedFilters]);

            const reArrange = groupByType(uniqueArray);

            dispatch(setOptimizeFilterTags(uniqueArray));
            dispatch(setDefaultFilterOptions(reArrange));
        }
    };

    const handleCancelFilter = (option: any) => {
        const defaultFilterRemove = removeEntry(defaultFilterOptions, option);
        const updatedOptimizeFilter = removeObjectFromArray(optimizeFilterTags, option);
        dispatch(setOptimizeFilterTags(updatedOptimizeFilter));
        dispatch(setDefaultFilterOptions(defaultFilterRemove));
    };

    const printDocument = () => {
        setOptimizePrintState(true);
        setTimeout(() => {
            const elem = document.getElementById('export-optimize-pdf') as HTMLElement;
            var options = {
                filename: `Optimization_Report_MSSQLSERVER_${generateDate()}.pdf`,
                compression: 'MEDIUM'
            };
            domToPdf(elem, options, (pdf: any) => {
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
        const { data, configCount } = applyFilter(cardData, optimizeFilterTags);
        setFilteredCardData(data);
        setConfigCount(configCount);
    }, [cardData, optimizeFilterTags, ontapConfigTableData, osConfigTableData]);

    const refreshGetWellPage = () => {
        resetGwValuesOnRefresh(dispatch);
        dispatch(setGwRefreshPage(true));
    };

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
                label: GENERAL.APPLICATION_SQL_SERVER,
                value: 'Application_sub',
                category: GENERAL.APPLICATION_SQL_SERVER
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
                content={<LearnHowDialog type={'assessment'} />}
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
                    <div className={commonStyles.loaderOverlay}></div>
                    <div className={commonStyles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div className={styles.getWell} id="export-optimize-pdf">
                {!optimizePrintState && (
                    <div className={commonStyles.commonBreadCrumb}>
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
                )}
                <div className={styles.header}>
                    <div className={styles['header-top-section']}>
                        <DsTypography className={styles.optimizeHeader} variant="Semibold_20">
                            Optimize instance
                        </DsTypography>
                        {!optimizePrintState &&
                            (loading ? (
                                <div className={styles.refreshIconDisable} id={'assessment-refresh'}>
                                    <RefreshIcon />
                                </div>
                            ) : (
                                <Popover
                                    popoverClass={styles['copy-popover']}
                                    children={`Last update: ${gwTimestamp || GENERAL.NOT_AVAILABLE}`}
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
                        <DsTypography variant="Semibold_16">
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
                </div>
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
                                id="2"
                                variant="Default"
                                isDisabled={loading || !isAssessmentAvailable}
                                onExpandChange={setsAccordionOpen}
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
                                    <div className={styles.mainSection}>
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
                                                                : 3
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
                                                            label: GENERAL.APPLICATION_SQL_SERVER,
                                                            value: 'Application'
                                                        }
                                                    ]}
                                                    selectionType="multi"
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'all-catagories')}
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
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'sub-catagories')}
                                                    variant="underline"
                                                />
                                            </div>
                                            <div className={`${styles.dropDown} ${styles['optimized-drop-down']}`}>
                                                <DsSelect
                                                    title=""
                                                    selectedOptionIds={
                                                        defaultFilterOptions['status']
                                                            ? defaultFilterOptions['status']
                                                            : []
                                                    }
                                                    isExpanded={isAccordionOpen ? undefined : false}
                                                    isCleanable={false}
                                                    formatLabel={() =>
                                                        `Status: ${
                                                            !defaultFilterOptions['status']?.length ||
                                                            defaultFilterOptions['status'].length === 2
                                                                ? 'All'
                                                                : ''
                                                        }(${
                                                            defaultFilterOptions['status']?.length > 0
                                                                ? defaultFilterOptions['status']?.length
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
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'status')}
                                                    variant="underline"
                                                    formatOptionLabel={(option: any) => {
                                                        if (option?.label === 'Optimized') {
                                                            return <div>{option?.label}</div>;
                                                        } else {
                                                            return (
                                                                <div className={styles['not-optimized-tooltip']}>
                                                                    <div>{option?.label}</div>
                                                                    <DsTooltipInfo
                                                                        trigger="hover"
                                                                        isRelativeToViewPort={false}
                                                                    >
                                                                        {' '}
                                                                        Not optimized includes over-provisioned and
                                                                        under-provisioned instances.
                                                                    </DsTooltipInfo>
                                                                </div>
                                                            );
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className={styles.dropDown}>
                                                <DsSelect
                                                    title=""
                                                    selectedOptionIds={
                                                        defaultFilterOptions['severity']
                                                            ? defaultFilterOptions['severity']
                                                            : []
                                                    }
                                                    isExpanded={isAccordionOpen ? undefined : false}
                                                    isCleanable={false}
                                                    formatLabel={() =>
                                                        `Severity: ${
                                                            !defaultFilterOptions['severity']?.length ||
                                                            defaultFilterOptions['severity'].length === 2
                                                                ? 'All'
                                                                : ''
                                                        }(${
                                                            defaultFilterOptions['severity']?.length > 0
                                                                ? defaultFilterOptions['severity']?.length
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
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'severity')}
                                                    variant="underline"
                                                />
                                            </div>
                                            <div className={styles.dropDown}>
                                                <DsSelect
                                                    title=""
                                                    selectedOptionIds={
                                                        defaultFilterOptions['tags'] ? defaultFilterOptions['tags'] : []
                                                    }
                                                    isExpanded={isAccordionOpen ? undefined : false}
                                                    isCleanable={false}
                                                    formatLabel={() =>
                                                        `Tags: ${
                                                            !defaultFilterOptions['tags']?.length ||
                                                            defaultFilterOptions['tags'].length === 5
                                                                ? 'All'
                                                                : ''
                                                        }(${
                                                            defaultFilterOptions['tags']?.length > 0
                                                                ? defaultFilterOptions['tags']?.length
                                                                : 5
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
                                                            label: 'Performance efficiency',
                                                            value: 'Performance efficiency'
                                                        },
                                                        {
                                                            id: 2,
                                                            label: 'Operational excellence',
                                                            value: 'Operational excellence'
                                                        },
                                                        {
                                                            id: 3,
                                                            label: 'Reliability',
                                                            value: 'Reliability'
                                                        },
                                                        {
                                                            id: 4,
                                                            label: 'Security',
                                                            value: 'Security'
                                                        }
                                                    ]}
                                                    selectionType="multi"
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'tags')}
                                                    variant="underline"
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.filtersOption}>
                                            <div className={styles.tagsContainer}>
                                                {optimizeFilterTags.map((item: any) => (
                                                    <div className={styles.filterTag}>
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
                                                defaultFilterOptions['all-catagories']?.length === 2
                                                    ? 'All(2)'
                                                    : `${defaultFilterOptions['all-catagories']?.length}/2`}
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
                                                {!defaultFilterOptions['status']?.length ||
                                                defaultFilterOptions['status']?.length === 2
                                                    ? 'All(2)'
                                                    : `${defaultFilterOptions['status']?.length}/2`}
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
                                                {!defaultFilterOptions['severity']?.length ||
                                                defaultFilterOptions['severity']?.length === 2
                                                    ? 'All(2)'
                                                    : `${defaultFilterOptions['severity']?.length}/2`}
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
                                                {!defaultFilterOptions['tags']?.length ||
                                                defaultFilterOptions['tags']?.length === 5
                                                    ? 'All(5)'
                                                    : `${defaultFilterOptions['tags']?.length}/5`}
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
                                                    {filteredCardData?.storage_tier?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.storage_tier?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.storage_tier?.block_two?.value
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
                                            isDisabled={loading || !cardData?.file_system_headroom?.block_two?.value}
                                            isExpanded={isAccordionExpanded('2', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('2', isExpanded);
                                                // accordion.onExpandChange && accordion.onExpandChange(isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('2')}
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.file_system_headroom?.tags?.map(
                                                        (perTag: string) => {
                                                            return <Tag text={perTag} />;
                                                        }
                                                    )}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
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
                                                                !cardData?.file_system_headroom?.block_two?.value
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
                                                    data={filteredCardData?.file_system_headroom?.recommendation}
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
                                                loading || !cardData?.transaction_log_drive_size?.block_two?.value
                                            }
                                            isExpanded={isAccordionExpanded('3', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('3', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('3')}
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.transaction_log_drive_size?.tags?.map(
                                                        (perTag: string) => {
                                                            return <Tag text={perTag} />;
                                                        }
                                                    )}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading ||
                                                        !cardData?.transaction_log_drive_size?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading ||
                                                                !cardData?.transaction_log_drive_size?.block_two?.value
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
                                                    data={filteredCardData?.transaction_log_drive_size?.recommendation}
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
                                            isDisabled={loading || !cardData?.tempdb_drive_size?.block_two?.value}
                                            isExpanded={isAccordionExpanded('4', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('4', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('4')}
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.tempdb_drive_size?.tags?.map(
                                                        (perTag: string) => {
                                                            return <Tag text={perTag} />;
                                                        }
                                                    )}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.tempdb_drive_size?.block_two?.value ? (
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
                                            type="User data files"
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
                                                    {filteredCardData?.user_data_files?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.user_data_files?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.user_data_files?.block_two?.value
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
                                                        (perTag: string) => {
                                                            return <Tag text={perTag} />;
                                                        }
                                                    )}
                                                </div>
                                            }
                                            isDisabled={loading || !cardData?.transaction_log_files?.block_two?.value}
                                            isExpanded={isAccordionExpanded('6', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('6', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('6')}
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
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
                                                                !cardData?.transaction_log_files?.block_two?.value
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
                                                    data={filteredCardData?.transaction_log_files?.recommendation}
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
                                            type="TempDB placement"
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
                                                    {filteredCardData?.tempdb_files?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.tempdb_files?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.tempdb_files?.block_two?.value
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
                                    <div className={styles.combineComponent}>
                                        <StorageCardComponent
                                            cardData={filteredCardData?.ontap_configuration}
                                            optimizePrintState={optimizePrintState}
                                        />
                                        <DsAccordion
                                            id="9"
                                            variant="Default"
                                            isDisabled={loading || !cardData?.ontap_configuration?.block_two?.value}
                                            isExpanded={isAccordionExpanded('9', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('9', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('9')}
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.ontap_configuration?.tags?.map(
                                                        (perTag: string) => {
                                                            return <Tag text={perTag} />;
                                                        }
                                                    )}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.ontap_configuration?.block_two?.value ? (
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
                                                        View recommendation & optimization
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
                                    <div className={styles.combineComponent}>
                                        <StorageCardComponent
                                            cardData={filteredCardData?.os_configuration}
                                            optimizePrintState={optimizePrintState}
                                        />
                                        <DsAccordion
                                            id="10"
                                            isDisabled={loading || !cardData?.os_configuration?.block_two?.value}
                                            isExpanded={isAccordionExpanded('10', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('10', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('10')}
                                            variant="Default"
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.os_configuration?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.os_configuration?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.os_configuration?.block_two?.value
                                                                    ? 'var(--text-disabled)'
                                                                    : 'var(--text-button-primary)'
                                                        }}
                                                    >
                                                        View recommendation & optimization
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
                    {(filteredCardData?.compute_rightsizing || filteredCardData?.host_os_patch) && (
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
                                                            variant={'Semibold_14'}
                                                            style={{ marginLeft: '8px' }}
                                                        >
                                                            Error:
                                                        </DsTypography>
                                                        &nbsp;
                                                        <DsTypography variant={'Regular_14'}>
                                                            Compute rightsizing details are unavailable due to missing
                                                            permissions.
                                                        </DsTypography>
                                                        &nbsp;
                                                        <DsButton
                                                            type="text"
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                handleLearnHowClick();
                                                            }}
                                                        >
                                                            Learn how to get compute rightsizing recommendations.
                                                        </DsButton>
                                                    </div>
                                                ) : (
                                                    <div className={styles.tagPlacement}>
                                                        {filteredCardData?.compute_rightsizing?.tags?.map(
                                                            (perTag: string) => {
                                                                return <Tag text={perTag} />;
                                                            }
                                                        )}
                                                    </div>
                                                )
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.compute_rightsizing?.block_two?.value ? (
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
                                                    {filteredCardData?.host_os_patch?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
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
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.host_os_patch?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.host_os_patch?.block_two?.value
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
                                            style={{ marginBottom: '40px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Section five */}
                    {filteredCardData?.sql_licenses && (
                        <div className={styles.sectionClass}>
                            <div className={styles['header-buttons']} style={{ marginTop: '40px' }}>
                                <DsTypography
                                    style={{
                                        padding: '0 0 8px'
                                    }}
                                    variant="Semibold_16"
                                >
                                    {GENERAL.APPLICATION_SQL_SERVER}
                                </DsTypography>
                            </div>

                            <div className={styles.accordionGroups}>
                                {filteredCardData?.sql_licenses && (
                                    <div className={styles.combineComponent}>
                                        <StorageCardComponent
                                            cardData={filteredCardData?.sql_licenses}
                                            optimizePrintState={optimizePrintState}
                                            type={GENERAL.APPLICATION_SQL_SERVER}
                                        />
                                        <DsAccordion
                                            id="13"
                                            variant="Default"
                                            isDisabled={loading || !cardData?.sql_licenses?.block_two?.value}
                                            isExpanded={isAccordionExpanded('13', optimizePrintState)}
                                            onExpandChange={isExpanded => {
                                                handleAccordionExpanded('13', isExpanded);
                                            }}
                                            onClick={() => setClickedAccordionId('13')}
                                            title={
                                                <div className={styles.tagPlacement}>
                                                    {filteredCardData?.sql_licenses?.tags?.map((perTag: string) => {
                                                        return <Tag text={perTag} />;
                                                    })}
                                                </div>
                                            }
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading || !cardData?.sql_licenses?.block_two?.value ? (
                                                            <LightDisabled />
                                                        ) : (
                                                            <Light />
                                                        )}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color:
                                                                loading || !cardData?.sql_licenses?.block_two?.value
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
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GetWell;
