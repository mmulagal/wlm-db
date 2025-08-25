import {
    BlueXPListeners,
    Button,
    Header,
    StepLayout,
    WizardContent,
    WizardFooter,
    postBlueXPMessage
} from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { DsSpinner } from '@tlveng/wlm-ds';
import { Content } from './ManageInstanceStep/ManageInstanceStep';
import styles from './ManageInstanceWizard.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { handleSingleInstanceManage } from './ManageInstanceUtils';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    useLazyGetSubTaskListQuery,
    useManageBulkV2MssqlInstanceMutation,
    useManageBulkV2OracleInstanceMutation
} from '../../../../utils/apiService';
import { DBType } from '../../../../utils/consts';

const ManageOnlyWizard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const manageBulkMuttionApi = {
        [DBType.MSSQL]: useManageBulkV2MssqlInstanceMutation,
        [DBType.ORACLE]: useManageBulkV2OracleInstanceMutation
    };
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);
    const { loading } = useAppSelector(state => state.agenticAI.agenticRegisterFlowChecks);
    const engineTypeRaw = useAppSelector(
        state => state.inventoryV2.manageSingleInstanceData?.hostType
    ) as keyof typeof manageBulkMuttionApi;

    const engineType = engineTypeRaw ? String(engineTypeRaw) : ''; // Ensure string

    // Select mutation function based on hostType
    const useMutation =
        engineType && engineType in manageBulkMuttionApi
            ? manageBulkMuttionApi[engineType]
            : useManageBulkV2MssqlInstanceMutation;
    const [manageBulkApi] = useMutation();

    const handleManage = () => {
        handleSingleInstanceManage(
            manageSingleInstanceChecks,
            dispatch,
            manageBulkApi,
            getJobDetailApi,
            navigate,
            engineType,
            t
        );
    };
    return (
        <StepLayout>
            {loading && (
                <>
                    <div className={styles.loaderOverlay} />
                    <div className={styles.spinnerPlacement}>
                        <DsSpinner isLarge />
                    </div>
                </>
            )}
            <Header
                className={styles['manage-instance-wizard']}
                title={t('databases.register-flow.register-instance')}
                closeButtonProps={{
                    onClick: () => {
                        setTimeout(() => {
                            dispatch(setLandingFromWizard(true));
                            navigate('../databases/inventory');
                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: {
                                    pathname: './inventory',
                                    replace: true
                                }
                            });
                        }, 100);
                    }
                }}
            />
            <WizardContent
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <Content />
            </WizardContent>
            <WizardFooter>
                <>
                    <Button
                        variant="secondary"
                        isThin
                        onClick={() => {
                            setTimeout(() => {
                                dispatch(setLandingFromWizard(true));
                                navigate('../databases/inventory');
                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: {
                                        pathname: './inventory',
                                        replace: true
                                    }
                                });
                            }, 100);
                        }}
                    >
                        {t('databases.register-flow.previous')}
                    </Button>
                    <Button isThin onClick={handleManage} id="wizard-manage-btn">
                        {t('databases.register-flow.register')}
                    </Button>
                </>
            </WizardFooter>
        </StepLayout>
    );
};

export default ManageOnlyWizard;
