interface HeaderProps {
  title: string;
}

export function AdminHeader({ title }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shrink-0">
      <h2 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h2>
    </header>
  );
}
