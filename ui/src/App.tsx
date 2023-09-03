import { useAppSelector } from "./store/storeHooks";
import "./App.css";
import Home from "./Home";
import { Spinner, useBlueXP } from '@netapp/design-system'; 
import { AUTH_STATUS } from './utils/consts';
import ErrorPage from "./common/ErrorPage/ErrorPage";
import { useDispatch } from "react-redux";
import { updateAuthSuccess, updateResourceId, updateResourceName } from "./store/authSlice";
import { setAccountId } from "./store/appContextSlice";
import { useNavigate } from "react-router-dom";

function App() {
  const { status, error } = useAppSelector((state) => state.auth);
  const { accountId } = useAppSelector(state => state.appContext);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  
  useBlueXP({
    onReady: (initialData: any) => {
        console.log("Initial Data",initialData);
        const {accessToken, accountId } = initialData;
        dispatch(updateAuthSuccess({accessToken: accessToken}));
        dispatch(setAccountId(accountId));
        if(initialData?.pathname && initialData.pathname.split('/')[1] === 'database-services'){
          const storage = initialData?.storage;
          const storageId = initialData?.storageId;
          const storageName = initialData?.storageName;
          navigate(`${storage}/${storageId}/${storageName}`);
          dispatch(updateResourceId(storageId))
          dispatch(updateResourceName(storageName))
      } else {
          navigate(`${initialData?.pathname}`, { replace: true });
      }
    },
    onConnectorChange: function (connectorId: string): void {
        throw new Error('Function not implemented.');
    },
    onWorkspaceChange: function (workspaceId: string): void {
        throw new Error('Function not implemented.');
    },
    onTokenUpdate: function (accessToken: string, userMetadata: any): void {
        throw new Error('Function not implemented.');
    },
    onNssAdded: function (): void {
        throw new Error('Function not implemented.');
    },
    onNssAddingFailed: function (): void {
        throw new Error('Function not implemented.');
    },
    onLocationChange: function (pathname: string, hash: string, search: string): void {
        throw new Error('Function not implemented.');
    }
  });
  
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
