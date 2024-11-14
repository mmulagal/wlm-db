import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import styles from './PostgreVersion.module.scss';

import { useDispatch } from 'react-redux';

import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { setPostgreVersion } from '../../../store/postgre/postgreFormSlice';

const PostgreVersion = () => {
    const dispatch = useDispatch();

    const postGreVersion = useAppSelector(state => state.postgreForm.postgreVersion);

    const generateOSValues = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const osValues = [{label: 'postgresql16', value: 'postgresql16'}, {label:'postgresql15', value: 'postgresql15'}];
        osValues.map((val: any, idx: number) => {
            const option = generateOptionType(val?.value, val?.label, val?.label, false, '');
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        //@ts-ignore
        dispatch(setPostgreVersion(generateOSValues[0]));
    }, [generateOSValues]);

    const setHeader = () => {
        if (!postGreVersion?.label) {
            return <ActionRequired />;
        }
        return <DsTypography variant="Regular_14">{postGreVersion?.label}</DsTypography>;
    };

    return (
        <div className={styles.postgreVersion}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="26"
                title={<div className={CommonStyles.title}>{'PostgreSQL version'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.collationField}>
                            <SelectField
                                label={'PostgreSQL version'}
                                isClearable={false}
                                placeholder={GENERAL.SELECT_COLLATION}
                                defaultValue={postGreVersion ? [postGreVersion] : [generateOSValues[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setPostgreVersion(selectedOptions));
                                }}
                                isSearchable={generateOSValues.length > 5}
                                options={generateOSValues}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PostgreVersion;
