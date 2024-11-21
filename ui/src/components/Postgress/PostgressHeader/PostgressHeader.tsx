import { Button, Header, Popover, useDialog, postBlueXPMessage, BlueXPListeners } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { useNavigate } from 'react-router-dom';
import styles from './PostgressHeader.module.scss';

import { FORM_TO_WLF_NAVIGATE_BLUEXP, FROM_DIALOG } from '../../../utils/consts';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import SaveConfig from '../../CreateMsSql/SaveConfig/SaveConfig';
import {
    LoadConfiguration,
    SaveConfiguration,
    resetChecksAfterLoad,
    resetRefetchApiCheck
} from '../../CreateMsSql/Configuration/LoadConfiguration';
import { useDispatch } from 'react-redux';
import { useGetConfigListQuery, useLazyGetConfigDataQuery, useSaveConfigDataMutation } from '../../../utils/apiService';
import { navigateToCanvas } from '../../../utils/appConfig';
import LoadConfig from '../../CreateMsSql/LoadConfig/LoadConfig';
import { useEffect } from 'react';
const _ = require('lodash');

const PostgressHeader = () => {
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);

    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    // API call to get configuration list
    const { refetch: configListRefetch } = useGetConfigListQuery({});

    const navigate = useNavigate();
    const handleNavigateWithoutDialog = () => {
        if (isWorkloadFactoryStatus) {
            navigate('../databases');
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP);
        }
    };

    useEffect(() => {
        if (isLoadConfig) {
            console.log(refetchApiCount);
            if (
                refetchApiCount?.isLoading &&
                (refetchApiCount?.expected.length === 0 ||
                    _.uniq(refetchApiCount?.ran).length === _.uniq(refetchApiCount?.expected).length)
            ) {
                resetChecksAfterLoad(dispatch, closeDialog);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadConfig, refetchApiCount]);

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_PGSQL_HEADER}
                content={<LoadConfig formType="pgsql" />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    LoadConfiguration(dispatch, loadConfigDataExe, closeDialog, undefined, 'pgsql');
                }}
                closeCallback={() => {
                    // dispatch(setIsLoadConfig(false));
                    resetRefetchApiCheck(dispatch);
                }}
                dialogFrom={FROM_DIALOG.LOAD_CONFIG}
                customClass={styles.setLoadConfigWidth}
            />
        );
    };

    const handleSaveConfig = (dialogFrom: string) => {
        setDialog(
            <DialogComponent
                header={GENERAL.SAVE_CONFIG_PGSQL_HEADER}
                content={<SaveConfig description={GENERAL.SAVE_CONFIG_PGSQL_CONTENT} />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() =>
                    SaveConfiguration(dispatch, saveConfigData, configListRefetch, closeDialog, dialogFrom, 'pgsql')
                }
                closeCallback={() => {
                    // dispatch(setSaveConfigName(''));
                    if (dialogFrom === FROM_DIALOG.HEADER_CROSS) {
                        if (databaseHostEntryPoint === 'inventory') {
                            navigate('databases/inventory');
                        } else if (databaseHostEntryPoint === 'database') {
                            if (isWorkloadFactory) {
                                navigate('/databases');
                            } else {
                                navigate('../../fsxdb');
                            }
                        } else {
                            if (isWorkloadFactory) {
                                navigateToCanvas('/');
                            } else {
                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: { pathname: '../../../../../fsxhome', replace: true }
                                });
                            }
                        }
                    }
                }}
                dialogFrom={dialogFrom}
            />
        );
    };
    return (
        <Header
            title={'Create new PostgreSQL Server'}
            closeButtonProps={{
                onClick: () => {
                    handleNavigateWithoutDialog();
                }
            }}
            style={{ width: '100vw' }}
        >
            <div className={styles['header-button-pgsql']}>
                <Button Component="button" onClick={handleLoadConfiguration} variant="text">
                    {SELECT_CONFIG.LOAD_CONFIG}
                </Button>

                {/* {!isConfig && (
                    <Button
                        Component="button"
                        variant="text"
                        isDisabled={!isConfig}
                        title={SELECT_CONFIG.NO_SAVED_CONFIG}
                    >
                        {SELECT_CONFIG.LOAD_CONFIG}
                    </Button>
                )} */}

                <div className={styles.separator}></div>
                {/* {configData?.length >= MAX_SAVED_CONFIG && (
                    <Popover
                        popoverClass={styles['popover']}
                        children={SELECT_CONFIG.MAX_CONFIG_LIMIT}
                        trigger="hover"
                        container={
                            <Button Component="button" variant="text" isDisabled={true}>
                                {SELECT_CONFIG.SAVE_CONFIG}
                            </Button>
                        }
                    />
                )} */}

                <Button Component="button" onClick={() => handleSaveConfig(FROM_DIALOG.SAVE_CONFIG)} variant="text">
                    {SELECT_CONFIG.SAVE_CONFIG}
                </Button>
            </div>
        </Header>
    );
};

export default PostgressHeader;
