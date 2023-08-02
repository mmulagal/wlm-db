import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './KepPair.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedKeyPair } from '../../../store/mssql/mssqlFormSlice';

const KeyPair = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const { keyPairData, keyPairLoading } = useAppSelector(state => state.mssql.getKeyPairList);
    
    const selectedKey = useAppSelector((state: any) => state.mssqlForm.keyPair.selectedKeyPair);

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
        dispatch(setSelectedKeyPair(generateKey[0]));
    }, [dispatch, generateKey]);

    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{selectedKey?.label}</Typography>;
    };
    return (
        <div className={styles.key}>
            <AccordionCard isLoading={keyPairLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="12"
                title={<div className={CommonStyles.title}>{GENERAL.KEY_PAIR}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.selectField}>
                            <SelectField
                                label={GENERAL.KEY_PAIR_NAME}
                                isClearable={false}
                                defaultValue={selectedKey ? [selectedKey] : [generateKey[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedKeyPair(selectedOptions));
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
