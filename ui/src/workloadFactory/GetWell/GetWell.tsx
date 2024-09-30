import { DsAccordion, DsTypography } from '@netapp/design-system';
import styles from './GetWell.module.scss';
import commonStyles from '../../utils/CommonStyles.module.scss';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';
import TotalOptimizationScore from './TotalOptimizationScore/TotalOptimizationScore';
import OptimizationBreakdown from './OptimizationBreakdown/OptimizationBreakdown';
import BreadCrumbs from '../../common/BreadCrumbs/BreadCrumbs';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../store/workloadFactory/inventorySlice';
import { WLF_TABS } from '../../utils/consts';

const GetWell = () => {
    const dispatch = useDispatch();
    const cardData = {
        StorageTier: {
            block_one: {
                type: 'Storage sizing',
                value: 'Storage tier'
            },
            block_two: {
                type: 'status',
                value: 'Optimized'
            },
            block_three: {
                type: 'Capacity tier',
                value: '0%'
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        },
        FileSystemHeadroom: {
            block_one: {
                value: 'File system headroom',
                type: 'Storage tier'
            },
            block_two: {
                type: 'status',
                value: 'Under-provisioned'
            },
            block_three: {
                type: 'File system headroom value',
                value: '35%'
            },
            block_four: {
                type: 'Severity',
                value: 'Critical'
            }
        },
        TransactionLogDriveSize: {
            block_one: {
                value: 'Transaction log drive size',
                type: 'Storage sizing'
            },
            block_two: {
                type: 'status',
                value: 'Over-provisioned'
            },
            block_three: {
                type: 'Transaction log drive size value',
                value: '100%'
            },
            block_four: {
                type: 'Severity',
                value: 'Warning'
            }
        },
        TempDBDriveSize: {
            block_one: {
                value: 'Temp DB drive size',
                type: 'Storage sizing'
            },
            block_two: {
                type: 'status',
                value: 'Optimized'
            },
            block_three: {
                type: 'TempDB drive size value',
                value: '50%'
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        },
        UserDataFiles: {
            block_one: {
                value: 'User data files (.mdf)',
                type: 'Storage layout'
            },
            block_two: {
                type: 'status',
                value: 'Optimized'
            },
            block_three: {
                type: 'User data files',
                value: 'Separate drive',
                smallFont: true
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        },
        TransactionLogFiles: {
            block_one: {
                value: 'Transaction log files (.ldf)',
                type: 'Storage layout'
            },
            block_two: {
                type: 'status',
                value: 'Optimized'
            },
            block_three: {
                type: 'Transaction log files (.Ldf)',
                value: 'Separate drive',
                smallFont: true
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        },
        TempDBPlacement: {
            block_one: {
                value: 'TempDB placement',
                type: 'Storage layout'
            },
            block_two: {
                type: 'status',
                value: 'Optimized'
            },
            block_three: {
                type: 'TempDB placement',
                value: 'Separate drive',
                smallFont: true
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        },
        ONTAPConfiguartion: {
            block_one: {
                value: 'ONTAP configuration',
                type: 'ONTAP configuration'
            },
            block_two: {
                type: 'status',
                value: 'Not optimized'
            },
            block_three: {
                type: 'Not-optimized values',
                value: '20%'
            },
            block_four: {
                type: 'Severity',
                value: 'Critical'
            }
        },
        Configuartion: {
            block_one: {
                value: 'Operating system',
                type: 'Configuration'
            },
            block_two: {
                type: 'status',
                value: 'optimized'
            },
            block_three: {
                type: 'Not-optimized values',
                value: '0%'
            },
            block_four: {
                type: 'Severity',
                value: 'None'
            }
        }
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
                        title={'Filter configurations'}
                        children={<div>Content here</div>}
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
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.FileSystemHeadroom} />
                        <DsAccordion
                            id="2"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TransactionLogDriveSize} />
                        <DsAccordion
                            id="3"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TempDBDriveSize} />
                        <DsAccordion
                            id="4"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
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
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TransactionLogFiles} />
                        <DsAccordion
                            id="6"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TempDBPlacement} />
                        <DsAccordion
                            id="7"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.TempDBPlacement} />
                        <DsAccordion
                            id="8"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
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
                        ONTAP configuration
                    </DsTypography>
                </div>

                <div className={styles.accordionGroups}>
                    <div className={styles.combineComponent}>
                        <StorageCardComponent cardData={cardData.ONTAPConfiguartion} />
                        <DsAccordion
                            id="9"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                        />
                    </div>

                    <div className={styles.combineComponent} style={{ marginBottom: '80px' }}>
                        <StorageCardComponent cardData={cardData.Configuartion} />
                        <DsAccordion
                            id="10"
                            variant="Default"
                            title={<div className={styles.genericTag}>Performance efficiency</div>}
                            headerActions={[
                                <div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>
                            ]}
                            children={<div>Content here</div>}
                            style={{ marginBottom: '40px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GetWell;
