import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export default function UserAvatar({ name, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? "avatar"} />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
