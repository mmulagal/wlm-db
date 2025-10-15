import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { TooltipInfo } from '@netapp/design-system';
import { DsAccordion, DsButton, DsSelect, DsTypography } from '@tlveng/wlm-ds';
import { ReactComponent as RowArrow } from '../../../../../assets/row arrow-down.svg';
import { ReactComponent as Union } from '../../../../../assets/Union.svg';
import { ReactComponent as Close } from '../../../../../assets/ic_close_blue.svg';
import styles from './OracleFilterComponent.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';
import {
    setOracleDefaultFilterOptions,
    setOracleOptimizeFilterTags
} from '../../../../../store/workloadFactory/oracleSlice';

import { CONFIG_NAME_TO_ID_MAPPING } from '../../../../../utils/consts';
import { handleSelectForFilter, removeEntry, removeObjectFromArray } from '../../../../../utils/resourceUtils';
import { oracleApplyFilter } from '../OracleWellArchitectedUtils';
import { calculateTotalConfigCount } from '../../../../GetWell/GetWellHelper';

interface OracleFilterComponentProps {
    setFilteredCardData: (data: any) => void;
    showDismissedConfigurations: boolean;
    driftAssessmentData: any;
    dynamicFilterOptions?: {
        categories: any[];
        subCategories: any[];
        severities: any[];
        tags: any[];
        resourceTypes: any[];
        statuses: any[];
    };
}

