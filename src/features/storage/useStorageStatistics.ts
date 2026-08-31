import useSWR from "swr";
import { getStorageStatistics, type StorageStatistics } from "./storageService";

export function useStorageStatistics() {
  return useSWR<StorageStatistics>("storage-statistics", getStorageStatistics, {
    revalidateOnFocus: true,
  });
}
