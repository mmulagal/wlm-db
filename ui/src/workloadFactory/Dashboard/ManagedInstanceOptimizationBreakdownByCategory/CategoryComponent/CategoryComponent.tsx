import { DsButton, DsFlashingDotsLoader, DsTypography, useDialog } from '@netapp/design-system';
import { ReactComponent as ComingSoon } from '../../../../assets/ComingSoonLarge.svg';
import { ReactComponent as ComingSoon2 } from '../../../../assets/comingSoon2.svg';
import styles from './CategoryComponent.module.scss';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import useResize from '../../../../common/hooks/useResize';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../utils/appConstants';
import CategoryDialogComponent from '../CategoryDialogComponent/CategoryDialogComponent';
import { WLF_TABS } from '../../../../utils/consts';
import { useDispatch } from 'react-redux';
import { setBreadCrumbSelectedFrom, setSelectedHeaderTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../../store/workloadFactory/databaseHomeSlice';
import store from '../../../../store/store';
import {
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setLandingFrom
} from '../../../../store/workloadFactory/getWellOptimizeSlice';

type CategoryComponentProps = {
    image: React.ReactNode;
    firstBlockText: string;
    optimizationScore: number;
    optimizationInstances: number;
    totalOptimizationInstances: number;
    isComingSoon: boolean;
    isBorderRequired?: boolean;
};
const CategoryComponent = ({
    image,
    firstBlockText,
    optimizationScore,
    optimizationInstances,
    totalOptimizationInstances,
    isComingSoon,
    isBorderRequired
}: CategoryComponentProps) => {
    const windowSize = useResize();
    const isLoading = false;
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const redirectToGetWellPage = () => {
        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.DASHBOARD));

        const updatedState = store.getState();
        const { selectedAssessmentRow }: any = updatedState.databaseHome;

        dispatch(setGwHostname(selectedAssessmentRow?.hostName));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setGwResourceId(selectedAssessmentRow?.resourceId));
        dispatch(setGwDatabaseInstance(selectedAssessmentRow?.databaseInstanceId));
        dispatch(setGwDatabaseInstanceName(selectedAssessmentRow?.databaseInstanceName));
        dispatch(setGwDatabaseStorageType(selectedAssessmentRow?.sqlServerDeploymentType));
    };

    const handleDialog = () => {
        setDialog(
            <DialogComponent
                header={`${firstBlockText} optimization`}
                content={<CategoryDialogComponent type={firstBlockText} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    redirectToGetWellPage();
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.dialog}
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
                <DsTypography variant="Regular_14">Optimization instances</DsTypography>
            </div>

            <SeparatorComponent variant="vertical" height="60px" />

            <div className={styles.buttonBlock}>
                {isComingSoon && windowSize.width > 1700 && <ComingSoon />}
                {isComingSoon && windowSize.width < 1700 && <ComingSoon2 />}
                {!isComingSoon && (
                    <DsButton variant="secondary" isThin onClick={() => handleDialog()}>
                        Optimize
                    </DsButton>
                )}
            </div>
        </div>
    );
};

export default CategoryComponent;
