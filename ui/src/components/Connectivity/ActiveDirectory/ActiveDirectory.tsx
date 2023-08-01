import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
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
    const selectedADDomainName = useAppSelector((state: any) => state.mssqlForm.activeDirectory.domainName);

    const [dnsAddress, setDNSAddress] = useState('');
    const [userName, setUserName] = useState('');
    const [password, setPassword] = useState('');

    const [versions, setVersions] = useState(['AD1', 'AD2', 'AD3']);
    const [isCreating, setIsCreating] = useState(false);

    const addNewOption = async (option: any) => {
        setIsCreating(true);
        const newVer = [...versions, option];
        setVersions(newVer);
        await delay();
        setIsCreating(false);

        return generateOptionType(option, option, '', false, '');
    };

    //Function to generate the options for Select Field
    const generateActiveDirectories = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        return options;
    }, [versions]);
    //Set the Header text here
    const setHeader = () => {
        if (!selectedADDomainName.label || !dnsAddress || !userName || !password) {
            return <ActionRequired />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    <div>{selectedADDomainName.label}</div>
                    <div className={CommonStyles.separator} />
                    <div>{dnsAddress}</div>
                    <div className={CommonStyles.separator} />
                    <div>{userName}</div>
                </Typography>
            );
        }
    };
    return (
        <div className={styles.active}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="13"
                title={<div className={CommonStyles.title}>{GENERAL.ACTIVE_DIRECTORY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14">{GENERAL.AD_TEXT}</Typography>
                        <div className={styles.firstContainer}>
                            <SelectField
                                label={GENERAL.DOMAIN_NAME}
                                isClearable={false}
                                isCreatingOption={isCreating}
                                isOptionsAddingEnabled
                                //@ts-ignore
                                onCreateOption={addNewOption}
                                value={selectedADDomainName ? selectedADDomainName : null}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedADDomainName(selectedOptions));
                                }}
                                placeholder="example.com"
                                isSearchable={true}
                                options={generateActiveDirectories}
                                className={styles.textField}
                            />

                            <TextField
                                label={GENERAL.DNS_ADDRESS}
                                placeholder="example.com"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDNSAddress(e.target.value);
                                    dispatch(setSelectedADDomainAddress(e.target.value));
                                }}
                                value={dnsAddress}
                                className={styles.textField}
                            />
                        </div>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
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
