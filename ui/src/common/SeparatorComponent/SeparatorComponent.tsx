import styles from './SeparatorComponent.module.scss';

type SeparatorComponentProps = {
    variant?: string;
    height?: string;
};

const SeparatorComponent = ({ variant, height }: SeparatorComponentProps) => {
    return (
        <div className={styles.separatorComponent}>
            {variant === 'vertical' ? (
                <div style={{ height: height, borderRight: '1px solid var(--border)' }} />
            ) : (
                <div style={{ height: height, borderTop: '1px solid var(--border)' }} />
            )}
        </div>
    );
};

export default SeparatorComponent;
