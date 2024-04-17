import { AccordionCard, AccordionCardContent, DsTypography } from '@netapp/design-system';
import styles from './DefineTag.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedTag } from '../../../../../store/workloadFactory/createSandboxSlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { GENERAL } from '../../../../../utils/appConstants';

const DefineTag = () => {
    const dispatch = useDispatch();
    const { selectedTag } = useAppSelector(state => state.createSandbox);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const setHeader = () => {
        return <DsTypography variant="Regular_14">{selectedTag}</DsTypography>;
    };
    const tagNames = ['Development', 'QA', 'Integration', 'Training', 'Analytics', 'Other'];

    const handleClick = (tag: string) => {
        dispatch(setSelectedTag(tag));
    };

    const setClass = (tag: string) => {
        if (isDarkTheme) {
            if (tag !== selectedTag) {
                return `${styles.tag}  ${styles.darkTheme}`;
            }
            return `${styles.tag} ${styles.selectedTag}`;
        } else {
            if (tag === selectedTag) {
                return `${styles.tag} ${styles.selectedTag}`;
            } else {
                return styles.tag;
            }
        }
    };
    return (
        <div className={styles.defineTag}>
            <AccordionCard
                ValueContent={() => (
                    <div className={`${CommonStyles['heading-content']} ${styles.headerSetter}`}>{setHeader()}</div>
                )}
                id="4"
                title={<div className={CommonStyles.title}>{GENERAL.DEFINE_TAG}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.container}>
                            {tagNames.map((tag: any) => (
                                <div key={tag} className={setClass(tag)} onClick={() => handleClick(tag)}>
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
