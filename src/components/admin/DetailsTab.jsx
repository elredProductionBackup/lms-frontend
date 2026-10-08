"use client";

import { useRef, useState, useEffect } from "react";
import { ImagePlus, Save, Send, Archive, X, ImageIcon } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  updateCourse,
  uploadThumbnail,
  uploadCourseImages,
  removeCourseImage,
  publishCourse,
  archiveCourse,
} from "@/store/slices/coursesSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { Card } from "@/components/ui/Shell";
import { Button, Badge } from "@/components/ui/Primitives";
import { Input, Textarea, Fieldset } from "@/components/ui/Field";
import { mediaUrl } from "@/lib/api";

export default function DetailsTab({ course }) {
  const dispatch = useAppDispatch();
  const thumbRef = useRef(null);
  const galleryRef = useRef(null);
  const { mutating } = useAppSelector((s) => s.courses);
  const [title, setTitle] = useState(course.title || "");
  const [detailsHtml, setDetailsHtml] = useState(course.detailsHtml || "");
  const courseId = course._id;

  useEffect(() => {
    setTitle(course.title || "");
    setDetailsHtml(course.detailsHtml || "");
  }, [course._id]); // eslint-disable-line

  const save = async () => {
    const res = await dispatch(updateCourse({ id: courseId, patch: { title, detailsHtml } }));
    if (updateCourse.fulfilled.match(res)) dispatch(pushToast("Course saved", "success"));
  };

  const onThumb = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await dispatch(uploadThumbnail({ id: courseId, file }));
    if (uploadThumbnail.fulfilled.match(res)) dispatch(pushToast("Thumbnail updated", "success"));
    e.target.value = "";
  };

  const onGallery = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const res = await dispatch(uploadCourseImages({ id: courseId, files }));
    if (uploadCourseImages.fulfilled.match(res)) dispatch(pushToast("Images added", "success"));
    e.target.value = "";
  };

  const publish = async () => {
    const res = await dispatch(publishCourse(courseId));
    if (publishCourse.fulfilled.match(res)) dispatch(pushToast("Course published", "success"));
  };

  const archive = async () => {
    if (!confirm("Archive this course? All active enrollments will be revoked.")) return;
    const res = await dispatch(archiveCourse(courseId));
    if (archiveCourse.fulfilled.match(res)) dispatch(pushToast("Course archived", "success"));
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">Content</h3>
          <Badge tone={course.status}>{course.status}</Badge>
        </div>
        <div className="space-y-4">
          <Fieldset label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Fieldset>
          <Fieldset label="Details" hint="HTML allowed">
            <Textarea rows={5} value={detailsHtml} onChange={(e) => setDetailsHtml(e.target.value)} />
          </Fieldset>
          <div className="flex justify-end">
            <Button variant="teal" onClick={save} loading={mutating}>
              <Save size={16} /> Save changes
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 font-serif text-lg text-ink">Thumbnail & gallery</h3>
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">Thumbnail</p>
            <button
              onClick={() => thumbRef.current?.click()}
              className="group relative flex h-28 w-44 items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 bg-cream-100"
            >
              {course.thumbnailUrl ? (
                <img src={mediaUrl(course.thumbnailUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-ink-muted">
                  <ImageIcon size={22} strokeWidth={1.5} />
                  <span className="text-xs">Add thumbnail</span>
                </span>
              )}
            </button>
            <input ref={thumbRef} type="file" accept="image/*" hidden onChange={onThumb} />
          </div>

          <div className="flex-1">
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">Gallery</p>
            <div className="flex flex-wrap gap-2">
              {(course.images || []).map((url) => (
                <div key={url} className="group relative h-20 w-28 overflow-hidden rounded-lg">
                  <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => dispatch(removeCourseImage({ id: courseId, url }))}
                    className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex h-20 w-28 items-center justify-center rounded-lg border border-dashed border-ink/20 text-ink-muted hover:bg-cream-100"
              >
                <ImagePlus size={20} strokeWidth={1.5} />
              </button>
              <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onGallery} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex items-center justify-between p-6">
        <div>
          <h3 className="font-serif text-lg text-ink">Publishing</h3>
          <p className="text-sm text-ink-muted">
            {course.status === "published"
              ? "This course is live in the catalog."
              : "Publish to make it visible to enrolled learners."}
          </p>
        </div>
        <div className="flex gap-2">
          {course.status !== "archived" && (
            <Button variant="danger" onClick={archive}>
              <Archive size={16} /> Archive
            </Button>
          )}
          <Button variant="teal" onClick={publish} loading={mutating}>
            <Send size={16} /> {course.status === "published" ? "Re-publish" : "Publish"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
