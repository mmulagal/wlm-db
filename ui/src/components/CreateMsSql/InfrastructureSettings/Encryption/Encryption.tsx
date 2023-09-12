import { useEffect } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './Encryption.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import EncryptionTable from './EncryptionTable/EncryptionTable/EncryptionTable';
import { useDispatch } from 'react-redux';
import { setEncryptionARN, setEncryptionRow, setEncryptionType } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';

const Encryption = () => {
    const dispatch = useDispatch();

    const { kmsData, kmsLoading } = useAppSelector(state => state.mssql.getKmsList);
    const selectedRow = useAppSelector((state: any) => state.mssqlForm.encryption.selectedRow);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);

    const accountSelected = useAppSelector((state: any) => state.mssqlForm.encryption.encryptionType);
    const anotherAccArn = useAppSelector((state: any) => state.mssqlForm.encryption.encryptionArn);

    // To select aws/fsx row if present
    useEffect(() => {
        if(!isLoadConfig){
            dispatch(setEncryptionRow(kmsData?.filter(key => key?.default)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kmsData]);

    //Set the Header text here
    const setHeader = () => {
        if (accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT) {
            return <Typography variant="Regular_14">{anotherAccArn}</Typography>;
        } else {
            return <Typography variant="Regular_14">{selectedRow && selectedRow[0]?.name}</Typography>;
        }
    };
    return (
        <div className={styles.encryption}>
            <AccordionCard
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
                                }}
                                children={GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT}
                                className=""
                            />
                            <RadioButton
                                isChecked={accountSelected === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT}
                                onChange={() => {
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
                                        dispatch(setEncryptionARN(e.target.value));
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
