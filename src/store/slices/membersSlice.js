import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

// GET /api/members?role=
export const fetchMembers = createAsyncThunk(
  "members/list",
  async (role, { rejectWithValue }) => {
    try {
      const qs = role ? `?role=${role}` : "";
      const data = await api.get(`/members${qs}`);
      return data.members || [];
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// POST /api/members  (multipart: email, role, name?, aboutHtml?, file?)
// `name` is used only if this creates the account; an existing account keeps
// its name and just gets the role.
export const addMember = createAsyncThunk(
  "members/add",
  async ({ email, role, name, aboutHtml, file }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("role", role);
      if (name) fd.append("name", name);
      if (aboutHtml) fd.append("aboutHtml", aboutHtml);
      if (file) fd.append("file", file);
      return await api.form("/members", fd);
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/members/:userId/role  { role }
export const changeMemberRole = createAsyncThunk(
  "members/role",
  async ({ userId, role }, { rejectWithValue }) => {
    try {
      return await api.put(`/members/${userId}/role`, { role });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// DELETE /api/members/:userId  (soft: role -> null)
export const removeMember = createAsyncThunk(
  "members/remove",
  async (userId, { rejectWithValue }) => {
    try {
      await api.del(`/members/${userId}`);
      return userId;
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// PUT /api/users/:userId/profile  { name, aboutHtml }
export const updateMemberProfile = createAsyncThunk(
  "members/profile",
  async ({ userId, name, aboutHtml }, { rejectWithValue }) => {
    try {
      const body = { aboutHtml };
      if (name !== undefined) body.name = name; // admins can't rename others
      const data = await api.put(`/users/${userId}/profile`, body);
      return { userId, ...(name !== undefined ? { name } : {}), aboutHtml, ...(data || {}) };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// A person's display name is their profile `name` (one per person, max 100).
// Admins give it only when their call creates the account (seat assignment
// or POST /members); after that only the person can change it.
export const PERSON_NAME_MAX = 100;

// POST /api/users/:userId/avatar  (multipart "file") -> { avatarUrl }
export const uploadMemberAvatar = createAsyncThunk(
  "members/avatar",
  async ({ userId, file }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.form(`/users/${userId}/avatar`, fd);
      return { userId, avatarUrl: data?.avatarUrl };
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

const slice = createSlice({
  name: "members",
  initialState: {
    items: [],
    status: "idle",
    mutating: false,
    error: null,
    roleFilter: "",
  },
  reducers: {
    setRoleFilter(s, a) {
      s.roleFilter = a.payload;
    },
    clearMembersError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMembers.pending, (s) => {
      s.status = "loading";
    })
      .addCase(fetchMembers.fulfilled, (s, a) => {
        s.status = "idle";
        s.items = a.payload;
      })
      .addCase(fetchMembers.rejected, (s, a) => {
        s.status = "error";
        s.error = a.payload?.message;
      });

    b.addCase(addMember.pending, (s) => {
      s.mutating = true;
      s.error = null;
    })
      .addCase(addMember.fulfilled, (s) => {
        s.mutating = false;
      })
      .addCase(addMember.rejected, (s, a) => {
        s.mutating = false;
        s.error = a.payload?.message;
      });

    b.addCase(changeMemberRole.fulfilled, (s, a) => {
      const m = s.items.find((x) => x.userId === a.payload.userId);
      if (m) m.role = a.payload.role;
    });

    b.addCase(removeMember.fulfilled, (s, a) => {
      s.items = s.items.filter((m) => m.userId !== a.payload);
    });

    b.addCase(updateMemberProfile.pending, (s) => {
      s.mutating = true;
      s.error = null;
    })
      .addCase(updateMemberProfile.fulfilled, (s, a) => {
        s.mutating = false;
        const m = s.items.find((x) => x.userId === a.payload.userId);
        if (m) {
          if (a.payload.name !== undefined) m.name = a.payload.name;
          m.aboutHtml = a.payload.aboutHtml;
        }
      })
      .addCase(updateMemberProfile.rejected, (s, a) => {
        s.mutating = false;
        s.error = a.payload?.message;
      });

    b.addCase(uploadMemberAvatar.fulfilled, (s, a) => {
      const m = s.items.find((x) => x.userId === a.payload.userId);
      if (m && a.payload.avatarUrl) m.avatarUrl = a.payload.avatarUrl;
    });
  },
});

export const { setRoleFilter, clearMembersError } = slice.actions;
export default slice.reducer;
