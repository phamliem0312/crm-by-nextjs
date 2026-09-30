// Bắt buộc theo AGPL-3.0 §7(b) của EspoCRM: giữ chữ "EspoCRM" trên giao diện.
// Mọi layout (khu cần đăng nhập, trang login…) đều phải hiển thị component này.
export function EspoFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`py-4 text-center text-xs text-zinc-500 ${className}`}>
      Powered by{" "}
      <a href="https://www.espocrm.com" target="_blank" rel="noopener" className="hover:underline">
        EspoCRM
      </a>
    </footer>
  );
}
