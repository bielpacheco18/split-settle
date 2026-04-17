import { useState } from "react";
import { Link } from "react-router-dom";
import { useGroups } from "@/hooks/useGroups";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, ChevronRight, Trash2 } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/PageTransition";

export default function Groups() {
  const { user } = useAuth();
  const { groupsQuery, createGroup, deleteGroup } = useGroups();
  const { acceptedFriends } = useFriends();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!name.trim()) { toast({ title: "Informe o nome do grupo", variant: "destructive" }); return; }
    if (selectedMembers.length === 0) { toast({ title: "Adicione ao menos um membro", variant: "destructive" }); return; }
    try {
      await createGroup.mutateAsync({ name: name.trim(), description: description.trim() || undefined, memberIds: selectedMembers });
      toast({ title: `Grupo "${name}" criado!` });
      setSheetOpen(false);
      setName(""); setDescription(""); setSelectedMembers([]);
    } catch (err: any) {
      toast({ title: "Erro ao criar grupo", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (groupId: string, groupName: string) => {
    if (!confirm(`Excluir o grupo "${groupName}"?`)) return;
    try {
      await deleteGroup.mutateAsync(groupId);
      toast({ title: "Grupo excluído" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const groups = groupsQuery.data ?? [];

  return (
    <StaggerContainer className="space-y-6">
      <StaggerItem>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grupos</h1>
            <p className="text-sm text-muted-foreground">Divida despesas em grupo</p>
          </div>
          <Button onClick={() => setSheetOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo grupo
          </Button>
        </div>
      </StaggerItem>

      {groupsQuery.isLoading ? (
        <StaggerItem>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </StaggerItem>
      ) : groups.length === 0 ? (
        <StaggerItem>
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhum grupo ainda</p>
              <p className="text-sm text-muted-foreground">Crie um grupo para dividir despesas juntos</p>
            </div>
            <Button onClick={() => setSheetOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro grupo
            </Button>
          </div>
        </StaggerItem>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <StaggerItem key={group.id}>
              <div className="flex items-center gap-2">
                <Link to={`/groups/${group.id}`} className="flex-1">
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.member_count} membro{group.member_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
                {group.created_by === user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(group.id, group.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </StaggerItem>
          ))}
        </div>
      )}

      {/* Create group sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Novo grupo</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do grupo *</Label>
              <Input
                placeholder="Ex: Viagem Lisboa, República..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o grupo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Membros *</Label>
              {acceptedFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground">Adicione amigos primeiro para criar um grupo.</p>
              ) : (
                <div className="space-y-2">
                  {acceptedFriends.map((f: any) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={selectedMembers.includes(f.id)}
                        onCheckedChange={(checked) =>
                          setSelectedMembers((prev) =>
                            checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                          )
                        }
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(f.name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{f.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createGroup.isPending}
            >
              {createGroup.isPending ? "Criando..." : "Criar grupo"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </StaggerContainer>
  );
}
