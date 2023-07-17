import { AsyncLocalStorage } from "async_hooks";

const LOCAL_STORAGE = new AsyncLocalStorage<Map<string, any>>();

export function setAsyncLocalStorageResource(key: string, value: any) {
  return LOCAL_STORAGE.getStore()?.set(key, value);
}

export function getAsyncLocalStorageResource<T>(key: string) {
  return LOCAL_STORAGE.getStore()?.get(key) as T;
}

export function getLocalStorage() {
  return LOCAL_STORAGE;
}
