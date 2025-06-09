import {
    AccordionCard,
    AccordionCardContent,
    Popover,
    RadioButton,
    TextField,
    Typography
} from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './ProvisionedIOPS.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

import AccordionError from '../../../../common/AccordionError/AccordionError';
import { setProvisionedIOPSValue, setProvisionedType } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { selectFsxIops } from '../../MSSqlServer/MSSqlUtils';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { isFsxnExisting, isFsxnNew } from '../../../../utils/utilityFunctions';
import { MAX_IOPS_VALUE } from '../../../../utils/consts';

const ProvisionedIOPS = () => {
    const dispatch = useDispatch();

    const provisionValue = useAppSelector(state => state.mssqlForm.provisionedIOPS.provisionedType);
    const { getEstimatedCostData, getEstimatedCostLoading } = useAppSelector(state => state.mssql);
    const iopsValue = useAppSelector(state => state.mssqlForm.provisionedIOPS.IOPSValue);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);
    const [placeHolderText, setPlaceHolderText] = useState('range should be between 3072 - 160000 IOPS');
    const [total, setTotal] = useState<any>(3072);

    const [isDisable, setIsDisable] = useState(false);

    useEffect(() => {
        const sizeData = getEstimatedCostData?.data?.fsxnStorage?.fsxnCostBreakdownById?.[0]?.size;
        if (isFsxnNew(selectedFsxnType) && sizeData) {
            setPlaceHolderText(`range should be between ${sizeData?.total * 3} - ${MAX_IOPS_VALUE} IOPS`);
            setTotal(sizeData?.total * 3);
        } else {
            setPlaceHolderText(`range should be between 3072 - ${MAX_IOPS_VALUE} IOPS`);
        }
    }, [selectedFsxnType, getEstimatedCostData]);

    useEffect(() => {
        if (isFsxnExisting(selectedFsxnType) && selectedExistingFsxnName) {
            setIsDisable(true);
        } else {
            setIsDisable(false);
        }
        if (!isLoadConfig && !movingFromChatbot) {
            selectFsxIops(selectedFsxnType, selectedExistingFsxnName, dispatch);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFsxnType, selectedExistingFsxnName]);

    // Set the Header text here
    const setHeader = () => {
        if (checkError()) {
            return <AccordionError />;
        }
        if (isDisable) {
            return (
                <Popover
                    popoverClass={styles.popover}
                    children={GENERAL.IOPS_DISABLE_TEXT}
                    trigger="hover"
                    container={
                        <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                            {provisionValue === GENERAL.AUTOMATIC ? GENERAL.AUTOMATIC : iopsValue}
                        </Typography>
                    }
                />
            );
        }
        return (
            <Typography variant="Regular_14">
                {provisionValue === GENERAL.AUTOMATIC ? GENERAL.AUTOMATIC : iopsValue}
            </Typography>
        );
    };

    const checkError = () => {
        if (
            !isFsxnNew(selectedFsxnType) &&
            provisionValue === GENERAL.USER_PROVISIONED &&
            iopsValue.length &&
            (Number(iopsValue) < 3072 || Number(iopsValue) > MAX_IOPS_VALUE)
        ) {
            return `range should be between 3072 - ${MAX_IOPS_VALUE} IOPS`;
        }
        if (
            isFsxnNew(selectedFsxnType) &&
            provisionValue === GENERAL.USER_PROVISIONED &&
            iopsValue.length &&
            (Number(iopsValue) < total || Number(iopsValue) > MAX_IOPS_VALUE)
        ) {
            return `range should be between ${total} - ${MAX_IOPS_VALUE} IOPS`;
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
                                    placeholder={placeHolderText}
                                    label={GENERAL.IOPS_VALUE}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setProvisionedIOPSValue(e.target.value));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    value={iopsValue}
                                    className={styles.textfield}
                                    // @ts-ignore
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
