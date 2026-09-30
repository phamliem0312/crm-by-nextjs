"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster, toast } from "@/components/ui/toaster";
import { EspoApiError } from "@/lib/espo/errors";
import type { AppUserData } from "@/lib/espo/types";
import { AppUserContext, ClassicBasePathContext, useTranslator } from "./app-context";

/** 401 đã được `espoFetch` chuyển về /login; 4xx khác thử lại cũng vô ích. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof EspoApiError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < 2;
}

function notify(error: unknown) {
  if (error instanceof EspoApiError && error.status === 401) {
    return;
  }

  toast.error(error);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    // `meta.silent`: query tự xử lý lỗi (ví dụ layout dự phòng khi layout riêng không có).
    queryCache: new QueryCache({ onError: (error, query) => !query.meta?.silent && notify(error) }),
    mutationCache: new MutationCache({ onError: notify }),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}

function TranslatedToaster() {
  return <Toaster t={useTranslator()} />;
}

export function AppProviders({
  appUser,
  classicBasePath,
  children,
}: {
  appUser: AppUserData;
  classicBasePath: string;
  children: ReactNode;
}) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ClassicBasePathContext.Provider value={classicBasePath}>
        <AppUserContext.Provider value={appUser}>
          {children}
          <TranslatedToaster />
        </AppUserContext.Provider>
      </ClassicBasePathContext.Provider>
    </QueryClientProvider>
  );
}
