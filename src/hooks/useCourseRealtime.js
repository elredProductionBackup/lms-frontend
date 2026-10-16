"use client";

import { useEffect } from "react";
import { useStore } from "react-redux";
import { io } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  rtCommentAdded,
  rtCommentUpdated,
  rtCommentDeleted,
  rtCommentReplyDeleted,
  rtQuestionAdded,
  rtQuestionUpdated,
  rtQuestionDeleted,
  rtQuestionReplyDeleted,
} from "@/store/slices/discussionsSlice";
import { pushToast } from "@/store/slices/uiSlice";

// Realtime for one course (API doc → Realtime):
//   path  /lms-socket.io   (not the default /socket.io)
//   auth  socket.handshake.auth.token = the same Bearer token as REST
//   room  emit join:course { courseId } after connecting (and again on every
//         reconnect, since the server may drop us from the room silently);
//         emit leave:course when leaving. Rooms are per course, so switching
//         recordings needs no re-join; the slice ignores events for other
//         videoIds.
//
// Socket.io needs a direct connection to the backend (the Next.js /api proxy
// doesn't carry websockets), so this connects to the backend's origin:
//   NEXT_PUBLIC_SOCKET_URL, else the origin of NEXT_PUBLIC_API_BASE_URL,
//   else pretest. Set NEXT_PUBLIC_SOCKET_URL=off to disable realtime.
const SOCKET_PATH = "/lms-socket.io";

function socketUrl() {
  const explicit = (process.env.NEXT_PUBLIC_SOCKET_URL || "").trim();
  if (explicit.toLowerCase() === "off") return null;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://pretest.elred.io").trim();
  try {
    return new URL(/^https?:\/\//i.test(api) ? api : `https://${api}`).origin;
  } catch {
    return null;
  }
}

export default function useCourseRealtime(courseId, enabled = true) {
  const dispatch = useAppDispatch();
  const store = useStore();
  const token = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    const url = socketUrl();
    if (!enabled || !courseId || !token || !url) return;

    const socket = io(url, {
      path: SOCKET_PATH,
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelayMax: 15000,
    });

    const join = () => socket.emit("join:course", { courseId });
    socket.on("connect", join);

    const on = (event, action) => socket.on(event, (payload) => dispatch(action(payload)));
    on("comment:added", rtCommentAdded);
    on("comment:pinned", rtCommentUpdated);
    on("comment:unpinned", rtCommentUpdated);
    on("comment:replied", rtCommentUpdated);
    on("comment:deleted", rtCommentDeleted);
    on("comment:replyDeleted", rtCommentReplyDeleted);
    on("question:asked", rtQuestionAdded);
    on("question:replied", rtQuestionUpdated);
    on("question:pinned", rtQuestionUpdated);
    on("question:unpinned", rtQuestionUpdated);
    on("question:replyDeleted", rtQuestionReplyDeleted);

    // UC-R3: if the open thread is the one deleted, close it and say so.
    socket.on("question:deleted", (payload) => {
      const { activeQuestion, videoId } = store.getState().discussions;
      const wasOpen =
        payload?.videoId === videoId && activeQuestion?._id === payload?.questionId;
      dispatch(rtQuestionDeleted(payload));
      if (wasOpen) dispatch(pushToast("This question was removed", "default"));
    });

    return () => {
      if (socket.connected) socket.emit("leave:course", { courseId });
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [courseId, token, enabled, dispatch, store]);
}
