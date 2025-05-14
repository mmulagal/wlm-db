import { DsButton, DsFlashingDotsLoader, DsTypography, useDialog } from '@netapp/design-system';
import { ReactComponent as Storage } from '../../../assets/Storage.svg';
import { ReactComponent as Applications } from '../../../assets/Application.svg';
import { ReactComponent as Resiliency } from '../../../assets/Resiliency.svg';
import { ReactComponent as Cloning } from '../../../assets/Cloning.svg';
import { ReactComponent as Compute } from '../../../assets/Compute.svg';
import { ReactComponent as ComingSoon2 } from '../../../assets/comingSoon2.svg';
import styles from './OptimizeByCategory.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { getAssessmentGroupedByCategory } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { getAssessmentHostListGroupedByCategory } from '../../DatabaseHomePage/DatabaseHomeUtils';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom,
    setSelectedWellArchitectTab
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection, setSelectedAssessmentRow } from '../../../store/workloadFactory/databaseHomeSlice';
import { sortListOfDict } from '../../../utils/utilityFunctions';
import { INVENTORY_STATUS, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import CategoryDialogComponent from '../ManagedInstanceOptimizationBreakdownByCategory/CategoryDialogComponent/CategoryDialogComponent';
import {
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';

const OptimizeByCategory = () => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const categoryData = useMemo(() => {
        return getAssessmentGroupedByCategory(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const loading = useMemo(() => {
        return allmssqlHostAssessmentLoading || multiDataLoading;
    }, [allmssqlHostAssessmentLoading, multiDataLoading]);

    const redirectToGetWellPage = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.DASHBOARD));
        dispatch(setSelectedWellArchitectTab(WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS));

        const updatedState = store.getState();
        const { selectedAssessmentRow }: any = updatedState.databaseHome;
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(
            setGwPageLoadInstanceData({
                hostname: selectedAssessmentRow?.hostName,
                resourceId: selectedAssessmentRow?.databaseHostId,
                instanceId: selectedAssessmentRow?.instanceId,
                instanceName: selectedAssessmentRow?.databaseInstanceName,
                credId: selectedAssessmentRow?.credentialId,
                regionId: selectedAssessmentRow?.regionId,
                storageType: selectedAssessmentRow?.sqlServerDeploymentType
            })
        );

        dispatch(setSelectedHostname(selectedAssessmentRow?.hostName));

        dispatch(
            setSelectedResourcePageHostData({
                resourceId: selectedAssessmentRow?.databaseHostId,
                databaseInstanceId: selectedAssessmentRow?.instanceId,
                databaseInstanceName: selectedAssessmentRow?.databaseInstanceName,
                credentialId: selectedAssessmentRow?.credentialId,
                regionId: selectedAssessmentRow?.regionId
            })
        );
        dispatch(
            setFSXId({
                fsxId: selectedAssessmentRow?.fsxId,
                ec2InstanceId: selectedAssessmentRow?.ec2InstanceId
            })
        );
        setTimeout(() => {
            dispatch(setSelectedAssessmentRow(null));
        }, 5);
    };

    const handleClick = () => {
        let tableData = sortListOfDict(
            getAssessmentHostListGroupedByCategory(allmssqlHostAssessmentData) || [],
            'status',
            false
        );
        let isOnlineInstance = tableData.some((item: any) => item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP);
        setDialog(
            <DialogComponent
                header={`Fix well-architected issues`}
                content={<CategoryDialogComponent tableData={tableData} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    redirectToGetWellPage();
                }}
                closeCallback={() => {
                    closeDialog();
                    dispatch(setSelectedAssessmentRow(null));
                }}
                customClass={styles.dialog}
                primaryButtonDisabled={!tableData || tableData.length === 0 || !isOnlineInstance}
                testId="wlm-db-not optimize-instance-continue-button"
            />
        );
    };
    return (
        <div className={styles.optimizeByCategory}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Well-architected breakdown by category
                </DsTypography>

                <div className={styles.rightSection}>
                    {loading && <DsFlashingDotsLoader />}
                    <DsButton
                        variant="secondary"
                        isThin={true}
                        onClick={() => handleClick()}
                        isDisabled={loading}
                        data-testid="wlm-db-optimize-instances-by-category"
                    >
                        {GENERAL.OPTIMIZE}
                    </DsButton>
                </div>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.topSection}>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Storage />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {Math.round(((categoryData.storage || 0) / (categoryData.total || 1)) * 100)}%
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>

                            <DsTypography variant="Semibold_14">Storage</DsTypography>
                        </div>
                        <div className={styles.section3}></div>
                    </div>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Compute />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {Math.round(((categoryData.compute || 0) / (categoryData.total || 1)) * 100)}%
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Semibold_14">Compute</DsTypography>
                        </div>
                        <div className={styles.section3}></div>
                    </div>
                    <div className={styles.tile2}>
                        <div className={styles.section1}>
                            <Applications />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {Math.round(((categoryData.application || 0) / (categoryData.total || 1)) * 100)}%
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Semibold_14">{GENERAL.APPLICATION}</DsTypography>
                        </div>
                    </div>
                </div>

                <div className={styles.optimizeSeparator} />

                <div className={styles.topSection}>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Resiliency />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {Math.round(((categoryData.resiliency || 0) / (categoryData.total || 1)) * 100)}%
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Semibold_14">{GENERAL.RESILIENCY}</DsTypography>
                        </div>
                        <div className={styles.section3}></div>
                    </div>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Cloning />
                        </div>
                        <div className={styles.section2}>
                            <div className={styles.valueArea}>
                                <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                    {Math.round(((categoryData.cloning || 0) / (categoryData.total || 1)) * 100)}%
                                </DsTypography>
                                {loading && <DsFlashingDotsLoader />}
                            </div>
                            <DsTypography variant="Semibold_14">Cloning</DsTypography>
                        </div>
                        <div className={styles.section3}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptimizeByCategory;
