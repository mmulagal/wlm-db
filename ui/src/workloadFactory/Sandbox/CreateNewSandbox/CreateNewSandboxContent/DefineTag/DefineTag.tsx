import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';
import styles from './DefineTag.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedTag } from '../../../../../store/workloadFactory/sandboxSlice';
import { useAppSelector } from '../../../../../store/storeHooks';

const DefineTag = () => {
    const dispatch = useDispatch();
    const { selectedTag } = useAppSelector(state => state.sandbox);
    const setHeader = () => {
        return <DsTypography variant="Regular_14">{selectedTag}</DsTypography>;
    };
    const tagNames = ['Dev', 'QA', 'Integration', 'Training', 'Analytics', 'Other'];

    const handleClick = (tag: string) => {
        dispatch(setSelectedTag(tag));
    };
    return (
        <div className={styles.defineTag}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="4"
                title={<div className={CommonStyles.title}>{'Define tag'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.container}>
                            {tagNames.map((tag: any) => (
                                <div
                                    className={tag === selectedTag ? `${styles.tag} ${styles.selectedTag}` : styles.tag}
                                    onClick={() => handleClick(tag)}
                                >
                                    <DsTypography variant="Semibold_13" className={styles.tagColor}>
                                        {tag}
                                    </DsTypography>
                                </div>
                            ))}
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DefineTag;
