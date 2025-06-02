import { useEffect, useState } from "react";

export const useSearchDebounce = (delay = 500) => {
    const [search, setSearch] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState<any>(null);
  
    useEffect(() => {
        const delayFn = setTimeout(() => setSearch(searchQuery), delay);
        return () => clearTimeout(delayFn);
    }, [searchQuery, delay])
  
    return [search, setSearchQuery];
}