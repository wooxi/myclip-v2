/** MyClip logo：黑底单笔纸夹曲线（与 PWA 图标同源），通过 className 控制尺寸与圆角 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="MyClip"
    >
      <rect width="32" height="32" rx="8" fill="#0a0a0a" />
      <path
        d="M10 23.5 V12 a6 6 0 0 1 12 0 v9.5 a4 4 0 0 1 -8 0 V15"
        fill="none"
        stroke="#fafafa"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
