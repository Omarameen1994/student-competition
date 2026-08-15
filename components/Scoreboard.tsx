"use client";

import type { Team } from "@/lib/types";
import { medal } from "@/lib/format";

export function Scoreboard({ teams, compact = false }: { teams: Team[]; compact?: boolean }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = ranked[0]?.score ?? 0;

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {ranked.map((team, i) => (
        <div
          key={team.id}
          className="card flex items-center gap-3 overflow-hidden px-3 py-2.5"
          style={{ borderColor: i === 0 ? team.color : undefined }}
        >
          <span className="w-7 text-center text-lg">{medal(i + 1)}</span>
          <span className="text-xl">{team.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{team.name}</div>
            {!compact && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-ink)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${top > 0 ? Math.max(4, (team.score / top) * 100) : 4}%`,
                    background: team.color,
                  }}
                />
              </div>
            )}
          </div>
          <span className="text-2xl font-black tabular-nums" style={{ color: team.color }}>
            {team.score}
          </span>
        </div>
      ))}
    </div>
  );
}
