import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityFeed, ActivityItem } from "@/hooks/useActivityFeed";

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "settlement_received") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
        <ArrowDownLeft className="h-4 w-4 text-success" />
      </div>
    );
  }
  if (type === "settlement_sent") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15">
        <ArrowUpRight className="h-4 w-4 text-destructive" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
      <Receipt className="h-4 w-4 text-primary" />
    </div>
  );
}

function ActivityText({ item }: { item: ActivityItem }) {
  if (item.type === "expense_created") {
    const actor = item.isMine ? "Você" : item.payerName;
    const verb = item.isMine ? "adicionou" : "adicionou";
    return (
      <span>
        <span className="font-semibold">{actor}</span>
        {" "}{verb}{" "}
        <span className="font-medium">"{item.description}"</span>
        {" — "}
        <span className="font-semibold">R$ {item.totalAmount?.toFixed(2)}</span>
        {!item.isMine && item.myAmount !== undefined && (
          <span className="text-muted-foreground text-xs">
            {" "}(sua parte: R$ {item.myAmount.toFixed(2)})
          </span>
        )}
      </span>
    );
  }

  if (item.type === "settlement_sent") {
    return (
      <span>
        <span className="font-semibold">Você</span>
        {" pagou "}
        <span className="font-semibold">{item.otherName}</span>
        {" — "}
        <span className="font-semibold text-destructive">R$ {item.amount?.toFixed(2)}</span>
      </span>
    );
  }

  // settlement_received
  return (
    <span>
      <span className="font-semibold">{item.otherName}</span>
      {" te pagou — "}
      <span className="font-semibold text-success">R$ {item.amount?.toFixed(2)}</span>
    </span>
  );
}

function timeAgo(ts: string) {
  try {
    return formatDistanceToNow(new Date(ts), { locale: ptBR, addSuffix: true });
  } catch {
    return "";
  }
}

export default function ActivityFeedPage() {
  const { data: items, isLoading } = useActivityFeed();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Atividade</h1>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (!items || items.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Activity className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma atividade ainda.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && items && items.length > 0 && (
        <div className="relative space-y-0">
          {/* vertical line */}
          <div className="absolute left-[17px] top-5 bottom-5 w-px bg-border" />

          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <ActivityIcon type={item.type} />
                <Card className="flex-1">
                  <CardContent className="p-3.5">
                    <p className="text-sm leading-snug">
                      <ActivityText item={item} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(item.timestamp)}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
