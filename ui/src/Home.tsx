import { Routes, Route, useLocation } from "react-router-dom";
import styles from "./Home.module.scss";

const Home = () => {
  return (
    <div className={styles["app-layout"]}>
      <Routes>
        <Route path={`/`} element={<div>Initial Page</div>} />
      </Routes>
    </div>
  );
};

export default Home;
