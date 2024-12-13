import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import styles from './DashboardInnerPage.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import { DsTypography, useDialog } from '@netapp/design-system';
import ValueCard from './ValueCard/ValueCard';
import TagComponent from './TagComponent/TagComponent';
import { useEffect, useState } from 'react';
import { cardDataDefault } from '../../GetWell/GetWellUtils';
import RecommendationText from '../../GetWell/RecommendationText/RecommendationText';
import StorageTierTable from './RenderTables/StorageTierTable';
import FileSystemHeadroomTable from './RenderTables/FileSystemHeadroom';
import LogDriveSizeTable from './RenderTables/LogDriveSizeTable';
import TempDBDriveSizeTable from './RenderTables/TempDBDriveSizeTable';
import UserDataFilesTable from './RenderTables/UserDataFilesTable';
import LogFileTable from './RenderTables/LogFileTable';
import TempDBPlacement from './RenderTables/TempDBPlacement';
import ComputeRightSizingTable from './RenderTables/ComputeRightSizingTable';
import OntapConfig from './RenderTables/OntapConfig';
import OperatingSystemTable from './RenderTables/OperatingSystemTable';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../../GetWell/StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';

const DashboardInnerPage = () => {
    const dispatch = useDispatch();
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const { cardData } = useAppSelector(state => state.getWellOptimize);
    const { setDialog, closeDialog } = useDialog();
    const [valueCardData, setValueCardData] = useState<any>({
        optimizationScore: '',
        optimizedInstances: '',
        notOptimizedInstances: '',
        severity: '',
        cardHeight: '',
        tagHeight: '',
        data: {
            title: '',
            description: '',
            values: []
        },
        cardName: ''
    });

    const handleDialog = (type: string) => {
        setDialog(
            <DialogComponent
                header={`${type} optimization`}
                content={
                    <DialogContent
                        type={type}
                        recommendationOptions={cardData?.recommendationOptions}
                        missingPermissions={cardData?.missingPermissions}
                        recommendedSizeInGib={cardData?.recommendedSizeInGib}
                    />
                }
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    // callOptimizeApi(type);
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.colorSet}
                hidePrimaryButton={
                    (type === 'File system headroom' || type === 'Log drive size' || type === 'TempDB drive size') &&
                    cardData?.missingPermissions &&
                    cardData?.missingPermissions.length > 0
                }
            />
        );
    };

    useEffect(() => {
        switch (selectedConfig) {
            case 'Storage tier':
                setValueCardData({
                    optimizationScore: '55%',
                    optimizedInstances: '55',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.storage_tier?.recommendation?.description
                    }
                });

                break;
            case 'File system headroom':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '144px',
                    tagHeight: '241px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.file_system_headroom?.recommendation?.description,
                        values: cardDataDefault?.file_system_headroom?.recommendation?.values
                    }
                });
                break;
            case 'Log drive size':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '168px',
                    tagHeight: '265px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_drive_size?.recommendation?.description,
                        values: cardDataDefault?.transaction_log_drive_size?.recommendation?.values
                    }
                });
                break;

            case 'TempDB drive size':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '192px',
                    tagHeight: '289px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_drive_size?.recommendation?.description,
                        values: cardDataDefault?.tempdb_drive_size?.recommendation?.values
                    }
                });
                break;
            case 'User data files (.mdf)':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.user_data_files?.recommendation?.description
                    }
                });
                break;
            case 'Log files (.ldf)':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '136px',
                    tagHeight: '233px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.transaction_log_files?.recommendation?.description
                    }
                });
                break;
            case 'TempDB placement':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '160px',
                    tagHeight: '257px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.tempdb_files?.recommendation?.description
                    }
                });
                break;

            case 'ONTAP configuration':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'View recommendation per configuration in the expand collapse view'
                    }
                });
                break;

            case 'Operating system':
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '112px',
                    tagHeight: '209px',
                    data: {
                        title: 'Recommendations',
                        description: 'View recommendation per configuration in the expand collapse view'
                    }
                });
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.compute_rightsizing?.recommendation?.description
                    },
                    cardName: 'compute_right_sizing'
                });
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.host_os_patch?.recommendation?.description
                    }
                });
                break;
            case GENERAL.APPLICATION_SQL_SERVER:
                setValueCardData({
                    optimizationScore: '65%',
                    optimizedInstances: '75',
                    notOptimizedInstances: '65',
                    severity: 'Critical',
                    cardHeight: '184px',
                    tagHeight: '281px',
                    data: {
                        title: 'Recommendations',
                        description: cardDataDefault?.sql_licenses?.recommendation?.description
                    }
                });
                break;
        }
    }, [selectedConfig]);

    const renderTable = () => {
        switch (selectedConfig) {
            case 'Storage tier':
                return <StorageTierTable handleDialog={handleDialog} />;
            case 'File system headroom':
                return <FileSystemHeadroomTable handleDialog={handleDialog} />;
            case 'Log drive size':
                return <LogDriveSizeTable handleDialog={handleDialog} />;
            case 'TempDB drive size':
                return <TempDBDriveSizeTable handleDialog={handleDialog} />;
            case 'User data files (.mdf)':
                return <UserDataFilesTable />;
            case 'Log files (.ldf)':
                return <LogFileTable />;
            case 'TempDB placement':
                return <TempDBPlacement />;
            case 'Compute rightsizing':
                return <ComputeRightSizingTable handleDialog={handleDialog} />;
            case 'ONTAP configuration':
                return <OntapConfig />;
            case 'Operating system':
                return <OperatingSystemTable />;
        }
    };
    return (
        <div className={styles.dashboardInnerPage}>
            <div className={styles.innerPage}>
                <div className={commonStyles.commonBreadCrumb}>
                    <BreadCrumbs
                        items={[
                            {
                                title: 'Dashboard',
                                onClick: () => {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                            },
                            {
                                title: `Optimize configuration (${selectedConfig})`
                            }
                        ]}
                    />
                </div>

                <div className={styles.headingSection}>
                    <DsTypography variant="Semibold_20">{selectedConfig}</DsTypography>
                    <DsTypography variant="Semibold_16">Manage instance optimization</DsTypography>
                </div>

                <div className={styles.mainSection}>
                    <div className={styles.leftSection}>
                        <ValueCard
                            optimizationScore={valueCardData.optimizationScore}
                            optimizedInstances={valueCardData.optimizedInstances}
                            notOptimizedInstances={valueCardData.notOptimizedInstances}
                            severity={valueCardData.severity}
                        />

                        <div className={styles.recommendation} style={{ height: valueCardData.cardHeight }}>
                            <RecommendationText
                                data={valueCardData?.data}
                                from={'dashboard'}
                                cardName={valueCardData?.cardName}
                            />
                        </div>
                    </div>
                    <div className={styles.rightSection}>
                        <TagComponent tagHeight={valueCardData.tagHeight} />
                    </div>
                </div>

                <div className={styles.tableSection}>{renderTable()}</div>
            </div>
        </div>
    );
};

export default DashboardInnerPage;
