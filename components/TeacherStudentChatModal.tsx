"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

const supabase = createClient();

interface TeacherStudentChatModalProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  studentId: string;
  studentName: string;
}

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

function TeacherStudentChatModal({
  open,
  onClose,
  teacherId,
  studentId,
  studentName,
}: TeacherStudentChatModalProps) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Load existing messages when modal opens
  useEffect(() => {
    if (!open || !teacherId || !studentId) return;

    const loadMessages = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, body, created_at")
        .or(`sender_id.eq.${teacherId},receiver_id.eq.${teacherId}`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("chat load error:", error);
        setMessages([]);
      } else {
        const filtered = (data || []).filter((m) => {
          return (
            (m.sender_id === teacherId && m.receiver_id === studentId) ||
            (m.sender_id === studentId && m.receiver_id === teacherId)
          );
        }) as MessageRow[];

        setMessages(filtered);
      }
      setLoading(false);
    };

    loadMessages();
  }, [open, teacherId, studentId]);

  // Realtime subscription
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel("teacher-student-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as MessageRow;

          const isThisConversation =
            (msg.sender_id === teacherId && msg.receiver_id === studentId) ||
            (msg.sender_id === studentId && msg.receiver_id === teacherId);

          if (isThisConversation) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, teacherId, studentId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      const body = newMessage.trim();

      // Insert and immediately get the created row back
      const { data, error } = await supabase
        .from("messages")
      .insert({
        sender_id: teacherId,
        receiver_id: studentId,
        body,
      })
      .select("id, sender_id, receiver_id, body, created_at")
      .single();

      if (error) throw error;

      // Optimistically add it to the local state
      if (data) {
      setMessages((prev) => [...prev, data as MessageRow]);
    }

    setNewMessage("");
  } catch (err: any) {
    console.error("send message error:", err);
  } finally {
    setSending(false);
  }
}

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <div className="flex h-[460px] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-2xl">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Chat with {studentName || "Student"}
            </h3>
            <p className="text-[11px] text-slate-500">
              Teacher–student private messages
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
          {loading && (
            <p className="text-xs text-slate-500">Loading messages…</p>
          )}

          {!loading && messages.length === 0 && (
            <p className="text-xs text-slate-500">
              No messages yet. Start the conversation!
            </p>
          )}

          {!loading &&
            messages.map((m) => {
              const isTeacher = m.sender_id === teacherId;
              return (
                <div
                  key={m.id}
                  className={`flex ${
                    isTeacher ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-xs ${
                      isTeacher
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                    }`}
                  >
                    <p>{m.body}</p>
                    <p
                      className={`mt-0.5 text-[10px] ${
                        isTeacher ? "text-emerald-100/80" : "text-slate-400"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Type a message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TeacherStudentChatModal;
