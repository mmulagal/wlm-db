import { useEffect, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    RadioButton,
    TextField,
    Typography,
    Popover
} from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './Encryption.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import EncryptionTable from './EncryptionTable/EncryptionTable/EncryptionTable';
import { useDispatch } from 'react-redux';
import { setEncryptionARN, setEncryptionRow, setEncryptionType } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { selectFsxKmsKey } from '../../MSSqlServer/MSSqlUtils';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { isFsxnExisting } from '../../../../utils/utilityFunctions';

const Encryption = () => {
    const dispatch = useDispatch();

    const { kmsData, kmsLoading } = useAppSelector(state => state.mssql.getKmsList);
    const selectedRow = useAppSelector((state: any) => state.mssqlForm.encryption.selectedRow);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const accountSelected = useAppSelector((state: any) => state.mssqlForm.encryption.encryptionType);
    const anotherAccArn = useAppSelector((state: any) => state.mssqlForm.encryption.encryptionArn);

    const [isDisable, setIsDisable] = useState(false);

    // To select aws/fsx row if present
    useEffect(() => {
        if ((!isLoadConfig && !movingFromChatbot) || !selectedRow) {
            dispatch(setEncryptionRow(kmsData?.filter(key => key?.default)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kmsData]);

    useEffect(() => {
        if (isFsxnExisting(selectedFsxnType) && selectedExistingFsxnName) {
            setIsDisable(true);
        } else {
            setIsDisable(false);
        }
        selectFsxKmsKey(selectedFsxnType, selectedExistingFsxnName, dispatch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFsxnType, selectedExistingFsxnName]);

    //Set the Header text here
    const setHeader = () => {
        if (isDisable) {
            return (
                <Popover
                    popoverClass={styles['popover']}
                    children={GENERAL.KMS_DISABLE_TEXT}
                    trigger="hover"
                    container={
                        <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                            {anotherAccArn}
                        </Typography>
                    }
                />
            );
        } else {
            if (accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT) {
                return <Typography variant="Regular_14">{anotherAccArn}</Typography>;
            } else {
                return <Typography variant="Regular_14">{selectedRow && selectedRow[0]?.name}</Typography>;
            }
        }
    };
    return (
        <div className={styles.encryption}>
            <AccordionCard
                isDisabled={isDisable}
                isExpandDisabled={isDisable}
                isLoading={kmsLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="19"
                title={<div className={CommonStyles.title}>{GENERAL.ENCRYPTION}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        {accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT && (
                            <Typography variant="Regular_14" className={styles.subText}>
                                {GENERAL.ENCRYPTION_TEXT}
                            </Typography>
                        )}

                        {accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT && (
                            <Typography variant="Regular_14" className={styles.subText}>
                                {GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT_SUB_TEXT}
                            </Typography>
                        )}

                        {/* Radio Buttons section */}
                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT}
                                onChange={() => {
                                    dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT}
                                className=""
                            />
                            <RadioButton
                                isChecked={accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT}
                                onChange={() => {
                                    dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT}
                                className=""
                            />
                        </div>

                        {accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT && <EncryptionTable />}

                        {/* Other accounts selected section */}
                        {accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT && (
                            <>
                                <Typography variant="Regular_14" className={styles.otherAccount}>
                                    {GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT_TEXT}
                                </Typography>
                                <TextField
                                    label={GENERAL.ENCRYPTION_TEXT_FIELD}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        dispatch(setEncryptionARN(e.target.value));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    value={anotherAccArn}
                                    className={styles.textField}
                                />
                            </>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Encryption;
