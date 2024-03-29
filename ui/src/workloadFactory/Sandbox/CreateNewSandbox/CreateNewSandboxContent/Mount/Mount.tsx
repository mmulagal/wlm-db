import { AccordionCard, AccordionCardContent, DsRadioButton, DsTypography, TextField } from '@netapp/design-system';
import styles from './Mount.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setMountPath, setSelectedMount } from '../../../../../store/workloadFactory/sandboxSlice';
import { GENERAL } from '../../../../../utils/appConstants';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

const Mount = () => {
    const { selectedMount, mountPath } = useAppSelector(state => state.sandbox);
    const dispatch = useDispatch();
    const setHeader = () => {
        if (selectedMount === 'Auto-assign mount point') {
            return <DsTypography variant="Regular_14">Auto-assign mount point</DsTypography>;
        } else if (selectedMount === 'Define mount point path' && !mountPath) {
            return (
                <div className={styles.actionRequired}>
                    <ActionRequired />
                </div>
            );
        }
        return <DsTypography variant="Regular_14">Volume mount point under path : {mountPath}</DsTypography>;
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
                                isSelected={selectedMount === 'Auto-assign mount point'}
                                title={'Auto-assign mount point'}
                                id="1"
                                variant="Default"
                                onClick={() => handleRadio('Auto-assign mount point')}
                            />

                            <DsRadioButton
                                isSelected={selectedMount === 'Define mount point path'}
                                title={'Define mount point path'}
                                id="2"
                                variant="Default"
                                onClick={() => handleRadio('Define mount point path')}
                            />
                        </div>
                        <div className={styles.textField}>
                            <TextField
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setMountPath(e.target.value));
                                }}
                                placeholder={'Define mount point path'}
                                value={mountPath}
                                className={styles.keyField}
                                isDisabled={selectedMount == 'Auto-assign mount point'}
                                error={!mountPath ? GENERAL.ACTION_REQUIRED : ''}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Mount;
