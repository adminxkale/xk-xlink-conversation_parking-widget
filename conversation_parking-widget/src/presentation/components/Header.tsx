"use client";

export function Header() {
  return (
    <header className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
      <img
        src="/images/xlink_logo_v2.png"
        alt="Xlink logo"
        className="h-8 w-auto"
      />
      <h1 className="text-lg font-semibold text-gray-900">
        Conversation Parking Hub
      </h1>
    </header>
  );
}
