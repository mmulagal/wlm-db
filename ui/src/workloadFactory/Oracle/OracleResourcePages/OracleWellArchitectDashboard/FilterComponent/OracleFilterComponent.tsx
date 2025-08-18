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

import { CONFIG_STATES } from '../../../../../utils/consts';
import { handleSelectForFilter, removeEntry, removeObjectFromArray } from '../../../../../utils/resourceUtils';
import { oracleApplyFilter } from '../OracleWellArchitectedUtils';

const OracleFilterComponent = ({ setFilteredCardData }: any) => {
    const dispatch = useDispatch();
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { oracleDefaultFilterOptions, oracleOptimizeFilterTags } = useAppSelector(state => state.oracleSlice);
    // This might be pass from parent
    const [configCount, setConfigCount] = useState(0);

    const totalConfigCount = useAppSelector(state => state.getWellOptimize.optimizationBreakDown?.total?.total);
    const {
        optimizePageLoading: loading,
        isAssessmentAvailable,
        cardData,
        ontapConfigTableData
    } = useAppSelector(state => state.getWellOptimize);

    // To apply filters on change of filters or card data
    useEffect(() => {
        const { data, configCount } = oracleApplyFilter(cardData, oracleOptimizeFilterTags);
        setFilteredCardData(data);
        setConfigCount(configCount);
    }, [cardData, oracleOptimizeFilterTags, ontapConfigTableData]);

    const generateSubCategoryOptions = useMemo(() => {
        const selectedCategories = oracleOptimizeFilterTags
            .filter((tag: any) => tag && tag.type === 'all-catagories')
            .map((tag: any) => tag.value);
        const options = [
            {
                id: 0,
                label: 'Storage layout',
                value: 'Storage layout',
                category: 'Storage'
            },
            {
                id: 2,
                label: 'Storage configuration',
                value: 'Storage configuration',
                category: 'Storage'
            }
        ];
        const filteredOptions = selectedCategories.length
            ? options.filter((option: any) => selectedCategories.includes(option.category))
            : options;
        const selectedSubCategories =
            oracleDefaultFilterOptions['sub-catagories']?.filter((id: any) =>
                filteredOptions.find((option: any) => option.id === id)
            ) || [];
        const selectedOptimizeTags = oracleOptimizeFilterTags.filter(
            (tag: any) => tag.type !== 'sub-catagories' || filteredOptions.find((option: any) => option.id === tag.id)
        );
        if (oracleOptimizeFilterTags.length !== selectedOptimizeTags.length) {
            dispatch(setOracleOptimizeFilterTags(selectedOptimizeTags));
        }
        dispatch(
            setOracleDefaultFilterOptions({ ...oracleDefaultFilterOptions, 'sub-catagories': selectedSubCategories })
        );
        return filteredOptions;
    }, [oracleOptimizeFilterTags]);

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
                    oracleDefaultFilterOptions['all-catagories'].length === 1
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions['all-catagories']?.length > 0
                        ? oracleDefaultFilterOptions['all-catagories']?.length
                        : 1
                })`
            }
            placeholder="Placeholder text"
            options={[
                {
                    id: 0,
                    label: 'Storage ',
                    value: 'Storage'
                }
            ]}
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
                    oracleDefaultFilterOptions['sub-catagories'].length === generateSubCategoryOptions.length
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions['sub-catagories']?.length > 0
                        ? oracleDefaultFilterOptions['sub-catagories']?.length
                        : generateSubCategoryOptions.length
                })`
            }
            placeholder="Placeholder text"
            isCleanable={false}
            options={generateSubCategoryOptions}
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
                    !oracleDefaultFilterOptions.status?.length || oracleDefaultFilterOptions.status.length === 2
                        ? 'All'
                        : ''
                }(${oracleDefaultFilterOptions.status?.length > 0 ? oracleDefaultFilterOptions.status?.length : 2})`
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
                    !oracleDefaultFilterOptions.severity?.length || oracleDefaultFilterOptions.severity.length === 2
                        ? 'All'
                        : ''
                }(${oracleDefaultFilterOptions.severity?.length > 0 ? oracleDefaultFilterOptions.severity?.length : 2})`
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
                    !oracleDefaultFilterOptions.tags?.length || oracleDefaultFilterOptions.tags.length === 3
                        ? 'All'
                        : ''
                }(${oracleDefaultFilterOptions.tags?.length > 0 ? oracleDefaultFilterOptions.tags?.length : 3})`
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
                }
            ]}
            selectionType="multi"
            isWithActions
            onSelect={(option: any) => handleSelect(option, 'tags')}
            variant="underline"
        />
    );

    const configStateSelectBox = () => (
        <DsSelect
            title=""
            selectedOptionIds={oracleDefaultFilterOptions.configState ? oracleDefaultFilterOptions.configState : []}
            dropDown={{
                isCloseOnClickOutside: true
            }}
            isCleanable={false}
            formatLabel={() =>
                `Analysis state: ${
                    !oracleDefaultFilterOptions.configState?.length ||
                    oracleDefaultFilterOptions.configState.length === 3
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.configState?.length > 0
                        ? oracleDefaultFilterOptions.configState?.length
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
            onSelect={(option: any) => handleSelect(option, 'configState')}
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
                    oracleDefaultFilterOptions.resourceType.length === 2
                        ? 'All'
                        : ''
                }(${
                    oracleDefaultFilterOptions.resourceType?.length > 0
                        ? oracleDefaultFilterOptions.resourceType?.length
                        : 2
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
                }
            ]}
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
                            {/* <div className={styles.dropDown}>{configStateSelectBox()}</div> */}
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
                                    generateSubCategoryOptions.length
                                    ? `All(${generateSubCategoryOptions.length})`
                                    : `${oracleDefaultFilterOptions['sub-catagories']?.length}/${generateSubCategoryOptions.length}`}
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
                                oracleDefaultFilterOptions.tags?.length === 3
                                    ? 'All(3)'
                                    : `${oracleDefaultFilterOptions.tags?.length}/3`}
                            </DsTypography>
                        </div>

                        {/* <div className={styles.items}>
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
                                {!oracleDefaultFilterOptions.configState?.length ||
                                oracleDefaultFilterOptions.configState?.length === 3
                                    ? 'All(3)'
                                    : `${oracleDefaultFilterOptions.configState?.length}/3`}
                            </DsTypography>
                        </div> */}

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
                                oracleDefaultFilterOptions.resourceType?.length === 2
                                    ? 'All(2)'
                                    : `${oracleDefaultFilterOptions.resourceType?.length}/2`}
                            </DsTypography>
                        </div>
                    </div>
                }
            />
        </div>
    );
};

export default OracleFilterComponent;
