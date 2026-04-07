import React, { useState } from "react";
import {
  Send,
  MessageSquare,
  ArrowRight,
  UserCheck,
  Clock,
  Plus,
} from "lucide-react";
import { STAGE_CONFIG } from "../../lib/leadsHelpers";

const TYPE_CONFIG = {
  created: {
    Icon: Plus,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    label: "Lead created",
  },
  stage_changed: {
    Icon: ArrowRight,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    label: "Stage changed",
  },
  note_added: {
    Icon: MessageSquare,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Note",
  },
  assigned: {
    Icon: UserCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Assigned",
  },
};

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function ActivityItem({ activity }) {
  const cfg = TYPE_CONFIG[activity.activity_type] || TYPE_CONFIG.note_added;
  const { Icon } = cfg;

  let desc = "";
  if (activity.activity_type === "created") desc = "Lead added to pipeline";
  else if (activity.activity_type === "stage_changed") {
    const from =
      STAGE_CONFIG[activity.from_stage]?.label || activity.from_stage;
    const to = STAGE_CONFIG[activity.to_stage]?.label || activity.to_stage;
    desc = `Moved from ${from} → ${to}`;
  } else if (activity.activity_type === "note_added") {
    desc = activity.note || "";
  } else if (activity.activity_type === "assigned") {
    desc = activity.note || "Assigned to salesperson";
  }

  return (
    <div className="flex gap-3 group">
      {/* Icon col */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}
        >
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="w-px flex-1 mt-1 bg-white/5" />
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-xs font-semibold ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-gray-600 flex-shrink-0 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo(activity.created_at)}
          </span>
        </div>
        {desc && (
          <p className="text-xs text-gray-400 leading-relaxed break-words">
            {desc}
          </p>
        )}
        {activity.creator?.full_name && (
          <p className="text-xs text-gray-600 mt-0.5">
            by {activity.creator.full_name}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LeadActivityLog({ activities, onAddNote, loading }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onAddNote(note.trim());
      setNote("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
        Activity
      </h4>

      {loading ? (
        <p className="text-xs text-gray-600 py-4">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="text-xs text-gray-600 py-2">No activity yet.</p>
      ) : (
        <div>
          {activities.map((a) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </div>
      )}

      {/* Add note */}
      <div className="mt-2 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 resize-none transition-all"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) handleAddNote();
          }}
        />
        <button
          onClick={handleAddNote}
          disabled={!note.trim() || saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all"
          style={{
            background: "linear-gradient(135deg,#dc2626,#b91c1c)",
            boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
          }}
        >
          <Send className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Add Note"}
        </button>
      </div>
    </div>
  );
}