const OracleFilterComponent = ({
    setFilteredCardData,
    showDismissedConfigurations,
    driftAssessmentData,
    dynamicFilterOptions
}: OracleFilterComponentProps) => {
    const dispatch = useDispatch();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { oracleDefaultFilterOptions, oracleOptimizeFilterTags } = useAppSelector(state => state.oracleSlice);

    // Provide fallback for dynamic filter options
    const safeFilterOptions = dynamicFilterOptions || {
        categories: [],
        subCategories: [],
        severities: [],
        tags: [],
        resourceTypes: [],
        statuses: []
    };
    // This might be pass from parent
    const [configCount, setConfigCount] = useState(0);

    const {
        optimizePageLoading: loading,
        isAssessmentAvailable,
        cardData,
        ontapConfigTableData
    } = useAppSelector(state => state.getWellOptimize);

    const totalConfigCount = useAppSelector(state => {
        const total = state.getWellOptimize.optimizationBreakDown?.total?.total || 0;
        const dismissedIds = state.getWellOptimize.optimizationBreakDown?.total?.dismissedIds || [];

        // Filter dismissedIds to only include those NOT in STORAGE_CONFIG_MAP
        // Anything not in STORAGE_CONFIG_MAP is either storage layout, ONTAP, or OS configuration
        const storageConfigKeys = Object.keys(CONFIG_NAME_TO_ID_MAPPING.STORAGE_CONFIG_MAP || {});

        const nonStorageConfigDismissedIds = dismissedIds.filter(
            (dismissedId: string) =>
                // Check if this dismissed ID is NOT in the storage config mapping
                !storageConfigKeys.includes(dismissedId)
        );

        return total + nonStorageConfigDismissedIds.length;
    });

    // Helper function to get total count based on dismissed configuration state
    const getTotalConfigCount = useMemo(
        () => calculateTotalConfigCount(cardData, showDismissedConfigurations, driftAssessmentData),
        [cardData, showDismissedConfigurations, driftAssessmentData]
    );

    // To apply filters on change of filters or card data
    useEffect(() => {
        const { data, configCount } = oracleApplyFilter(
            cardData,
            oracleOptimizeFilterTags,
            showDismissedConfigurations,
            driftAssessmentData
        );
        setFilteredCardData(data);
        setConfigCount(configCount);
    }, [cardData, oracleOptimizeFilterTags, ontapConfigTableData, showDismissedConfigurations, driftAssessmentData]);

    const handleSelect = (filters: any, filterLabel: any) => {
        handleSelectForFilter(
            filters,
            filterLabel,
            oracleOptimizeFilterTags,
            dispatch,
            setOracleOptimizeFilterTags,
            setOracleDefaultFilterOptions
        );
    };

    // Function to cancel the filter from tags
    const handleCancelFilter = (option: any) => {
        const defaultFilterRemove = removeEntry(oracleDefaultFilterOptions, option);
        const updatedOptimizeFilter = removeObjectFromArray(oracleOptimizeFilterTags, option);
        dispatch(setOracleOptimizeFilterTags(updatedOptimizeFilter));
        dispatch(setOracleDefaultFilterOptions(defaultFilterRemove));
    };

    // Function to clear all filters
    const handleFilterClearAll = () => {
        dispatch(setOracleOptimizeFilterTags([]));
        dispatch(setOracleDefaultFilterOptions({}));
    };

    // Select box for categories
    const categoriesSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={
                oracleDefaultFilterOptions['all-catagories'] ? oracleDefaultFilterOptions['all-catagories'] : []
            }
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Categories: ${
                    !oracleDefaultFilterOptions['all-catagories']?.length ||
                    oracleDefaultFilterOptions['all-catagories'].length === safeFilterOptions.categories.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions['all-catagories']?.length > 0
                        ? oracleDefaultFilterOptions['all-catagories']?.length
                        : safeFilterOptions.categories.length
                })`
            }
            placeholder="Placeholder text"
            options={safeFilterOptions.categories}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'all-catagories')}
            variant="underline"
        />
    );

    const subCategoriesSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={
                oracleDefaultFilterOptions['sub-catagories'] ? oracleDefaultFilterOptions['sub-catagories'] : []
            }
            dropDown={{
                isCloseOnClickOutside: true
            }}
            formatLabel={() =>
                `Sub categories: ${
                    !oracleDefaultFilterOptions['sub-catagories']?.length ||
                    oracleDefaultFilterOptions['sub-catagories'].length === safeFilterOptions.subCategories.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions['sub-catagories']?.length > 0
                        ? oracleDefaultFilterOptions['sub-catagories']?.length
                        : safeFilterOptions.subCategories.length
                })`
            }
            placeholder="Placeholder text"
            isCleanable={false}
            options={safeFilterOptions.subCategories}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'sub-catagories')}
            variant="underline"
        />
    );

    const statusSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={oracleDefaultFilterOptions.status ? oracleDefaultFilterOptions.status : []}
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Status: ${
                    !oracleDefaultFilterOptions.status?.length ||
                    oracleDefaultFilterOptions.status.length === safeFilterOptions.statuses.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.status?.length > 0
                        ? oracleDefaultFilterOptions.status?.length
                        : safeFilterOptions.statuses.length
                })`
            }
            placeholder="Placeholder text"
            options={safeFilterOptions.statuses}
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
                            Not optimized includes over-provisioned and under-provisioned instances.
                        </TooltipInfo>
                    </div>
                );
            }}
        />
    );

    const severitySelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={oracleDefaultFilterOptions.severity ? oracleDefaultFilterOptions.severity : []}
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Severity: ${
                    !oracleDefaultFilterOptions.severity?.length ||
                    oracleDefaultFilterOptions.severity.length === safeFilterOptions.severities.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.severity?.length > 0
                        ? oracleDefaultFilterOptions.severity?.length
                        : safeFilterOptions.severities.length
                })`
            }
            placeholder="Placeholder text"
            options={safeFilterOptions.severities}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'severity')}
            variant="underline"
        />
    );

    const tagsSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={oracleDefaultFilterOptions.tags ? oracleDefaultFilterOptions.tags : []}
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Tags: ${
                    !oracleDefaultFilterOptions.tags?.length ||
                    oracleDefaultFilterOptions.tags.length === safeFilterOptions.tags.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.tags?.length > 0
                        ? oracleDefaultFilterOptions.tags?.length
                        : safeFilterOptions.tags.length
                })`
            }
            placeholder="Placeholder text"
            options={safeFilterOptions.tags}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'tags')}
            variant="underline"
        />
    );

    const resourceTypeSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={oracleDefaultFilterOptions.resourceType ? oracleDefaultFilterOptions.resourceType : []}
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Resource type: ${
                    !oracleDefaultFilterOptions.resourceType?.length ||
                    oracleDefaultFilterOptions.resourceType.length === safeFilterOptions.resourceTypes.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.resourceType?.length > 0
                        ? oracleDefaultFilterOptions.resourceType?.length
                        : safeFilterOptions.resourceTypes.length
                })`
            }
            placeholder="Placeholder text"
            options={safeFilterOptions.resourceTypes}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'resourceType')}
            variant="underline"
        />
    );

    return (
        <div className={styles.filterComponent}>
            <DsAccordion
                id="100"
                variant="Default"
                isDisabled={loading || !isAssessmentAvailable}
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
                                    loading || !isAssessmentAvailable ? 'var(--text-disabled)' : 'var(--text-primary)'
                            }}
                            variant="Semibold_14"
                        >
                            Configurations:{' '}
                            {loading
                                ? GENERAL.NOT_AVAILABLE
                                : `${
                                      getTotalConfigCount === totalConfigCount
                                          ? `All(${getTotalConfigCount})`
                                          : getTotalConfigCount === configCount
                                          ? `${getTotalConfigCount}`
                                          : `${configCount}/${getTotalConfigCount}`
                                  }`}
                        </DsTypography>
                    </div>
                }
                children={
                    <div
                        className={styles.mainSection}
                        style={{ gap: oracleOptimizeFilterTags.length > 0 ? '42px' : '0px' }}
                    >
                        <div className={styles.dropdownList}>
                            <div className={styles.dropDown}>{categoriesSelectBox()}</div>
                            <div className={styles.dropDown}>{subCategoriesSelectBox()}</div>
                            <div className={`${styles.dropDown} ${styles['optimized-drop-down']}`}>
                                {statusSelectBox()}
                            </div>
                            <div className={styles.dropDown}>{severitySelectBox()}</div>
                            <div className={styles.dropDown}>{tagsSelectBox()}</div>
                            <div className={styles.dropDown}>{resourceTypeSelectBox()}</div>
                        </div>

                        <div
                            className={styles.filtersOption}
                            style={{
                                marginBottom: oracleOptimizeFilterTags.length > 0 ? '18px' : '16px'
                            }}
                        >
                            <div className={styles.tagsContainer}>
                                {oracleOptimizeFilterTags.map((item: any, index: number) => (
                                    <div className={styles.filterTag} key={index}>
                                        <DsTypography
                                            style={{ color: 'var(--header-notification-text)' }}
                                            variant="Semibold_13"
                                        >
                                            {item.label}
                                        </DsTypography>
                                        <div onClick={() => handleCancelFilter(item)} className={styles.closeButton}>
                                            <Close />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {oracleOptimizeFilterTags.length ? (
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
                                {!oracleDefaultFilterOptions['all-catagories']?.length ||
                                oracleDefaultFilterOptions['all-catagories']?.length === 1
                                    ? 'All(1)'
                                    : `${oracleDefaultFilterOptions['all-catagories']?.length}/1`}
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
                                {!oracleDefaultFilterOptions['sub-catagories']?.length ||
                                oracleDefaultFilterOptions['sub-catagories']?.length ===
                                    safeFilterOptions.subCategories.length
                                    ? `All(${safeFilterOptions.subCategories.length})`
                                    : `${oracleDefaultFilterOptions['sub-catagories']?.length}/${safeFilterOptions.subCategories.length}`}
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
                                {!oracleDefaultFilterOptions.status?.length ||
                                oracleDefaultFilterOptions.status?.length === 2
                                    ? 'All(2)'
                                    : `${oracleDefaultFilterOptions.status?.length}/2`}
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
                                {!oracleDefaultFilterOptions.severity?.length ||
                                oracleDefaultFilterOptions.severity?.length === 2
                                    ? 'All(2)'
                                    : `${oracleDefaultFilterOptions.severity?.length}/2`}
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
                                {!oracleDefaultFilterOptions.tags?.length ||
                                oracleDefaultFilterOptions.tags?.length === 5
                                    ? 'All(5)'
                                    : `${oracleDefaultFilterOptions.tags?.length}/5`}
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
                                {!oracleDefaultFilterOptions.resourceType?.length ||
                                oracleDefaultFilterOptions.resourceType?.length === 4
                                    ? 'All(4)'
                                    : `${oracleDefaultFilterOptions.resourceType?.length}/4`}
                            </DsTypography>
                        </div>
                    </div>
                }
            />
        </div>
    );
};

export default OracleFilterComponent;
