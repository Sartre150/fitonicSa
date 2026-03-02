"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LineChart, UtensilsCrossed, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // No mostrar el menú en el login
  if (pathname === "/login" || pathname === "/") return null;

  const links = [
    { href: "/workout", icon: Dumbbell, label: "Rutina" },
    { href: "/progress", icon: LineChart, label: "Progreso" },
    { href: "/nutrition", icon: UtensilsCrossed, label: "Nutrición" },
    { href: "/profile", icon: User, label: "Perfil" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 pb-safe pt-2 px-6 z-40">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-indigo-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}