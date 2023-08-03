import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import styles from './ActiveDirectory.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setSelectedADDomainAddress,
    setSelectedADDomainName,
    setSelectedADPassword,
    setSelectedADUserName
} from '../../../store/mssql/mssqlFormSlice';

const delay = () => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('');
        }, 2000);
    });
};

const ActiveDirectory = () => {
    const dispatch = useDispatch();

    const { adsData, adsLoading } = useAppSelector(state => state.mssql.getAdsList);
    const selectedADDomainName = useAppSelector(state => state.mssqlForm.activeDirectory.domainName);
    const selectedADDomainAddress = useAppSelector(state => state.mssqlForm.activeDirectory.domainAddress);

    const isADNotFilled = useAppSelector(state => state.msSqlAction.activeDirectorySelected);

    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    const [versions, setVersions] = useState<{ domainName: string; dnsIpAddress: string }[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    const addNewOption = async (option: any) => {
        setIsCreating(true);
        const newVer = [...versions, { domainName: option, dnsIpAddress: '' }];
        setVersions(newVer);
        await delay();
        dispatch(setSelectedADDomainAddress(''));
        setIsCreating(false);

        return generateOptionType(option, option, '', false, '');
    };

    // Initial versions list
    useEffect(() => {
        const verList: any[] = [];
        adsData?.directories?.map((val: any, ids: number) => {
            const newItem = { domainName: val?.domainName, dnsIpAddress: val?.dnsIpAddress };
            verList.push(newItem);
        });
        setVersions(verList);
    }, [adsData]);

    //Function to generate the options for Select Field
    const generateActiveDirectories = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const verVal = val?.domainName;
            const data = {
                domainName: val?.domainName,
                dnsIpAddress: (val?.dnsIpAddress || '').toString()
            };
            const option = generateOptionType(verVal, verVal, '', false, '', data);
            options.push(option);
        });
        return options;
    }, [versions]);

    useEffect(() => {
        dispatch(setSelectedADDomainName(null));
        dispatch(setSelectedADDomainAddress(''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateActiveDirectories]);

    //Set the Header text here
    const setHeader = () => {
        if (!selectedADDomainName?.label || !selectedADDomainAddress || !userName || !password) {
            return <ActionRequired error={!isADNotFilled ? true : false} />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <div>{selectedADDomainName?.label}</div>
                    <div className={CommonStyles.separator} />
                    <div>{selectedADDomainAddress}</div>
                    <div className={CommonStyles.separator} />
                    <div>{userName}</div>
                </Typography>
            );
        }
    };
    return (
        <div className={styles.active}>
            <AccordionCard
                isLoading={adsLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="13"
                title={<div className={CommonStyles.title}>{GENERAL.ACTIVE_DIRECTORY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14" className={styles.adText}>
                            {GENERAL.AD_TEXT}
                        </Typography>
                        <div className={styles.firstContainer}>
                            <SelectField
                                label={GENERAL.DOMAIN_NAME}
                                isClearable={false}
                                isCreatingOption={isCreating}
                                isOptionsAddingEnabled
                                //@ts-ignore
                                onCreateOption={addNewOption}
                                defaultValue={selectedADDomainName ? selectedADDomainName : null}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedADDomainName(selectedOptions));
                                    dispatch(setSelectedADDomainAddress(selectedOptions?.data?.dnsIpAddress));
                                }}
                                placeholder="example.com"
                                isSearchable={true}
                                options={generateActiveDirectories}
                                className={styles.textField}
                            />

                            <TextField
                                label={GENERAL.DNS_ADDRESS}
                                placeholder="DNS IP addresses"
                                error={!isADNotFilled && !selectedADDomainAddress ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setSelectedADDomainAddress(e.target.value));
                                }}
                                value={selectedADDomainAddress ? selectedADDomainAddress : ''}
                                className={styles.textField}
                            />
                        </div>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
                                error={!isADNotFilled && !userName ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setUserName(e.target.value);
                                    dispatch(setSelectedADUserName(e.target.value));
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <PasswordField
                                label={GENERAL.PASSWORD}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setPassword(e.target.value);
                                    dispatch(setSelectedADPassword(e.target.value));
                                }}
                                error={!isADNotFilled && !password ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                value={password}
                                className={styles.textFieldPassword}
                                //@ts-ignore
                                type="password"
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ActiveDirectory;
