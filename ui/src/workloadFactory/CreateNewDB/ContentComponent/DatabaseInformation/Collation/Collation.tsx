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
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';

const Collation = () => {
    const dispatch = useDispatch();

    const { selectedCollation, collationList, collationListLoading } = useAppSelector(state => state.createNewUser);

    const generateCollationValues = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        collationList?.collationList?.map((val: any, idx: number) => {
            const option = generateOptionType(val?.name, val?.name, val?.description, false, '');
            if (val?.name === collationList?.defaultCollation) {
                dispatch(setSelectedCollation(option));
            }
            options.push(option);
        });
        return options;
    }, [collationList]);

    const setHeader = () => {
        if (!selectedCollation?.label) {
            return <ActionRequired />;
        }
        return <DsTypography variant="Regular_14">{`Default: ${selectedCollation?.label}`}</DsTypography>;
    };
    return (
        <div className={styles.collation}>
            <AccordionCard
                isLoading={collationListLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="5"
                title={<div className={CommonStyles.title}>{GENERAL.COLLATION}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.collationField}>
                            <SelectField
                                isLoading={collationListLoading}
                                label={GENERAL.COLLATION}
                                isClearable={false}
                                placeholder={GENERAL.SELECT_COLLATION}
                                defaultValue={selectedCollation ? [selectedCollation] : [generateCollationValues[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedCollation(selectedOptions));
                                }}
                                isSearchable={generateCollationValues.length > 5}
                                options={generateCollationValues}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default Collation;
