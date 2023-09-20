import React, {useEffect} from 'react';
import FullStory from "react-fullstory";

const FullStoryComp = () => {
    useEffect(() => {
            // We let fs know that we are running inside iframe
            //@ts-ignore
            window['_fs_run_in_iframe'] = true
    }, [])
    return <FullStory org={'1893S7'} namespace={'WLMDB_FULLSTORY'} />
}

export default FullStoryComp;