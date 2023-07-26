import { useAppSelector } from "./store/storeHooks";
import "./App.css";
import Home from "./Home";
import { useInitialize } from "./utils/appConfig";
import { Spinner } from '@netapp/design-system'; 
import { AUTH_STATUS } from './utils/consts';

function App() {
  const { status } = useAppSelector((state) => state.auth);

  useInitialize();
  
  return (
    <>
      {status === AUTH_STATUS.AUTH_STATUS_PROGRESS && (
        <div className="App">
          <Spinner isLarge />
        </div>
      )}
      {status === AUTH_STATUS.AUTH_STATUS_SUCCESS && (
        <div className="App">
          <Home />
        </div>
      )}
    </>
  );
}

export default App;
