import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import { redirect } from "next/navigation";
import { EspoFooter } from "@/components/espo-footer";
import { safeNextPath } from "@/lib/espo/client";
import { translate } from "@/lib/espo/i18n";
import { fetchDefaultLanguage, fetchPublicSettings, getCustomLogoUrl } from "@/lib/espo/public-data";
import { getCredentials, getSession } from "@/lib/espo/session";
import { LoginForm, type LoginLabels } from "./login-form";

// Inter: font phổ biến của giao diện SaaS/CRM, dễ đọc ở cỡ nhỏ, có đủ dấu tiếng Việt.
const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Login · EspoCRM",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

  if (getCredentials(await getSession())) {
    redirect(nextPath);
  }

  const [language, settings] = await Promise.all([fetchDefaultLanguage(), fetchPublicSettings()]);
  const t = (name: string, category?: string, scope?: string) =>
    translate(language, name, category, scope);

  // Chỉ gửi các nhãn cần cho form, không gửi cả bộ i18n xuống trình duyệt.
  const labels: LoginLabels = {
    username: t("Username"),
    password: t("Password"),
    logIn: t("Log in"),
    showPassword: t("View"),
    code: t("Code", "labels", "User"),
    submit: t("Submit"),
    backToLogin: t("Back to login form", "labels", "User"),
    userCantBeEmpty: t("userCantBeEmpty", "messages", "User"),
    codeIsRequired: t("codeIsRequired", "messages", "User"),
    wrongUsernamePassword: t("wrongUsernamePassword", "messages", "User"),
    wrongCode: t("wrongCode", "messages", "User"),
    loginError: t("loginError", "messages", "User"),
    error: t("Error"),
  };

  // Key thông báo của bước 2FA (enterTotpCode, enterCodeSentInEmail, …) được dịch ở client.
  const userMessages = Object.fromEntries(
    Object.entries(language.User?.messages ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  return (
    // Trang login luôn dùng nền sáng như mẫu thiết kế, kể cả khi hệ điều hành ở chế độ tối.
    <div className={`${inter.className} flex min-h-dvh flex-1 bg-white text-slate-900`}>
      <section className="flex w-full flex-col px-4 sm:px-10 lg:w-1/2">
        <main className="flex flex-1 items-center justify-center py-12">
          <LoginForm
            labels={labels}
            userMessages={userMessages}
            logoUrl={getCustomLogoUrl(settings)}
            applicationName={settings.applicationName || "EspoCRM"}
            nextPath={nextPath}
          />
        </main>
        <EspoFooter />
      </section>

      <div className="relative hidden lg:block lg:w-1/2">
        {/* Minh hoạ vector (public/login-hero.svg): không cần tối ưu ảnh, nét ở mọi kích thước. */}
        <Image
          src="/login-hero.svg"
          alt=""
          fill
          priority
          unoptimized
          className="object-cover"
        />
      </div>
    </div>
  );
}
