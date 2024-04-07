import { Button, Header, useDialog, Popover } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { setSaveConfigName } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    useSaveConfigDataMutation,
    useLazyGetConfigDataQuery,
    useGetConfigListQuery
} from '../../../../utils/apiService';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { FROM_DIALOG, MAX_SAVED_CONFIG } from '../../../../utils/consts';
import {
    LoadConfiguration,
    resetChecksAfterLoad,
    resetRefetchApiCheck,
    SaveConfiguration
} from '../../Configuration/LoadConfiguration';
import LoadConfig from '../../LoadConfig/LoadConfig';
import SaveConfig from '../../SaveConfig/SaveConfig';
import styles from './MSSqlHeader.module.scss';
import { setIsLoadConfig } from '../../../../store/mssql/msSqlActionSlice';
import { navigateToCanvas } from '../../../../utils/appConfig';
const _ = require('lodash');

const MSSqlHeader = () => {
    const { setDialog, closeDialog } = useDialog();
    const dispatch = useDispatch();

    const [isConfig, setIsConfig] = useState(false);

    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const [saveConfigData] = useSaveConfigDataMutation();
    const [loadConfigDataExe] = useLazyGetConfigDataQuery();

    // API call to get configuration list
    const { refetch: configListRefetch } = useGetConfigListQuery({});

    useEffect(() => {
        if (configData && configData.length > 0) {
            setIsConfig(true);
        } else {
            setIsConfig(false);
        }
    }, [configData]);

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const refetchApiCount = useAppSelector(state => state.msSqlAction.refetchApiCount);

    useEffect(() => {
        if (isLoadConfig) {
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
                header={GENERAL.LOAD_CONFIG_HEADER}
                content={<LoadConfig />}
                primaryButton={GENERAL.LOAD}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    LoadConfiguration(dispatch, loadConfigDataExe, closeDialog);
                }}
                closeCallback={() => {
                    dispatch(setIsLoadConfig(false));
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
                header={GENERAL.SAVE_CONFIG_HEADER}
                content={<SaveConfig description={GENERAL.SAVE_CONFIG_CONTENT} />}
                primaryButton={GENERAL.SAVE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => SaveConfiguration(dispatch, saveConfigData, configListRefetch, closeDialog, dialogFrom)}
                closeCallback={() => {
                    dispatch(setSaveConfigName(''));
                    if (dialogFrom === FROM_DIALOG.HEADER_CROSS) {
                        navigateToCanvas('/');
                    }
                }}
                dialogFrom={dialogFrom}
            />
        );
    };

    return (
        <Header
            closeButtonProps={{
                onClick: () => {
                    configData.length < MAX_SAVED_CONFIG
                        ? handleSaveConfig(FROM_DIALOG.HEADER_CROSS)
                        : navigateToCanvas('/');
                }
            }}
            title={SELECT_CONFIG.WIZARD_HEADING}
            style={{ width: '100vw' }}
        >
            <div className={styles['header-button']}>
                {isConfig && (
                    <Button Component="button" onClick={handleLoadConfiguration} variant="text">
                        {SELECT_CONFIG.LOAD_CONFIG}
                    </Button>
                )}
                {!isConfig && (
                    <Button
                        Component="button"
                        variant="text"
                        isDisabled={!isConfig}
                        title={SELECT_CONFIG.NO_SAVED_CONFIG}
                    >
                        {SELECT_CONFIG.LOAD_CONFIG}
                    </Button>
                )}

                <div className={styles.separator}></div>
                {configData?.length >= MAX_SAVED_CONFIG && (
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
                )}

                {(!configData || configData?.length < MAX_SAVED_CONFIG) && (
                    <Button Component="button" onClick={() => handleSaveConfig(FROM_DIALOG.SAVE_CONFIG)} variant="text">
                        {SELECT_CONFIG.SAVE_CONFIG}
                    </Button>
                )}
            </div>
        </Header>
    );
};

export default MSSqlHeader;
