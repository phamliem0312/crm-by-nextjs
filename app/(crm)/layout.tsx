import Link from "next/link";
import { EspoFooter } from "@/components/espo-footer";
import { requireCredentials } from "@/lib/espo/session";
import { LogoutButton } from "./logout-button";

// Khung tạm cho phần cần đăng nhập. Navbar theo tabList, global search… làm ở bước App shell.
export default async function CrmLayout({ children }: LayoutProps<"/">) {
  const { userName } = await requireCredentials();

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="font-semibold">
            EspoCRM
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{userName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
      <EspoFooter />
    </>
  );
}
