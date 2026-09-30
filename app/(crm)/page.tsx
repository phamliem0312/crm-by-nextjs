import { getClassicBasePath } from "@/lib/espo/config";

// Trang tạm của giai đoạn 0. Giai đoạn 1 thay bằng shell (navbar, auth gate) và dashboard.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">EspoCRM Next</h1>
      <p>Giao diện mới đang được xây dựng. Trong lúc chờ, hãy dùng giao diện classic.</p>
      <ul className="list-disc pl-6">
        <li>
          <a className="underline" href={`${getClassicBasePath()}/`}>
            Mở giao diện classic
          </a>
        </li>
      </ul>
    </main>
  );
}
