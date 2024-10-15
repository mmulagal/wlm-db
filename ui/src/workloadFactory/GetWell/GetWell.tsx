import { DsAccordion, DsSelect, DsTypography, Spinner } from '@netapp/design-system';
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
    cardData,
    generateDate,
    getUniqueEntries,
    groupByType,
    ontapConfigTableData,
    operatingSystemTableData,
    recommendendationTextData,
    removeEntry,
    removeObjectFromArray
} from './GetWellUtils';
import {
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setSelectedHeaderTab
} from '../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../store/storeHooks';
import { useState } from 'react';
//@ts-ignore
import domToPdf from 'dom-to-pdf';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import { GENERAL } from '../../utils/appConstants';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';

const GetWell = () => {
    const dispatch = useDispatch();
    const { optimizeFilterTags, defaultFilterOptions } = useAppSelector(state => state.inventoryV2);
    const loading = false;
    const [isAccordionOpen, setsAccordionOpen] = useState(false);
    const [optimizePrintState, setOptimizePrintState] = useState(false);
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
                                    }
                                },
                                {
                                    title: 'Host name'
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
                    {!optimizePrintState && <DsTypography variant="Semibold_16">MSSQLSERVER</DsTypography>}
                    {optimizePrintState && (
                        <div className={styles.reportSubHeading}>
                            <DsTypography variant="Semibold_16">Host name SQLServer-Dev-01</DsTypography>
                            <div className={styles.separator} />
                            <DsTypography variant="Semibold_16">instance name MSSQLSERVER</DsTypography>
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
                                                    formatLabel={() =>
                                                        `Sub categories: (${
                                                            defaultFilterOptions['sub-catagories']?.length > 0
                                                                ? defaultFilterOptions['sub-catagories']?.length
                                                                : 12
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
                                                            label: 'ONTAP configuration',
                                                            value: 'ONTAP configuration'
                                                        },
                                                        {
                                                            id: 3,
                                                            label: 'Storage performance',
                                                            value: 'Storage performance'
                                                        },
                                                        {
                                                            id: 4,
                                                            label: 'Compute sub 1',
                                                            value: 'Compute sub 1'
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
                                                    : 12}
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
                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.StorageTier}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="1"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                    children={<RecommendationText data={recommendendationTextData.StorageTier} />}
                                />
                            </div>

                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.FileSystemHeadroom}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="2"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                        <RecommendationText data={recommendendationTextData.FileSystemHeadroom} />
                                    }
                                />
                            </div>

                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.TransactionLogDriveSize}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="3"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                        <RecommendationText data={recommendendationTextData.TransactionLogDriveSize} />
                                    }
                                />
                            </div>

                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.TempDBDriveSize}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="4"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                        <RecommendationText data={recommendendationTextData.TransactionDBDriveSize} />
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section two */}
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
                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.UserDataFiles}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="5"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                    children={<RecommendationText data={recommendendationTextData.UserDataFileMdf} />}
                                />
                            </div>

                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.TransactionLogFiles}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="6"
                                    variant="Default"
                                    title={<Tag text={'Performance efficiency'} />}
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                        <RecommendationText data={recommendendationTextData.TransactionLogFiles} />
                                    }
                                />
                            </div>

                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.TempDBPlacement}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="7"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={<Tag text={'Performance efficiency'} />}
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                    children={<RecommendationText data={recommendendationTextData.TempDBPlacement} />}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section three */}
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
                            <div className={styles.combineComponent}>
                                <StorageCardComponent
                                    cardData={cardData.ONTAPConfiguartion}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="9"
                                    variant="Default"
                                    isDisabled={loading}
                                    isExpanded={optimizePrintState}
                                    title={
                                        <div className={styles.tagPlacement}>
                                            <Tag text={'Performance efficiency'} />
                                            <Tag text={'Operational excellence'} />
                                            <Tag text={'Cost optimization'} />
                                            <Tag text={'Reliability'} />
                                            <Tag text={'Security'} />
                                        </div>
                                    }
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                            isLoading={false}
                                            optimizePrintState={optimizePrintState}
                                        />
                                    }
                                />
                            </div>

                            <div className={styles.combineComponent} style={{ marginBottom: '80px' }}>
                                <StorageCardComponent
                                    cardData={cardData.Configuartion}
                                    optimizePrintState={optimizePrintState}
                                />
                                <DsAccordion
                                    id="10"
                                    isDisabled={loading}
                                    variant="Default"
                                    isExpanded={optimizePrintState}
                                    title={
                                        <div className={styles.tagPlacement}>
                                            <Tag text={'Performance efficiency'} />
                                            <Tag text={'Operational excellence'} />
                                            <Tag text={'Cost optimization'} />
                                            <Tag text={'Reliability'} />
                                            <Tag text={'Security'} />
                                        </div>
                                    }
                                    headerActions={[
                                        <div className={styles.headerAction}>
                                            <div className={isDarkTheme && !loading ? styles['dark-theme-light'] : ''}>
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
                                            tableData={operatingSystemTableData}
                                            isLoading={false}
                                            optimizePrintState={optimizePrintState}
                                        />
                                    }
                                    style={{ marginBottom: '40px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GetWell;
