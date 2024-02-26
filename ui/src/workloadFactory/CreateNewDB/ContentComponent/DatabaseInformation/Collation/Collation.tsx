import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';

import styles from './Collation.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';
import { useEffect, useMemo } from 'react';
import { generateOptionType } from '../../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../../store/storeHooks';
import { setSelectedCollation } from '../../../../../store/workloadFactory/createNewDBSlice';

const Collation = () => {
    const dispatch = useDispatch();

    const { selectedCollation } = useAppSelector(state => state.createNewUser);

    const generateCollationValues = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const collationValues = ['SQL_Latin1', 'SQL_Latin2'];
        collationValues?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        dispatch(setSelectedCollation(generateCollationValues[0]));
    }, [generateCollationValues]);

    const setHeader = () => {
        return <DsTypography variant="Regular_14">{`Default: ${selectedCollation?.label}`}</DsTypography>;
    };
    return (
        <div className={styles.collation}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="5"
                title={<div className={CommonStyles.title}>{GENERAL.COLLATION}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.collationField}>
                            <SelectField
                                label={'Collation'}
                                isClearable={false}
                                defaultValue={selectedCollation ? [selectedCollation] : [generateCollationValues[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedCollation(selectedOptions));
                                }}
                                isSearchable={generateCollationValues.length > 5}
                                options={generateCollationValues}
                                className={styles.selectField}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Collation;
