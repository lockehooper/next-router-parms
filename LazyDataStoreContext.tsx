"use client";
import { useContext, createContext, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
	DocumentNode,
	NoInfer,
	OperationVariables,
	QueryHookOptions,
	TypedDocumentNode,
	useQuery,
} from "@apollo/client";

interface ILazyDataStoreContext {
	getStoredValue: <T extends Object = Object>(key: string, fetch?: () => T, fallback?: () => void) => T | undefined;
	setStoredValue: (key: string, value: Object) => void;
	deleteStoredValue: (key: string) => void;
}

const LazyDataStore = createContext<ILazyDataStoreContext>({
	getStoredValue: () => undefined,
	setStoredValue: () => undefined,
	deleteStoredValue: () => undefined,
});

export const useLazyDataStore = () => {
	return useContext(LazyDataStore);
};

/**
 * Either find the stored value or redirect to a fallback route (useful for bookmark we DO want to respect)
 *
 * @param key Key to fetch from the lazy data store
 * @param query The fallback query we will execute if the value is not stored
 * @param queryExtractionKey The key to extract from the Apollo query result
 * @param options
 * @returns
 */
export const useStoredOrApolloFetch = <
	T extends Object = Object,
	TVariables extends OperationVariables = OperationVariables,
>(
	key: string,
	query: DocumentNode | TypedDocumentNode<{ [queryExtractionKey: string]: T }, TVariables>,
	queryExtractionKey: string,
	options?: QueryHookOptions<NoInfer<{ [queryExtractionKey: string]: T }>, NoInfer<TVariables>>,
): T | undefined => {
	const { getStoredValue } = useLazyDataStore();
	const [shouldFetch, setShouldFetch] = useState(false);
	const { data } = useQuery<{ [queryExtractionKey: string]: T }, TVariables>(query, {
		...options,
		skip: !shouldFetch,
	});

	return useMemo(
		() => getStoredValue<T>(key, data ? () => data[queryExtractionKey] : undefined, () => setShouldFetch(true)),
		[data],
	); // inject our token fetching for the lazy function call
};

/**
 * Either find the stored value or redirect to a fallback route (useful for bookmark we dont want to respect)
 *
 * @param key Key to fetch from the lazy data store
 * @param url The fallback url
 * @param options
 * @returns
 */
export const useStoredOrRoute = <T extends Object = Object>(key: string, url: string): T | undefined => {
	const router = useRouter();
	const { getStoredValue } = useLazyDataStore();
	const [shouldRoute, setShouldRoute] = useState(false);

	useEffect(() => {
		if (shouldRoute) {
			router.push(url);
		}
	}, [shouldRoute]);

	return useMemo(() => getStoredValue<T>(key, undefined, () => setShouldRoute(true)), [key]); // inject our token fetching for the lazy function call
};

export const LazyDataStoreProvider = ({ children }: { children?: React.ReactNode }) => {
	const internalMap = new Map<string, Object>();

	const contextValue = useMemo(() => {
		return {
			getStoredValue: <T extends Object = Object>(
				key: string,
				fetch?: () => T,
				fallback?: () => void,
			): T | undefined => {
				const foundValue = internalMap.get(key);
				if (foundValue) {
					return foundValue as T;
				}
				if (fetch) {
					const fetchedValue = fetch();
					internalMap.set(key, fetchedValue);
					return fetchedValue;
				}
				if (fallback) {
					fallback();
				}
				return undefined;
			},
			setStoredValue: (key: string, value: Object) => {
				internalMap.set(key, value);
			},
			deleteStoredValue: (key: string) => {
				internalMap.delete(key);
			},
		};
	}, []);

	return <LazyDataStore.Provider value={contextValue}>{children}</LazyDataStore.Provider>;
};

export default LazyDataStoreProvider;
