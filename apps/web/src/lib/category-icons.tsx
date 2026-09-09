import { Folder, Monitor, Network, Server, Terminal, Users, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  monitor: Monitor,
  users: Users,
  terminal: Terminal,
  network: Network,
  server: Server,
};

export function iconForCategory(icon: string | null | undefined): LucideIcon {
  if (!icon) return Folder;
  return MAP[icon] ?? Folder;
}
