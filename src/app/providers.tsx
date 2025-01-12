// app/providers.js
"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

if (typeof window !== "undefined") {
  // Only initialize PostHog if the environment variables are available
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (posthogKey && posthogHost) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: "always",
    });
  } else {
    console.log(
      "PostHog environment variables are not set. Analytics will be disabled. Skipping PostHog initialization.",
    );
  }
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

import React, { createContext, useContext, useMemo, useState } from 'react';

// Define the structure of the global state
const GlobalStateContext = createContext<{
  audioLength: string;
  setAudioLength: (length: string) => void;
  anotherVariable: string;
  setAnotherVariable: (value: string) => void;
} | undefined>(undefined);

// use of dynamic routes like [username]/[repo]/page.tsx is forcing us to use global context else
// we could have passed audioLength via props
export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioLength, setAudioLength] = useState("short");
  const [anotherVariable, setAnotherVariable] = useState("defaultValue");

  // Use useMemo to memoize the context value
  const value = useMemo(() => ({
    audioLength,
    setAudioLength,
    anotherVariable,
    setAnotherVariable
  }), [audioLength, anotherVariable]);

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};