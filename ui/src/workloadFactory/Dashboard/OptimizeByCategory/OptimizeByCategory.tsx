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
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setLandingFrom
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection, setSelectedAssessmentRow } from '../../../store/workloadFactory/databaseHomeSlice';
import { sortListOfDict } from '../../../utils/utilityFunctions';
import { INVENTORY_STATUS, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
import store from '../../../store/store';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import CategoryDialogComponent from '../ManagedInstanceOptimizationBreakdownByCategory/CategoryDialogComponent/CategoryDialogComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';

const OptimizeByCategory = () => {
    const dispatch = useDispatch();
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const categoryData = useMemo(() => {
        return getAssessmentGroupedByCategory(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);

    const redirectToGetWellPage = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.DASHBOARD));

        const updatedState = store.getState();
        const { selectedAssessmentRow }: any = updatedState.databaseHome;

        dispatch(setGwHostname(selectedAssessmentRow?.hostName));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setGwResourceId(selectedAssessmentRow?.databaseHostId));
        dispatch(setGwDatabaseInstance(selectedAssessmentRow?.instanceId));
        dispatch(setGwDatabaseInstanceName(selectedAssessmentRow?.databaseInstanceName));
        dispatch(setGwDatabaseStorageType(selectedAssessmentRow?.sqlServerDeploymentType));
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
                header={`Optimization`}
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
                    Instances optimization breakdown by category
                </DsTypography>

                <div className={styles.rightSection}>
                    {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
                    <DsButton
                        variant="secondary"
                        isThin={true}
                        onClick={() => handleClick()}
                        isDisabled={allmssqlHostAssessmentLoading}
                        data-testid="wlm-db-optimize-instances-by-category"
                    >
                        Optimize
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
                                {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
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
                                {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
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
                                {allmssqlHostAssessmentLoading && <DsFlashingDotsLoader />}
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
                            <div>
                                <ComingSoon2 />
                            </div>
                            <DsTypography variant="Semibold_14">Resiliency</DsTypography>
                        </div>
                        <div className={styles.section3}></div>
                    </div>
                    <div className={styles.tile1}>
                        <div className={styles.section1}>
                            <Cloning />
                        </div>
                        <div className={styles.section2}>
                            <div>
                                <ComingSoon2 />
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
