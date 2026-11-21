import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api, withPage, pageResult, EMPTY_PAGE, PAGE_SIZE, PAGE_SIZE_ALL } from "@/lib/api";

const membersPath = (role) => (role ? `/members?role=${encodeURIComponent(role)}` : "/members");

// GET /api/members?role=&start=&offset=
//   role: admin | author | learner (optional; default is everyone with a role)
//   -> { members, total? }
// One page for the Users / Authors / Members tables.
export const fetchMembers = createAsyncThunk(
  "members/list",
  async ({ role = "", start = 0, offset = PAGE_SIZE } = {}, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(membersPath(role), { start, offset }));
      return pageResult(data.members || [], data.total, { start, offset });
    } catch (e) {
      return rejectWithValue({ code: e.code, message: e.message });
    }
  }
);

// Every author, for the "Author" dropdown when creating a course. Kept apart
// from the paged table so opening the dropdown never replaces the table rows.
export const fetchAuthorOptions = createAsyncThunk(
  "members/authorOptions",
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.get(withPage(membersPath("author"), { start: 0, offset: PAGE_SIZE_ALL }));
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
    page: EMPTY_PAGE,
    authorOptions: [],
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
        s.items = a.payload.items;
        s.page = a.payload.page;
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

    b.addCase(fetchAuthorOptions.fulfilled, (s, a) => {
      s.authorOptions = a.payload;
    });

    // The page refetches after a removal to pull the next row up.
    b.addCase(removeMember.fulfilled, (s, a) => {
      s.items = s.items.filter((m) => m.userId !== a.payload);
      if (s.page.total != null) s.page.total = Math.max(0, s.page.total - 1);
      s.authorOptions = s.authorOptions.filter((m) => m.userId !== a.payload);
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
