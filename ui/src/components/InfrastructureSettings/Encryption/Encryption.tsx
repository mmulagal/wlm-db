import { useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './Encryption.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import EncryptionTable from './EncryptionTable/EncryptionTable/EncryptionTable';
import { useDispatch } from 'react-redux';
import { setEncryptionARN, setEncryptionType } from '../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../store/storeHooks';

const Encryption = () => {
    const [accountSelected, setAccountSelected] = useState(GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT);
    const dispatch = useDispatch();
    const selectedRow = useAppSelector((state: any) => state.mssqlForm.encryption.selectedRow);
    const [input, setInput] = useState('');
    //Set the Header text here
    const setHeader = () => {
        if (accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT && input.length > 0) {
            return <Typography variant="Regular_14">{input}</Typography>;
        } else {
            return <Typography variant="Regular_14">{selectedRow && selectedRow[0].key}</Typography>;
        }
    };
    return (
        <div className={styles.encryption}>
            <AccordionCard
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
                                    setAccountSelected(GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT);
                                    dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT));
                                }}
                                children={GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT}
                                className=""
                            />
                            <RadioButton
                                isChecked={accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT}
                                onChange={() => {
                                    setAccountSelected(GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT);
                                    dispatch(setEncryptionType(GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT));
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
                                        setInput(e.target.value);
                                        dispatch(setEncryptionARN(e.target.value));
                                    }}
                                    value={input}
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
