import { DsRadioButton, Typography } from '@netapp/design-system';
import styles from './UndetectedSecondDialog.module.scss';
import { useDispatch } from 'react-redux';
import { setRadioValueDetect } from '../../../../store/workloadFactory/inventorySlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { DETECT_HOST_VAR, FSX_DEPLOYMENT_MODE } from '../../../../utils/consts';

const UndetectedSecondDialog = ({ data, apiResult }: { data: any; apiResult: any }) => {
    const detectHostRadio = useAppSelector(state => state.inventory.detectHostRadio);
    const dispatch = useDispatch();
    const handleRadio = (val: string) => {
        dispatch(setRadioValueDetect(val));
    };

    let fsxType = false;
    let ebsType = false;
    // To check is SQL server has FSx and EBS storage 
    if (data?.sqlServerInstances?.[0]?.storage) {
        data?.sqlServerInstances?.[0]?.storage.map((storageObj: any) => {
            if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                fsxType = true;
            }
            if (storageObj.type === DETECT_HOST_VAR.EBS) {
                ebsType = true;
            }
        });
    }
    const hostType = fsxType ? GENERAL.FSX_FOR_ONTAP : ebsType ? GENERAL.EBS : GENERAL.NOT_AVAILABLE;
    const deploymentType = data?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
    const hostName = data?.sqlServerInstances?.[0]?.sqlServerName || GENERAL.NOT_AVAILABLE;

    const type =
        deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
            ? GENERAL.FCI
            : deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
            ? GENERAL.STANDALONE
            : GENERAL.NOT_AVAILABLE;

    return (
        <div className={styles.secondDialog}>
            <Typography variant="Semibold_14">{GENERAL.DETECTED_HOST_INFO}</Typography>

            <div className={styles.contentSection}>
                <div className={styles.leftSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            {GENERAL.DETECT_HOSTNAME}
                        </Typography>
                        <Typography variant="Semibold_14">{hostName}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            {GENERAL.DETECT_HOST_TYPE}
                        </Typography>
                        <Typography variant="Semibold_14">{hostType}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '48px' }}>
                        <Typography variant="Regular_14" style={{ width: '148px' }}>
                            {GENERAL.DETECT_NO_OF_DB}
                        </Typography>
                        <Typography variant="Semibold_14">
                            {apiResult?.noOfDatabases || GENERAL.NOT_AVAILABLE}
                        </Typography>
                    </div>

                    <div className={styles.separator} />
                </div>

                <div className={styles.rightSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_SQL_VERSION}
                        </Typography>
                        <Typography variant="Semibold_14">
                            {data?.sqlServerInstances?.[0]?.sqlServerVersion || GENERAL.NOT_AVAILABLE}
                        </Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_DEPLOYMENT_MODEL}
                        </Typography>
                        <Typography variant="Semibold_14">{type}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_EDITION}
                        </Typography>
                        <Typography variant="Semibold_14">{apiResult?.edition || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>
            </div>

            {/* Second section after content - EBS */}
            {hostType !== GENERAL.FSX_FOR_ONTAP && (
                <div className={styles.ebsSection}>
                    <div className={styles.successMsg}>
                        <Typography variant="Regular_14">{GENERAL.EBS_DETECT_SUCCESS_MSG[0]}</Typography>&nbsp;
                        <Typography variant="Semibold_14">{hostName}</Typography>&nbsp;
                        <Typography variant="Regular_14">{GENERAL.EBS_DETECT_SUCCESS_MSG[1]}</Typography>
                    </div>
                    <div className={styles.successMsg}>
                        <Typography variant="Regular_14">{GENERAL.EBS_DETECT_SUCCESS_MSG[2]}</Typography>&nbsp;
                        <Typography variant="Semibold_14">{GENERAL.EBS_DETECT_SUCCESS_MSG[3]}</Typography>&nbsp;
                        <Typography variant="Regular_14">{GENERAL.EBS_DETECT_SUCCESS_MSG[4]}</Typography>
                    </div>
                </div>
            )}

            {/* Second section after content - FSX */}
            {hostType === GENERAL.FSX_FOR_ONTAP && (
                <div className={styles.fsxSection}>
                    <Typography variant="Semibold_14">{GENERAL.FSX_DETECT_SUCCESS_MSG[0]}</Typography>
                    <Typography variant="Regular_14" className={styles.subHeading}>
                        {GENERAL.FSX_DETECT_SUCCESS_MSG[1]}
                    </Typography>

                    <div className={styles.radioSection}>
                        <DsRadioButton
                            isSelected={detectHostRadio === DETECT_HOST_VAR.MOVE_TO_MANAGE}
                            title={GENERAL.FSX_AFTER_DETECT_OPTIONS[0]}
                            id="1"
                            variant="Default"
                            onClick={() => handleRadio(DETECT_HOST_VAR.MOVE_TO_MANAGE)}
                            isDisabled={true}
                        />
                        <DsRadioButton
                            isSelected={detectHostRadio === DETECT_HOST_VAR.MOVE_TO_UNMANAGE}
                            title={GENERAL.FSX_AFTER_DETECT_OPTIONS[1]}
                            id="2"
                            variant="Default"
                            onClick={() => handleRadio(DETECT_HOST_VAR.MOVE_TO_UNMANAGE)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default UndetectedSecondDialog;
