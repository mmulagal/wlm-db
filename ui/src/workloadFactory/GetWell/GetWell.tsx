import { DsAccordion, DsSelect, DsTypography, Spinner, TooltipInfo } from '@netapp/design-system';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as Light } from '../../assets/Light.svg';
import { ReactComponent as LightDisabled } from '../../assets/Light-Disabled.svg';
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
    applyFilter
} from './GetWellUtils';
import {
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setSelectedHeaderTab
} from '../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../store/storeHooks';
import { useState, useEffect } from 'react';
import GetWellApi from './GetWellApi';
import { resetGwData } from '../../store/workloadFactory/getWellOptimizeSlice';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';

const GetWell = () => {
    const dispatch = useDispatch();
    const { optimizeFilterTags, defaultFilterOptions } = useAppSelector(state => state.inventoryV2);
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const { cardData, ontapConfigTableData, osConfigTableData, selectedHostname, selectedDatabaseInstanceName } =
        useAppSelector(state => state.getWellOptimize);
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
    const [filteredCardData, setFilteredCardData] = useState<any>({});
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
                    (selectedFilter: any) => selectedFilter.label === filter.label
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
        }, 10);
    };

    // To apply filters on change of filters or card data
    useEffect(() => {
        setFilteredCardData(applyFilter(cardData, optimizeFilterTags));
    }, [cardData, optimizeFilterTags]);

    GetWellApi();

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
                                    title: 'Inventory',
                                    onClick: () => {
                                        dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                        dispatch(resetGwData({}));
                                    }
                                },
                                {
                                    title: selectedHostname || 'Host name'
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
                        {!optimizePrintState && (
                            <div className={styles.refreshIcon}>
                                <RefreshIcon />
                            </div>
                        )}
                    </div>
                    {!optimizePrintState && (
                        <DsTypography variant="Semibold_16">
                            {selectedDatabaseInstanceName || 'instance name'}
                        </DsTypography>
                    )}
                    {optimizePrintState && (
                        <div className={styles.reportSubHeading}>
                            <DsTypography variant="Semibold_16">Host name {selectedHostname}</DsTypography>
                            <div className={styles.separator} />
                            <DsTypography variant="Semibold_16">
                                instance name {selectedDatabaseInstanceName}
                            </DsTypography>
                            <div className={styles.separator} />
                            <DsTypography variant="Semibold_16">Report date {generateDate()}</DsTypography>
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
                            <div className={styles.downloadSection}>
                                <div />
                                <div className={styles.buttonStyle} onClick={printDocument}>
                                    <div>
                                        <Download />
                                    </div>
                                    <DsTypography
                                        style={{
                                            color: loading ? 'var(--text-disabled)' : 'var(--text-button-primary)'
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
                                isDisabled={loading}
                                onExpandChange={setsAccordionOpen}
                                title={
                                    <div className={styles.filterHeaderStyle}>
                                        <div className={isDarkTheme ? styles['dark-theme-union'] : ''}>
                                            <Union />
                                        </div>
                                        <DsTypography
                                            style={{ color: loading ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                                            variant="Semibold_14"
                                        >
                                            Configurations: All(26)
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
                                                        `Categories: (${
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
                                                            label: 'Application',
                                                            value: 'Application'
                                                        },
                                                        {
                                                            id: 3,
                                                            label: 'Resiliency',
                                                            value: 'Resiliency'
                                                        },
                                                        {
                                                            id: 4,
                                                            label: 'Cloning',
                                                            value: 'Cloning'
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
                                                        `Sub categories: (${
                                                            defaultFilterOptions['sub-catagories']?.length > 0
                                                                ? defaultFilterOptions['sub-catagories']?.length
                                                                : 3
                                                        })`
                                                    }
                                                    placeholder="Placeholder text"
                                                    isCleanable={false}
                                                    options={[
                                                        {
                                                            id: 0,
                                                            label: 'Storage sizing',
                                                            value: 'Storage sizing'
                                                        },
                                                        {
                                                            id: 1,
                                                            label: 'Storage layout',
                                                            value: 'Storage layout'
                                                        },
                                                        {
                                                            id: 2,
                                                            label: 'Storage configuration',
                                                            value: 'Storage configuration'
                                                        }
                                                    ]}
                                                    selectionType="multi"
                                                    isWithActions={true}
                                                    onSelect={(option: any) => handleSelect(option, 'sub-catagories')}
                                                    variant="underline"
                                                />
                                            </div>
                                            <div className={styles.dropDown}>
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
                                                        `Status: (${
                                                            defaultFilterOptions['status']?.length > 0
                                                                ? defaultFilterOptions['status']?.length
                                                                : 5
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
                                                                    <TooltipInfo trigger="click" isAppendedToBody>
                                                                        {' '}
                                                                        Not optimized includes over-provisioned and
                                                                        under-provisioned instances.
                                                                    </TooltipInfo>
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
                                                        `Severity: (${
                                                            defaultFilterOptions['severity']?.length > 0
                                                                ? defaultFilterOptions['severity']?.length
                                                                : 5
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
                                                        `Tags: (${
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
                                            {optimizeFilterTags.map((item: any) => (
                                                <div className={styles.filterTag}>
                                                    <DsTypography
                                                        style={{ color: ' var(--text-button-primary-hover)' }}
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
                                    </div>
                                }
                                value={
                                    <div className={styles.filterHeader}>
                                        <div className={styles.items}>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Regular_14"
                                            >
                                                Categories:
                                            </DsTypography>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                All (
                                                {defaultFilterOptions['all-catagories']?.length > 0
                                                    ? defaultFilterOptions['all-catagories']?.length
                                                    : 5}
                                                )
                                            </DsTypography>
                                        </div>

                                        <div className={styles.items}>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Regular_14"
                                            >
                                                Sub categories:
                                            </DsTypography>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                All (
                                                {defaultFilterOptions['sub-catagories']?.length > 0
                                                    ? defaultFilterOptions['sub-catagories']?.length
                                                    : 3}
                                                )
                                            </DsTypography>
                                        </div>

                                        <div className={styles.items}>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Regular_14"
                                            >
                                                Status:
                                            </DsTypography>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                All (
                                                {defaultFilterOptions['status']?.length > 0
                                                    ? defaultFilterOptions['status']?.length
                                                    : 2}
                                                )
                                            </DsTypography>
                                        </div>

                                        <div className={styles.items}>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Regular_14"
                                            >
                                                Severity:
                                            </DsTypography>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                All (
                                                {defaultFilterOptions['severity']?.length > 0
                                                    ? defaultFilterOptions['severity']?.length
                                                    : 2}
                                                )
                                            </DsTypography>
                                        </div>

                                        <div className={styles.items}>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Regular_14"
                                            >
                                                Tags:
                                            </DsTypography>
                                            <DsTypography
                                                style={{
                                                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)'
                                                }}
                                                variant="Semibold_14"
                                            >
                                                All (
                                                {defaultFilterOptions['tags']?.length > 0
                                                    ? defaultFilterOptions['tags']?.length
                                                    : 5}
                                                )
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
                                        />
                                        <DsAccordion
                                            id="1"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                        />
                                        <DsAccordion
                                            id="2"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                        />
                                        <DsAccordion
                                            id="3"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                        />
                                        <DsAccordion
                                            id="4"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                        />
                                        <DsAccordion
                                            id="5"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
                                            headerActions={[
                                                <div className={styles.headerAction}>
                                                    <div
                                                        className={
                                                            isDarkTheme && !loading ? styles['dark-theme-light'] : ''
                                                        }
                                                    >
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                        />
                                        <DsAccordion
                                            id="7"
                                            variant="Default"
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                            isDisabled={loading}
                                            isExpanded={optimizePrintState}
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
                                                        {loading ? <LightDisabled /> : <Light />}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: loading
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
                                                />
                                            }
                                            style={{ marginBottom: '40px' }}
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
