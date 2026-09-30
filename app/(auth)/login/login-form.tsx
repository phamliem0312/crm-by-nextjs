"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  requestLogin,
  requestLoginCode,
  type LoginApiFailReason,
  type LoginResponseBody,
} from "@/lib/espo/login-api";

export type LoginLabels = {
  username: string;
  password: string;
  logIn: string;
  showPassword: string;
  code: string;
  submit: string;
  backToLogin: string;
  userCantBeEmpty: string;
  codeIsRequired: string;
  wrongUsernamePassword: string;
  wrongCode: string;
  loginError: string;
  error: string;
};

type Props = {
  labels: LoginLabels;
  /** `User.messages` của ngôn ngữ mặc định, để dịch thông báo của bước 2FA. */
  userMessages: Record<string, string>;
  /** Logo riêng do admin đặt; `null` thì hiện tên ứng dụng. */
  logoUrl: string | null;
  applicationName: string;
  nextPath: string;
};

type CredentialsValues = { userName: string; password: string };
type CodeValues = { code: string };

function failMessage(labels: LoginLabels, reason: LoginApiFailReason, message?: string): string {
  switch (reason) {
    case "wrong-credentials":
      return labels.wrongUsernamePassword;
    case "wrong-code":
      return labels.wrongCode;
    default:
      return message ? `${labels.error}: ${message}` : labels.loginError;
  }
}

// Màu chủ đạo xanh dương (blue-600), cùng tông với hình minh hoạ public/login-hero.svg.
const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 " +
  "shadow-xs outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:ring-4 " +
  "not-aria-invalid:focus:border-blue-600 not-aria-invalid:focus:ring-blue-600/15 " +
  "aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/15";

const labelClass = "text-[13px] font-medium text-slate-700";

const buttonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold " +
  "text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700 active:bg-blue-800 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " +
  "disabled:cursor-not-allowed disabled:opacity-70";

const fieldErrorClass = "text-xs text-red-600";

type IconProps = { className?: string };

function Svg({ className = "size-[18px]", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const UserIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </Svg>
);

const LockIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
);

const ShieldIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </Svg>
);

const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <Svg>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M3 3l18 18" />}
    </Svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Icon đặt trong ô nhập, bên trái. */
function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-slate-400">
      {children}
    </span>
  );
}

/** Logo mặc định: ô vuông xanh với biểu tượng biểu đồ, kèm tên ứng dụng. */
function BrandMark({ applicationName }: { applicationName: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/30">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 17v-4M12 17V7M18 17v-7" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900">{applicationName}</span>
    </div>
  );
}

export function LoginForm({ labels, userMessages, logoUrl, applicationName, nextPath }: Props) {
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [secondStepMessage, setSecondStepMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const credentialsForm = useForm<CredentialsValues>({ defaultValues: { userName: "", password: "" } });
  const codeForm = useForm<CodeValues>({ defaultValues: { code: "" } });
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  function handleResult(result: LoginResponseBody) {
    if (result.status === "success") {
      // Tải lại hẳn trang để layout phía server đọc session mới.
      setRedirecting(true);
      window.location.assign(nextPath);

      return;
    }

    if (result.status === "second-step") {
      setError(null);
      setSecondStepMessage(result.message ? (userMessages[result.message] ?? result.message) : null);
      codeForm.reset();
      setStep("code");

      return;
    }

    if (result.reason === "second-step-expired") {
      setStep("credentials");
      credentialsForm.setValue("password", "");
    }

    setError(failMessage(labels, result.reason, result.message));
  }

  const submitCredentials = credentialsForm.handleSubmit(async ({ userName, password }) => {
    setError(null);
    handleResult(await requestLogin(userName.trim(), password));
  });

  const submitCode = codeForm.handleSubmit(async ({ code }) => {
    setError(null);
    handleResult(await requestLoginCode(code));
  });

  function backToLogin() {
    setStep("credentials");
    setError(null);
    credentialsForm.setValue("password", "");
  }

  const userNameError = credentialsForm.formState.errors.userName;
  const codeError = codeForm.formState.errors.code;
  const { ref: codeRegisterRef, ...codeRegister } = codeForm.register("code", {
    setValueAs: (value: string) => value.replace(/\s/g, ""),
    required: labels.codeIsRequired,
  });

  const credentialsBusy = credentialsForm.formState.isSubmitting || redirecting;
  const codeBusy = codeForm.formState.isSubmitting || redirecting;

  return (
    <div className="w-full max-w-[400px]">
      {logoUrl ? (
        // Logo có thể là SVG hoặc ảnh do admin tải lên (entryPoint của Espo), nên không qua next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={applicationName} className="block h-9 w-auto max-w-[200px] object-contain" />
      ) : (
        <BrandMark applicationName={applicationName} />
      )}

      <h1 className="mt-10 text-[28px] leading-tight font-semibold tracking-tight text-slate-900">
        {step === "credentials" ? labels.logIn : labels.code}
      </h1>
      {step === "code" && secondStepMessage && (
        <p className="mt-2 text-sm text-slate-500">{secondStepMessage}</p>
      )}

      <div className="mt-8">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
          >
            <AlertIcon className="mt-px size-[18px] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "credentials" ? (
          <form onSubmit={submitCredentials} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="field-userName" className={labelClass}>
                {labels.username}
              </label>
              <div className="relative">
                <FieldIcon>
                  <UserIcon />
                </FieldIcon>
                <input
                  id="field-userName"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={255}
                  autoFocus
                  aria-invalid={userNameError ? true : undefined}
                  aria-describedby={userNameError ? "field-userName-error" : undefined}
                  className={inputClass}
                  {...credentialsForm.register("userName", {
                    validate: (value) => value.trim() !== "" || labels.userCantBeEmpty,
                  })}
                />
              </div>
              {userNameError && (
                <p id="field-userName-error" className={fieldErrorClass}>
                  {userNameError.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="field-password" className={labelClass}>
                {labels.password}
              </label>
              <div className="relative">
                <FieldIcon>
                  <LockIcon />
                </FieldIcon>
                <input
                  id="field-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={255}
                  className={`${inputClass} pr-11`}
                  {...credentialsForm.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-pressed={showPassword}
                  aria-label={labels.showPassword}
                  title={labels.showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-slate-700 focus-visible:text-blue-600 focus-visible:outline-none"
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className={`${buttonClass} mt-2`} disabled={credentialsBusy} aria-busy={credentialsBusy}>
              {credentialsBusy && <Spinner />}
              {labels.logIn}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="field-code" className={labelClass}>
                {labels.code}
              </label>
              <div className="relative">
                <FieldIcon>
                  <ShieldIcon />
                </FieldIcon>
                <input
                  id="field-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={7}
                  aria-invalid={codeError ? true : undefined}
                  aria-describedby={codeError ? "field-code-error" : undefined}
                  className={`${inputClass} font-mono tracking-[0.3em]`}
                  ref={(element) => {
                    codeRegisterRef(element);
                    codeInputRef.current = element;
                  }}
                  {...codeRegister}
                />
              </div>
              {codeError && (
                <p id="field-code-error" className={fieldErrorClass}>
                  {codeError.message}
                </p>
              )}
            </div>

            <button type="submit" className={`${buttonClass} mt-2`} disabled={codeBusy} aria-busy={codeBusy}>
              {codeBusy && <Spinner />}
              {labels.submit}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="inline-flex items-center justify-center gap-1.5 self-center rounded-md px-2 py-1 text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <ArrowLeftIcon className="size-4" />
              {labels.backToLogin}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
