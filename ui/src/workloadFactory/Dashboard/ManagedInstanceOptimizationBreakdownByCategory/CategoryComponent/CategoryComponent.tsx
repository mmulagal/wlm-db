import { DsButton, DsFlashingDotsLoader, DsTypography, useDialog } from '@netapp/design-system';
import { ReactComponent as ComingSoon } from '../../../../assets/ComingSoonLarge.svg';
import { ReactComponent as ComingSoon2 } from '../../../../assets/comingSoon2.svg';
import styles from './CategoryComponent.module.scss';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import useResize from '../../../../common/hooks/useResize';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import CategoryDialogComponent from '../CategoryDialogComponent/CategoryDialogComponent';
import { INVENTORY_STATUS, WLF_TABS } from '../../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection, setSelectedAssessmentRow } from '../../../../store/workloadFactory/databaseHomeSlice';
import store from '../../../../store/store';
import {
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setLandingFrom
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { getAssessmentHostListGroupedByCategory } from '../../../DatabaseHomePage/DatabaseHomeUtils';
import { sortListOfDict } from '../../../../utils/utilityFunctions';

type CategoryComponentProps = {
    image: React.ReactNode;
    firstBlockText: string;
    optimizationScore: number;
    optimizationInstances: number;
    totalOptimizationInstances: number;
    isComingSoon: boolean;
    isBorderRequired?: boolean;
    isLoading: boolean;
};
const CategoryComponent = ({
    image,
    firstBlockText,
    optimizationScore,
    optimizationInstances,
    totalOptimizationInstances,
    isComingSoon,
    isBorderRequired,
    isLoading
}: CategoryComponentProps) => {
    const windowSize = useResize();
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);

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

    const handleDialog = () => {
        let tableData = sortListOfDict(
            getAssessmentHostListGroupedByCategory(allmssqlHostAssessmentData, firstBlockText) || [],
            'status',
            false
        );
        let isOnlineInstance = tableData.some(
            (item: any) =>
                item?.status === INVENTORY_STATUS.RUNNING || item?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
        );
        setDialog(
            <DialogComponent
                header={`${firstBlockText} optimization`}
                content={<CategoryDialogComponent type={firstBlockText} tableData={tableData} />}
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
            />
        );
    };

    return (
        <div
            className={styles.categoryComponent}
            style={{ borderBottom: isBorderRequired ? '1px solid var(--border' : '' }}
        >
            <div className={styles.firstBlock}>
                <div>{image}</div>
                <DsTypography variant="Semibold_14">{firstBlockText}</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.commonBlock}>
                {isComingSoon && <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>--</div>}
                {!isComingSoon && !isLoading && (
                    <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                        {optimizationScore}%
                    </DsTypography>
                )}
                {!isComingSoon && isLoading && (
                    <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                <DsTypography variant="Regular_14">Optimization score</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.thirdBlock}>
                {isComingSoon && <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>--</div>}
                {!isComingSoon && !isLoading && (
                    <div className={styles.commonBlockText}>
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {optimizationInstances}
                        </DsTypography>
                        &nbsp;
                        <DsTypography variant="Regular_14" style={{ display: 'flex', alignItems: 'end' }}>
                            out of
                        </DsTypography>
                        &nbsp;
                        <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                            {totalOptimizationInstances}
                        </DsTypography>
                    </div>
                )}
                {!isComingSoon && isLoading && (
                    <div style={{ height: '36px', display: 'flex', alignItems: 'center' }}>
                        <DsFlashingDotsLoader />
                    </div>
                )}
                <DsTypography variant="Regular_14">Optimized instances</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.buttonBlock}>
                {isComingSoon && windowSize.width > 1700 && <ComingSoon />}
                {isComingSoon && windowSize.width < 1700 && <ComingSoon2 />}
                {!isComingSoon && (
                    <DsButton
                        variant="secondary"
                        isThin
                        onClick={() => handleDialog()}
                        isDisabled={isLoading || optimizationScore === 100 || totalOptimizationInstances === 0}
                    >
                        Optimize
                    </DsButton>
                )}
            </div>
        </div>
    );
};

export default CategoryComponent;
