import { Button, Header, Popover, useDialog, postBlueXPMessage, BlueXPListeners } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { uniq } from 'lodash';
import { useAppSelector } from '../../../store/storeHooks';
import styles from './PostgressHeader.module.scss';

import { FROM_DIALOG, MAX_SAVED_CONFIG, WIZARD_TYPE } from '../../../utils/consts';
import { GENERAL, SELECT_CONFIG } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import SaveConfig from '../../CreateMsSql/SaveConfig/SaveConfig';
import {
    LoadConfiguration,
    SaveConfiguration,
    resetChecksAfterLoad,
    resetRefetchApiCheck
} from '../../CreateMsSql/Configuration/LoadConfiguration';
import { useGetConfigListQuery, useLazyGetConfigDataQuery, useSaveConfigDataMutation } from '../../../utils/apiService';
import { navigateToCanvas } from '../../../utils/appConfig';
import LoadConfig from '../../CreateMsSql/LoadConfig/LoadConfig';

const PostgressHeader = () => {
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();
    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);

    const [isConfig, setIsConfig] = useState(false);

    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();
    // API call to get configuration list
    const { refetch: configListRefetch } = useGetConfigListQuery({});

    const navigate = useNavigate();
    const handleNavigateWithoutDialog = () => {
        if (databaseHostEntryPoint === 'inventory') {
            if (isWorkloadFactory) {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../databases/inventory', replace: true }
                });
            } else {
                postBlueXPMessage({
                    type: BlueXPListeners.navigate,
                    payload: { pathname: '../../fsxdb/inventory', replace: true }
                });
            }
        } else if (databaseHostEntryPoint === 'database') {
            if (isWorkloadFactory) {
                navigate('/databases');
            } else {
                navigate('../../fsxdb');
            }
        } else if (isWorkloadFactory) {
            navigateToCanvas('/');
        } else {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: { pathname: '../../../../../fsxhome', replace: true }
            });
        }
    };

    useEffect(() => {
        if (isLoadConfig) {
            if (
                refetchApiCount?.isLoading &&
                (refetchApiCount?.expected.length === 0 ||
                    uniq(refetchApiCount?.ran).length === uniq(refetchApiCount?.expected).length)
            ) {
                resetChecksAfterLoad(dispatch, closeDialog);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadConfig, refetchApiCount]);

    useEffect(() => {
        const pgsqlConfigData = configData?.filter((item: any) => item?.databaseType === WIZARD_TYPE.PGSQL);
        if (pgsqlConfigData && pgsqlConfigData.length > 0) {
            setIsConfig(true);
        } else {
            setIsConfig(false);
        }
    }, [configData]);

    const handleLoadConfiguration = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LOAD_CONFIG_PGSQL_HEADER}
                content={<LoadConfig formType={WIZARD_TYPE.PGSQL} />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    LoadConfiguration(dispatch, loadConfigDataExe, closeDialog, undefined, WIZARD_TYPE.PGSQL);
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
                    SaveConfiguration(
                        dispatch,
                        saveConfigData,
                        configListRefetch,
                        closeDialog,
                        dialogFrom,
                        WIZARD_TYPE.PGSQL
                    )
                }
                closeCallback={() => {
                    // dispatch(setSaveConfigName(''));
                    if (dialogFrom === FROM_DIALOG.HEADER_CROSS) {
                        if (databaseHostEntryPoint === 'inventory') {
                            if (isWorkloadFactory) {
                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: { pathname: '../../databases/inventory', replace: true }
                                });
                            } else {
                                postBlueXPMessage({
                                    type: BlueXPListeners.navigate,
                                    payload: { pathname: '../../fsxdb/inventory', replace: true }
                                });
                            }
                        } else if (databaseHostEntryPoint === 'database') {
                            if (isWorkloadFactory) {
                                navigate('/databases');
                            } else {
                                navigate('../../fsxdb');
                            }
                        } else if (isWorkloadFactory) {
                            navigateToCanvas('/');
                        } else {
                            postBlueXPMessage({
                                type: BlueXPListeners.navigate,
                                payload: { pathname: '../../../../../fsxhome', replace: true }
                            });
                        }
                    }
                }}
                dialogFrom={dialogFrom}
            />
        );
    };
    return (
        <Header
            title="Create new PostgreSQL Server"
            closeButtonProps={{
                onClick: () => {
                    configData && configData.length < MAX_SAVED_CONFIG
                        ? handleSaveConfig(FROM_DIALOG.HEADER_CROSS)
                        : handleNavigateWithoutDialog();
                }
            }}
            style={{ width: '100vw' }}
        >
            <div className={styles['header-button-pgsql']}>
                {isConfig && (
                    <Button Component="button" onClick={handleLoadConfiguration} variant="text">
                        {SELECT_CONFIG.LOAD_CONFIG}
                    </Button>
                )}

                {!isConfig && (
                    <Popover
                        popoverClass={styles.popover}
                        children={SELECT_CONFIG.NO_SAVED_CONFIG_PGSQL}
                        trigger="hover"
                        container={
                            <Button Component="button" variant="text" isDisabled>
                                {SELECT_CONFIG.LOAD_CONFIG}
                            </Button>
                        }
                    />
                )}

                <div className={styles.separator} />
                {configData?.length >= MAX_SAVED_CONFIG && (
                    <Popover
                        popoverClass={styles.popover}
                        children={SELECT_CONFIG.MAX_CONFIG_LIMIT}
                        trigger="hover"
                        container={
                            <Button Component="button" variant="text" isDisabled>
                                {SELECT_CONFIG.SAVE_CONFIG}
                            </Button>
                        }
                    />
                )}

                {configData?.length < MAX_SAVED_CONFIG && (
                    <Button Component="button" onClick={() => handleSaveConfig(FROM_DIALOG.SAVE_CONFIG)} variant="text">
                        {SELECT_CONFIG.SAVE_CONFIG}
                    </Button>
                )}
            </div>
        </Header>
    );
};

export default PostgressHeader;
