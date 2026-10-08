import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import profileReducer from "./slices/profileSlice";
import coursesReducer from "./slices/coursesSlice";
import videosReducer from "./slices/videosSlice";
import discussionsReducer from "./slices/discussionsSlice";
import notesReducer from "./slices/notesSlice";
import membersReducer from "./slices/membersSlice";
import joinRequestsReducer from "./slices/joinRequestsSlice";
import subscriptionsReducer from "./slices/subscriptionsSlice";
import adminReducer from "./slices/adminSlice";
import settingsReducer from "./slices/settingsSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    profile: profileReducer,
    courses: coursesReducer,
    videos: videosReducer,
    discussions: discussionsReducer,
    notes: notesReducer,
    members: membersReducer,
    joinRequests: joinRequestsReducer,
    subscriptions: subscriptionsReducer,
    admin: adminReducer,
    settings: settingsReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: false, // File objects flow through form thunks
    }),
});
