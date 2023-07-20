import SelectConfig from "../SelectConfig/SelectConfig";
import styles from "./Header.module.scss";

const Header = () => {
  return (
    <div className={styles.header}>
      <div className={styles.container}></div>

      <div className={styles.content}>
        <SelectConfig />
      </div>
    </div>
  );
};

export default Header;
