import { DsTypography } from '@netapp/design-system';
import styles from './Tag.module.scss';

const Tag = ({ text, style2 }: any) => {
    return (
        <>
            {style2 && <div className={styles.tag}>{text}</div>}
            {!style2 && (
                <DsTypography variant="Semibold_13" className={styles.tag}>
                    {text}
                </DsTypography>
            )}
        </>
    );
};

export default Tag;
