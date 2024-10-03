import { DsAccordion, DsSelect, DsTypography } from '@netapp/design-system';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as Light } from '../../assets/Light.svg';
import { ReactComponent as Union } from '../../assets/Union.svg';
import { useDispatch } from 'react-redux';

import { WLF_TABS } from '../../utils/consts';
import RecommendationTable from './RecommendationTable/RecommendationTable';
import Tag from '../../common/Tag/Tag';
import RecommendationText from './RecommendationText/RecommendationText';
import { cardData, ontapConfigTableData, operatingSystemTableData, recommendendationTextData } from './GetWellUtils';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventoryV2Slice';

const GetWell = () => {
    const dispatch = useDispatch();

    const handleSelect = (option: any) => {
        console.log(option);
    };

    return (
        <div className={styles.getWell}>
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
            <div className={styles.header}>
                <div className={styles['header-top-section']}>
                    <DsTypography className={styles.optimizeHeader} variant="Semibold_20">
                        Optimize instance
                    </DsTypography>
                    <div className={styles.refreshIcon}>
                        <RefreshIcon />
                    </div>
                </div>
                <DsTypography variant="Semibold_16">instance name</DsTypography>
            </div>
            <div className={styles.getWellSecondLevel}>
                <TotalOptimizationScore />
                <OptimizationBreakdown />
            </div>

            <div className={styles.sectionTwo}>
                <div className={styles.filterComponent}>
                    <DsAccordion
                        id="2"
                        variant="Default"
                        title={
                            <div className={styles.filterHeaderStyle}>
                                <div>
                                    <Union />
                                </div>
                                <DsTypography variant="Semibold_14">Configurations: All(26)</DsTypography>
                            </div>
                        }
                        children={
                            <div className={styles.dropdownList}>
                                <div className={styles.dropDown}>
                                    <DsSelect
                                        title=""
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
                                        onSelect={(option: any) => handleSelect(option)}
                                        variant="underline"
                                    />
                                </div>
                                <div className={styles.dropDown}>
                                    <DsSelect
                                        title=""
                                        placeholder="Placeholder text"
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
                                        onSelect={(option: any) => handleSelect(option)}
                                        variant="underline"
                                    />
                                </div>
                                <div className={styles.dropDown}>
                                    <DsSelect
                                        title=""
                                        placeholder="Placeholder text"
                                        options={[
                                            {
                                                id: 0,
                                                label: 'Optimized',
                                                value: 'Optimized'
                                            },
                                            {
                                                id: 1,
                                                label: 'Not-optimized',
                                                value: 'Not-optimized'
                                            }
                                        ]}
                                        selectionType="multi"
                                        isWithActions={true}
                                        onSelect={(option: any) => handleSelect(option)}
                                        variant="underline"
                                    />
                                </div>
                                <div className={styles.dropDown}>
                                    <DsSelect
                                        title=""
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
                                        onSelect={(option: any) => handleSelect(option)}
                                        variant="underline"
                                    />
                                </div>
                                <div className={styles.dropDown}>
                                    <DsSelect
                                        title=""
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
                                        onSelect={(option: any) => handleSelect(option)}
                                        variant="underline"
                                    />
                                </div>
                            </div>
                        }
                        value={
                            <div className={styles.filterHeader}>
                                <div className={styles.items}>
                                    <DsTypography variant="Regular_14">Categories:</DsTypography>
                                    <DsTypography variant="Semibold_14">All (5)</DsTypography>
                                </div>

                                <div className={styles.items}>
                                    <DsTypography variant="Regular_14">Sub categories:</DsTypography>
                                    <DsTypography variant="Semibold_14">All (12)</DsTypography>
                                </div>

                                <div className={styles.items}>
                                    <DsTypography variant="Regular_14">Status:</DsTypography>
                                    <DsTypography variant="Semibold_14">All (4)</DsTypography>
                                </div>

                                <div className={styles.items}>
                                    <DsTypography variant="Regular_14">Severity:</DsTypography>
                                    <DsTypography variant="Semibold_14">All (2)</DsTypography>
                                </div>

                                <div className={styles.items}>
                                    <DsTypography variant="Regular_14">Tags:</DsTypography>
                                    <DsTypography variant="Semibold_14">All (5)</DsTypography>
                                </div>
                            </div>
                        }
                    />
                </div>

                {/* Section one */}
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
                        <StorageCardComponent cardData={cardData.StorageTier} />
                        <DsAccordion
                            id="1"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.StorageTier} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.FileSystemHeadroom} />
                        <DsAccordion
                            id="2"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.FileSystemHeadroom} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TransactionLogDriveSize} />
                        <DsAccordion
                            id="3"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.TransactionLogDriveSize} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TempDBDriveSize} />
                        <DsAccordion
                            id="4"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.TransactionDBDriveSize} />}
                        />
                    </div>
                </div>

                {/* Section two */}
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
                        <StorageCardComponent cardData={cardData.UserDataFiles} />
                        <DsAccordion
                            id="5"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.UserDataFileMdf} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TransactionLogFiles} />
                        <DsAccordion
                            id="6"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.TransactionLogFiles} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TempDBPlacement} />
                        <DsAccordion
                            id="7"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<RecommendationText data={recommendendationTextData.TempDBPlacement} />}
                        />
                    </div>
                </div>

                {/* Section three */}
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
                        <StorageCardComponent cardData={cardData.ONTAPConfiguartion} />
                        <DsAccordion
                            id="9"
                            variant="Default"
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
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>
                                        View recommendation & optimization
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationTable tableData={ontapConfigTableData} isLoading={false} />}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.Configuartion} />
                        <DsAccordion
                            id="10"
                            variant="Default"
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
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>
                                        View recommendation & optimization
                                    </div>
                                </div>
                            ]}
                            children={<RecommendationTable tableData={operatingSystemTableData} isLoading={false} />}
                            style={{ marginBottom: '40px' }}
                        />
                    </div>
                </div>

                {/* Section four */}
                <div className={styles['header-buttons']}>
                    <DsTypography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                    >
                        Storage performance
                    </DsTypography>
                </div>

                <div className={styles.accordionGroups}>
                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.Latency} />
                        <DsAccordion
                            id="11"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.Throughput} />
                        <DsAccordion
                            id="12"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<div />}
                        />
                    </div>

                    <div className={styles.combineComponent} style={{ marginBottom: '80px' }}>
                        <StorageCardComponent cardData={cardData.IOPS} />
                        <DsAccordion
                            id="13"
                            variant="Default"
                            title={<Tag text={'Performance efficiency'} />}
                            headerActions={[
                                <div className={styles.headerAction}>
                                    <div>
                                        <Light />
                                    </div>
                                    <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                                </div>
                            ]}
                            children={<div />}
                            style={{ marginBottom: '40px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GetWell;
