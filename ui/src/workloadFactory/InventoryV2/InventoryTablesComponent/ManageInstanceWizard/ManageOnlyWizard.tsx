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
import { Content } from './ManageInstanceStep/ManageInstanceStep';
import styles from './ManageInstanceWizard.module.scss';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { handleSingleInstanceManage } from './ManageInstanceUtils';
import { setLandingFromWizard } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useLazyGetSubTaskListQuery, useManageBulkV2MssqlInstanceMutation } from '../../../../utils/apiService';

const ManageOnlyWizard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [manageBulkV2InstanceApi] = useManageBulkV2MssqlInstanceMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const manageSingleInstanceChecks = useAppSelector(state => state.inventoryV2.manageSingleInstanceChecks);

    const handleManage = () => {
        handleSingleInstanceManage(
            manageSingleInstanceChecks,
            dispatch,
            manageBulkV2InstanceApi,
            getJobDetailApi,
            navigate
        );
    };
    return (
        <StepLayout>
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
