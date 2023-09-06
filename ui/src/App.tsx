import { useAppSelector } from "./store/storeHooks";
import "./App.css";
import Home from "./Home";
import { Spinner } from '@netapp/design-system'; 
import ErrorPage from "./common/ErrorPage/ErrorPage";
import { useInitialize } from "./utils/appConfig";

function App() {
  const { loading, accountId } = useAppSelector((state) => state.auth);

  useInitialize();
  
  return (
    <>
      {loading && (
        <div className="App">
          <Spinner isLarge />
        </div>
      )}
      {!loading && 
        (accountId ? (<Home/>) : 
        (<ErrorPage message={'Account Id required'} />))
      }
    </>
  );
}

export default App;
