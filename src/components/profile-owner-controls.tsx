"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";

export function ProfileOwnerControls({
  initial,
  startEditing = false,
}: {
  initial: ProfileFormValues;
  startEditing?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(
    startEditing || searchParams.get("edit") === "1",
  );

  function closeEdit() {
    setEditing(false);
    if (searchParams.get("edit") === "1") {
      router.replace(pathname);
    }
  }

  if (!editing) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-line bg-panel px-4 py-2 text-sm font-semibold hover:bg-accent-soft"
        >
          Edit profile
        </button>
      </div>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-accent/40 bg-panel p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Edit your public profile</h2>
        <p className="mt-1 text-sm text-muted">
          Changes appear here the way visitors see them. Saving closes this
          panel.
        </p>
      </div>
      <div className="mt-5">
        <ProfileForm
          initial={initial}
          variant="inline"
          onSaved={closeEdit}
        />
      </div>
    </section>
  );
}
