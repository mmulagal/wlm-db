import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './KepPair.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedKeyPair } from '../../../../store/mssql/mssqlFormSlice';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';

const KeyPair = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const { keyPairData, keyPairLoading } = useAppSelector(state => state.mssql.getKeyPairList);

    const selectedKey = useAppSelector((state: any) => state.mssqlForm.keyPair.selectedKeyPair);

    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    //Function to generate the options for Select Field
    const generateKey = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        keyPairData?.keyPairs?.map((val, idx: number) => {
            const keyPairName = val?.name || '';
            const option = generateOptionType(keyPairName, keyPairName, '', false, '', val);
            options.push(option);
        });

        return options;
    }, [keyPairData]);

    useEffect(() => {
        if ((!isLoadConfig && !movingFromChatbot) || !selectedKey) {
            dispatch(setSelectedKeyPair(generateKey[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateKey]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (!selectedKey?.label) {
            return <ActionRequired />;
        }
        return <Typography variant="Regular_14">{selectedKey?.label}</Typography>;
    };

    return (
        <div className={styles.key}>
            <AccordionCard
                isLoading={keyPairLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="12"
                title={<div className={CommonStyles.title}>{GENERAL.KEY_PAIR}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14">{GENERAL.KEY_PAIR_TEXT}</Typography>
                        <div className={styles.selectField}>
                            <SelectField
                                label={GENERAL.KEY_PAIR_NAME}
                                isClearable={false}
                                defaultValue={selectedKey ? [selectedKey] : [generateKey[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedKeyPair(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateKey.length > 5}
                                options={generateKey}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default KeyPair;
