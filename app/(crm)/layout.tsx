import "@fortawesome/fontawesome-free/css/all.min.css";
import { AppProviders } from "@/components/providers/app-providers";
import { AppShell } from "@/components/shell/app-shell";
import { getClassicBasePath } from "@/lib/espo/config";
import { getAppUser } from "@/lib/espo/server-api";

// Phần cần đăng nhập: nạp App/user (user, acl, preferences, settings…) một lần rồi đưa vào context.
// Metadata và I18n do client tải qua TanStack Query (cache theo user + cacheTimestamp).
export default async function CrmLayout({ children }: LayoutProps<"/">) {
  const appUser = await getAppUser();

  return (
    <AppProviders appUser={appUser} classicBasePath={getClassicBasePath()}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
