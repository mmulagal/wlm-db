import { AccordionCard, AccordionCardContent, DsRadioButton, DsTypography, TextField } from '@netapp/design-system';
import styles from './Mount.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setMountPath, setSelectedMount } from '../../../../../store/workloadFactory/createSandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

const Mount = () => {
    const { selectedMount, mountPath } = useAppSelector(state => state.createSandbox);
    const dispatch = useDispatch();
    const setHeader = () => {
        if (selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT) {
            return <DsTypography variant="Regular_14">{GENERAL.AUTO_ASSIGN_MOUNT_POINT}</DsTypography>;
        } else if (selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH && !mountPath) {
            return (
                <div className={styles.actionRequired}>
                    <ActionRequired />
                </div>
            );
        }
        return (
            <DsTypography variant="Regular_14" className={CommonStyles.setHeaderStyleSandbox} title={mountPath}>
                {GENERAL.VOLUME_MOUNT_POINT_UNDER_PATH} : {mountPath}
            </DsTypography>
        );
    };

    const handleRadio = (val: string) => {
        dispatch(setSelectedMount(val));
    };
    return (
        <div className={styles.Mount}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="3"
                title={<div className={CommonStyles.title}>{'Mount'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.radios}>
                            <DsRadioButton
                                isSelected={selectedMount === GENERAL.AUTO_ASSIGN_MOUNT_POINT}
                                title={GENERAL.AUTO_ASSIGN_MOUNT_POINT}
                                id="1"
                                variant="Default"
                                onClick={() => handleRadio(GENERAL.AUTO_ASSIGN_MOUNT_POINT)}
                            />

                            <DsRadioButton
                                isSelected={selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH}
                                title={GENERAL.DEFINE_MOUNT_POINT_PATH}
                                id="2"
                                variant="Default"
                                onClick={() => handleRadio(GENERAL.DEFINE_MOUNT_POINT_PATH)}
                                isDisabled={true}
                            />
                        </div>
                        <div className={styles.textField}>
                            <TextField
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setMountPath(e.target.value));
                                }}
                                placeholder={GENERAL.DEFINE_MOUNT_POINT_PATH}
                                value={mountPath}
                                className={styles.keyField}
                                isDisabled={selectedMount == GENERAL.AUTO_ASSIGN_MOUNT_POINT}
                                error={
                                    selectedMount === GENERAL.DEFINE_MOUNT_POINT_PATH && !mountPath
                                        ? GENERAL.ACTION_REQUIRED
                                        : ''
                                }
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Mount;
