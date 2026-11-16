import { useState } from "react";
import { Hash, LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isValidRoom } from "@/lib/utils";

/** 房间切换：输入房间名进入（前端校验 [a-zA-Z0-9_-]{1,32}） */
export function RoomDialog({
  currentRoom,
  open,
  onOpenChange,
  onJoin,
}: {
  currentRoom: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (room: string) => void;
}) {
  const [name, setName] = useState(currentRoom);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidRoom(name);

  const join = () => {
    if (!valid) {
      setError("房间名仅限字母、数字、下划线和短横线，1–32 个字符");
      return;
    }
    onJoin(name);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(currentRoom);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>切换房间</DialogTitle>
          <DialogDescription className="sr-only">
            输入房间名以切换
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="room-name" className="sr-only">
              房间名
            </label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") join();
              }}
              placeholder="例如 iphone-pc"
              autoFocus
              aria-invalid={error !== null}
              maxLength={32}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
          </div>
          {error && (
            <p id="room-name-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            {["public", "temp", "dev"].map((r) => (
              <Badge
                key={r}
                asChild
                variant={r === name ? "default" : "secondary"}
                className="cursor-pointer"
              >
                <button type="button" onClick={() => setName(r)}>
                  {r}
                </button>
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={join} disabled={!name || !valid}>
            <LogIn aria-hidden="true" />
            进入房间
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
