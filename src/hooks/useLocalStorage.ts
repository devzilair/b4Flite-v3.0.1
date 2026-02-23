
import { useState, useCallback, useEffect, useRef } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Use a ref to store the initial value. This removes it from the dependency array of readValue,
  // preventing infinite loops when consumers pass inline objects/arrays (e.g. useLocalStorage('key', [])).
  const initialValueRef = useRef(initialValue);

  // Update the ref if the passed initialValue changes, but this won't trigger re-reads on its own.
  useEffect(() => {
    initialValueRef.current = initialValue;
  });

  // Use a ref to track if it's the first render to avoid double-setting state unnecessarily
  const isFirstRender = useRef(true);

  // Function to read value from local storage
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") {
      return initialValueRef.current;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValueRef.current;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValueRef.current;
    }
  }, [key]);

  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Sync state if key changes (Critical for switching from guest to user context)
  useEffect(() => {
      // Skip the initial effect execution since useState already handled it
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }
      setStoredValue(readValue());
  }, [key, readValue]);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      setStoredValue((oldValue) => {
          const valueToStore = value instanceof Function ? value(oldValue) : value;
          // Save to local storage
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
          return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
