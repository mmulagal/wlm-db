import { useAppSelector } from "./store/storeHooks";
import "./App.css";
import Home from "./Home";
import { useInitialize } from "./utils/appConfig";
import { Spinner } from '@netapp/design-system'; 
import { AUTH_STATUS } from './utils/consts';
import ErrorPage from "./common/ErrorPage/ErrorPage";

function App() {
  const { status, error } = useAppSelector((state) => state.auth);
  const { accountId } = useAppSelector(state => state.appContext);

  useInitialize();
  
  return (
    <>
      {status === AUTH_STATUS.AUTH_STATUS_PROGRESS && (
        <div className="App">
          <Spinner isLarge />
        </div>
      )}
      {status === AUTH_STATUS.AUTH_STATUS_SUCCESS && 
        (accountId ? (<Home/>) : 
        (<ErrorPage message={'Account Id required'} />))
      }
      {status === AUTH_STATUS.AUTH_STATUS_ERROR && 
        (<ErrorPage message={error} />)
      }
    </>
  );
}

export default App;
