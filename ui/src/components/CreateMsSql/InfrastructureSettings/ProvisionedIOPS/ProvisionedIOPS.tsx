import {
    AccordionCard,
    AccordionCardContent,
    Popover,
    RadioButton,
    TextField,
    Typography
} from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './ProvisionedIOPS.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

import AccordionError from '../../../../common/AccordionError/AccordionError';
import { useDispatch } from 'react-redux';
import { setProvisionedIOPSValue, setProvisionedType } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { selectFsxIops } from '../../MSSqlServer/MSSqlUtils';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const ProvisionedIOPS = () => {
    const dispatch = useDispatch();

    const provisionValue = useAppSelector(state => state.mssqlForm.provisionedIOPS.provisionedType);
    const iopsValue = useAppSelector(state => state.mssqlForm.provisionedIOPS.IOPSValue);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);

    const [isDisable, setIsDisable] = useState(false);

    useEffect(() => {
        if (selectedFsxnType === GENERAL.SELECT_EXISTING_FSX && selectedExistingFsxnName) {
            setIsDisable(true);
        } else {
            setIsDisable(false);
        }
        selectFsxIops(selectedFsxnType, selectedExistingFsxnName, dispatch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFsxnType, selectedExistingFsxnName]);

    //Set the Header text here
    const setHeader = () => {
        if (checkError()) {
            return <AccordionError />;
        }
        if (isDisable) {
            return (
                <Popover
                    popoverClass={styles['popover']}
                    children={GENERAL.IOPS_DISABLE_TEXT}
                    trigger="hover"
                    container={
                        <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                            {provisionValue === GENERAL.AUTOMATIC ? GENERAL.AUTOMATIC : iopsValue}
                        </Typography>
                    }
                />
            );
        } else {
            return (
                <Typography variant="Regular_14">
                    {provisionValue === GENERAL.AUTOMATIC ? GENERAL.AUTOMATIC : iopsValue}
                </Typography>
            );
        }
    };

    const checkError = () => {
        if (
            provisionValue === GENERAL.USER_PROVISIONED &&
            iopsValue.length &&
            (Number(iopsValue) < 3072 || Number(iopsValue) > 160000)
        ) {
            return 'range should be between 3072 - 160000 IOPS';
        }
    };
    return (
        <div className={styles.provisioned}>
            <AccordionCard
                isDisabled={isDisable}
                isExpandDisabled={isDisable}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="17"
                title={<div className={CommonStyles.title}>{GENERAL.PROVISIONED_IOPS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleRadios}>
                            <RadioButton
                                isChecked={provisionValue === GENERAL.AUTOMATIC}
                                onChange={() => {
                                    dispatch(setProvisionedType(GENERAL.AUTOMATIC));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.AUTOMATIC}
                                className=""
                            />
                            <RadioButton
                                isChecked={provisionValue === GENERAL.USER_PROVISIONED}
                                onChange={() => {
                                    dispatch(setProvisionedType(GENERAL.USER_PROVISIONED));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.USER_PROVISIONED}
                                className=""
                            />
                        </div>

                        {provisionValue === GENERAL.AUTOMATIC && (
                            <div className={styles.automatic}>{GENERAL.AUTOMATIC_IOPS}</div>
                        )}
                        {provisionValue === GENERAL.USER_PROVISIONED && (
                            <div className={styles.user}>
                                <TextField
                                    placeholder={GENERAL.PLACEHOLDER_PROVISIONED}
                                    label={GENERAL.IOPS_VALUE}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setProvisionedIOPSValue(e.target.value));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    value={iopsValue}
                                    className={styles.textfield}
                                    //@ts-ignore
                                    type="number"
                                    error={checkError()}
                                />
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ProvisionedIOPS;
