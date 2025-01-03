import { DsRadioButton, Typography } from '@netapp/design-system';
import styles from './UndetectedSecondDialogV2.module.scss';
import { useDispatch } from 'react-redux';
import { setRadioValueDetect } from '../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { DETECT_HOST_VAR } from '../../../../utils/consts';
import { getDiscoveredHostDeploymentV2 } from '../../InventoryUtilsV2';

const UndetectedSecondDialogV2 = ({ data, apiResult }: { data: any; apiResult: any }) => {
    const detectHostRadio = useAppSelector(state => state.inventoryV2.detectHostRadio);
    const dispatch = useDispatch();
    const handleRadio = (val: string) => {
        dispatch(setRadioValueDetect(val));
    };

    let fsxType = false;
    let ebsType = false;
    let fsxwType = false;
    // To check is SQL server has FSx and EBS storage
    if (data?.storage && data?.storage.length > 0) {
        data?.storage?.map((storageObj: any) => {
            if (storageObj.type === DETECT_HOST_VAR.FSXN) {
                fsxType = true;
            }
            if (storageObj.type === DETECT_HOST_VAR.EBS) {
                ebsType = true;
            }
            if (storageObj.type === DETECT_HOST_VAR.FSXW) {
                fsxwType = true;
            }
        });
    };

    if (data?.storage?.fsxn) {
        fsxType = true;
    };

    const hostType = fsxType
        ? GENERAL.FSX_FOR_ONTAP
        : ebsType
        ? GENERAL.EBS
        : fsxwType
        ? GENERAL.FSX_FOR_WINDOWS
        : GENERAL.NOT_AVAILABLE;
    const instanceName = data?.databaseInstanceName || GENERAL.NOT_AVAILABLE;

    const type = getDiscoveredHostDeploymentV2(data);

    const noOfDatabases = data?.databaseCount || apiResult?.databaseCount || GENERAL.NOT_AVAILABLE;
    const edition = data?.sqlServerEdition || apiResult?.sqlServerEdition || GENERAL.NOT_AVAILABLE;

    return (
        <div className={styles.secondDialog}>
            <Typography variant="Semibold_14">{GENERAL.DETECTED_INSTANCE_INFO}</Typography>

            <div className={styles.contentSection}>
                <div className={styles.leftSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            {GENERAL.DETECT_INSTANCE_NAME}
                        </Typography>
                        <Typography variant="Semibold_14">{instanceName}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            {GENERAL.DETECT_STORAGE_TYPE}
                        </Typography>
                        <Typography variant="Semibold_14">{hostType}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '48px' }}>
                        <Typography variant="Regular_14" style={{ width: '148px' }}>
                            {GENERAL.DETECT_NO_OF_DB}
                        </Typography>
                        <Typography variant="Semibold_14">{noOfDatabases}</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>

                <div className={styles.rightSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '57px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_SQL_VERSION}
                        </Typography>
                        <Typography variant="Semibold_14">{data?.sqlServerVersion || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '57px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_DEPLOYMENT_MODEL}
                        </Typography>
                        <Typography variant="Semibold_14">{type || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '57px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            {GENERAL.DETECT_EDITION}
                        </Typography>
                        <Typography variant="Semibold_14">{edition}</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>
            </div>

            {/* Second section after content - EBS */}
            {hostType !== GENERAL.FSX_FOR_ONTAP && (
                <div className={styles.ebsSection}>
                    <div className={styles.successMsg}>
                        <Typography variant="Regular_14">{GENERAL.EBS_INSTANCE_DETECT_SUCCESS_MSG[0]}</Typography>&nbsp;
                        <Typography variant="Semibold_14">{instanceName}</Typography>&nbsp;
                        <Typography variant="Regular_14">{GENERAL.EBS_INSTANCE_DETECT_SUCCESS_MSG[1]}</Typography>
                    </div>
                </div>
            )}

            {/* Second section after content - FSX */}
            {hostType === GENERAL.FSX_FOR_ONTAP && (
                <div className={styles.fsxSection}>
                    <Typography variant="Semibold_14">{GENERAL.FSX_INSTANCE_DETECT_SUCCESS_MSG[0]}</Typography>
                    <Typography variant="Regular_14" className={styles.subHeading}>
                        {GENERAL.FSX_INSTANCE_DETECT_SUCCESS_MSG[1]}
                    </Typography>

                    <div className={styles.radioSection}>
                        <DsRadioButton
                            isSelected={detectHostRadio === DETECT_HOST_VAR.MOVE_TO_MANAGE}
                            title={GENERAL.FSX_INSTANCE_AFTER_DETECT_OPTIONS[0]}
                            id="1"
                            variant="Default"
                            onClick={() => handleRadio(DETECT_HOST_VAR.MOVE_TO_MANAGE)}
                        />
                        <DsRadioButton
                            isSelected={detectHostRadio === DETECT_HOST_VAR.MOVE_TO_UNMANAGE}
                            title={GENERAL.FSX_INSTANCE_AFTER_DETECT_OPTIONS[1]}
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

export default UndetectedSecondDialogV2;
