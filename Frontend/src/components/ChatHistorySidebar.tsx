import { useState, memo, useMemo } from "react";
import { MessageSquarePlus, Search, Pencil, Trash2, X, LogOut, ChevronRight } from "lucide-react";
import { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatHistorySidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  profileName?: string;
  onOpenProfile?: () => void;
  onLogout?: () => void;
}

export const ChatHistorySidebar = memo(function ChatHistorySidebar({
  conversations, activeId, onSelect, onNew, onRename, onDelete, isOpen, onToggle,
  profileName, onOpenProfile, onLogout,
}: ChatHistorySidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const today = new Date();
  const toDate = (d: Date | string) => d instanceof Date ? d : new Date(d);
  const isToday = (d: Date | string) => toDate(d).toDateString() === today.toDateString();
  const isYesterday = (d: Date | string) => {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return toDate(d).toDateString() === y.toDateString();
  };

  // 1. Filter by search first
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // 2. Group by groupId
  const groupMap = new Map<string, Conversation[]>();
  const singles: Conversation[] = [];

  filtered.forEach(c => {
    if (c.groupId) {
      if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, []);
      groupMap.get(c.groupId)!.push(c);
    } else {
      singles.push(c);
    }
  });

  // 3. Prepare items for categorization
  interface SidebarItem {
    type: 'group' | 'single';
    id: string;
    updatedAt: Date;
    data: any;
  }

  const itemsToCategorize: SidebarItem[] = [];

  groupMap.forEach((groupConvs, groupId) => {
    // Sort group members to get the latest update
    const sorted = [...groupConvs].sort((a, b) => toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime());
    itemsToCategorize.push({
      type: 'group',
      id: groupId,
      updatedAt: toDate(sorted[0].updatedAt),
      data: groupConvs
    });
  });

  singles.forEach(c => {
    itemsToCategorize.push({
      type: 'single',
      id: c._id || c.id,
      updatedAt: toDate(c.updatedAt),
      data: c
    });
  });

  // 4. Categorize into time buckets
  const buckets = {
    today: itemsToCategorize.filter(i => isToday(i.updatedAt)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    yesterday: itemsToCategorize.filter(i => isYesterday(i.updatedAt)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    older: itemsToCategorize.filter(i => !isToday(i.updatedAt) && !isYesterday(i.updatedAt)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  };

  const handleRename = (id: string) => {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim());
    }
    setEditingId(null);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[280px] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <span className="text-sm font-semibold text-foreground">History</span>
        <div className="flex gap-1">
          <button onClick={onNew} className="p-1.5 rounded-control text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-base" title="New Chat">
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-control text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-base">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-control border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* Conversations list */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {(["today", "yesterday", "older"] as const).map((bucket) => {
          const items = buckets[bucket];
          if (!items.length) return null;

          return (
            <div key={bucket} className="mt-4">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {bucket === "today" ? "Today" : bucket === "yesterday" ? "Yesterday" : "Previous"}
              </p>
              <div className="space-y-1 mt-1">
                {items.map((item) => {
                  if (item.type === 'group') {
                    const groupConvs = item.data as Conversation[];
                    const isGroupActive = groupConvs.some(c => (c._id || c.id) === activeId);
                    const firstConv = groupConvs[0];
                    const groupTitle = firstConv.title.split(" — ")[0] || firstConv.title;

                    return (
                      <div key={item.id} className="relative px-1">
                        <div className={cn(
                          "rounded-xl border transition-all duration-300 overflow-hidden",
                          isGroupActive
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-border/30 hover:border-primary/25 bg-card/20"
                        )}>
                          {/* Group header */}
                          <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border/20">
                            <div className="flex -space-x-1">
                              {groupConvs.slice(0, 3).map((gc, i) => (
                                <div key={i} className="h-2 w-2 rounded-full ring-1 ring-background" style={{
                                  backgroundColor:
                                    gc.benchmarkingMode === "full-context" ? "hsl(142, 70%, 45%)" :
                                      gc.benchmarkingMode === "sliding-window" ? "hsl(48, 95%, 50%)" :
                                        "hsl(217, 90%, 60%)"
                                }} />
                              ))}
                            </div>
                            <span className="text-[10px] font-bold text-foreground truncate max-w-[140px]">
                              {groupTitle}
                            </span>
                            <span className="text-[8px] font-bold text-primary/70 uppercase tracking-tighter bg-primary/10 px-1.5 py-0.5 rounded-full ml-auto">
                              {groupConvs.length}X
                            </span>
                          </div>

                          {/* Group items - collapsible would be better but let's keep it visible for now as requested */}
                          <div className="py-1">
                            {groupConvs.map((gc) => {
                              const gcId = gc._id || gc.id;
                              return (
                                <div key={gcId} className="relative group">
                                  {editingId === gcId ? (
                                    <div className="px-2 py-1">
                                      <input
                                        autoFocus
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onBlur={() => handleRename(gcId)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(gcId); if (e.key === "Escape") setEditingId(null); }}
                                        className="w-full rounded-md border border-primary/50 bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => onSelect(gcId)}
                                      className={cn(
                                        "flex w-full items-center px-4 py-1.5 text-xs transition-all text-left gap-2.5",
                                        activeId === gcId
                                          ? "text-primary font-semibold bg-primary/10"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{
                                        backgroundColor:
                                          gc.benchmarkingMode === "full-context" ? "hsl(142, 70%, 45%)" :
                                            gc.benchmarkingMode === "sliding-window" ? "hsl(48, 95%, 50%)" :
                                              "hsl(217, 90%, 60%)"
                                      }} />
                                      <span className="truncate flex-1 text-[11px]">{gc.groupLabel || gc.title.split(" — ")[1] || gc.benchmarkingMode}</span>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingId(gcId || ""); setEditTitle(gc.title); }} className="p-0.5 rounded hover:bg-primary/20 hover:text-primary transition-colors">
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(gcId || ""); }} className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-colors">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const conv = item.data as Conversation;
                    const convId = conv._id || conv.id;
                    return (
                      <div key={convId} className="relative group px-1">
                        {editingId === convId ? (
                          <div className="px-1">
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleRename(convId || "")}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRename(convId || ""); if (e.key === "Escape") setEditingId(null); }}
                              className="w-full rounded-lg border border-primary/50 bg-background px-3 py-2 text-xs text-foreground focus:outline-none shadow-sm"
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => onSelect(convId || "")}
                            className={cn(
                              "flex w-full items-center rounded-xl px-3 py-2.5 text-xs transition-all text-left gap-3 group/item relative overflow-hidden",
                              activeId === convId
                                ? "bg-primary/10 text-foreground font-semibold shadow-sm border border-primary/20"
                                : "text-muted-foreground hover:bg-muted/60 border border-transparent"
                            )}
                          >
                            <div className="h-2 w-2 rounded-full shrink-0 shadow-sm" style={{
                              backgroundColor:
                                conv.benchmarkingMode === "full-context" ? "hsl(142, 70%, 45%)" :
                                  conv.benchmarkingMode === "sliding-window" ? "hsl(48, 95%, 50%)" :
                                    "hsl(217, 90%, 60%)"
                            }} />
                            <div className="flex-1 truncate">
                              <span className="block truncate text-[12px]">{conv.title}</span>
                              {conv.benchmarkingMode && (
                                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter block -mt-0.5">
                                  {conv.benchmarkingMode.replace("-", " ")}
                                  {conv.slidingWindowSize ? ` (${conv.slidingWindowSize})` : ""}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(convId || ""); setEditTitle(conv.title); }}
                                className="p-1 rounded-md hover:bg-primary/20 hover:text-primary transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(convId || ""); }}
                                className="p-1 rounded-md hover:bg-destructive/20 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 opacity-40">
            <Search className="h-8 w-8 mb-2" />
            <p className="text-xs font-medium text-center">No conversations found</p>
          </div>
        )}
      </nav>

      {/* Profile footer */}
      {profileName && (
        <div className="border-t border-sidebar-border px-3 py-3 animate-fade-in">
          <button
            onClick={onOpenProfile}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-all duration-200 hover:bg-sidebar-accent group"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm transition-transform duration-200 group-hover:scale-110">
              {profileName.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate text-sm font-medium text-foreground">{profileName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );
});
