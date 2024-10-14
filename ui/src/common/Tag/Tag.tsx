import styles from './Tag.module.scss';

const Tag = ({ text }: any) => {
    return <div className={styles.tag}>{text}</div>;
};

export default Tag;
