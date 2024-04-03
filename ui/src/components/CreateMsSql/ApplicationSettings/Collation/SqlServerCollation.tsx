import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import styles from './SqlServerCollation.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { setSqlServerCollation } from '../../../../store/mssql/mssqlFormSlice';

const SqlServerCollation = () => {
    const dispatch = useDispatch();

    const sqlServerCollation = useAppSelector(state => state.mssqlForm.sqlServerCollation);

    const { collationList, collationListLoading } = useAppSelector(state => state.mssql.getCollationList);

    const generateCollationValues = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        collationList?.collationList?.map((val: any, idx: number) => {
            const option = generateOptionType(val?.name, val?.name, val?.description, false, '');
            if (val?.name === collationList?.defaultCollation) {
                dispatch(setSqlServerCollation(option));
            }
            options.push(option);
        });
        return options;
    }, [collationList]);

    const setHeader = () => {
        if (!sqlServerCollation?.label) {
            return <ActionRequired />;
        }
        return <DsTypography variant="Regular_14">{sqlServerCollation?.label}</DsTypography>;
    };
    return (
        <div className={styles.sqlServerCollation}>
            <AccordionCard
                isLoading={collationListLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="25"
                title={<div className={CommonStyles.title}>{GENERAL.SQL_SERVER_COLLATION}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.collationField}>
                            <SelectField
                                isLoading={collationListLoading}
                                label={GENERAL.SQL_SERVER_COLLATION}
                                isClearable={false}
                                placeholder={GENERAL.SELECT_COLLATION}
                                defaultValue={sqlServerCollation ? [sqlServerCollation] : [generateCollationValues[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSqlServerCollation(selectedOptions));
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

export default SqlServerCollation;
