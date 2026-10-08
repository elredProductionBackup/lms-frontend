import { createSlice, nanoid } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "ui",
  initialState: { toasts: [] },
  reducers: {
    pushToast: {
      reducer(s, a) {
        s.toasts.push(a.payload);
      },
      prepare(message, tone = "default") {
        return { payload: { id: nanoid(), message, tone } };
      },
    },
    dismissToast(s, a) {
      s.toasts = s.toasts.filter((t) => t.id !== a.payload);
    },
  },
});

export const { pushToast, dismissToast } = slice.actions;
export default slice.reducer;
