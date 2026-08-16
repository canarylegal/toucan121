"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/current-user";
import {
  acceptConnection,
  findUserByConnectionLookup,
  removeConnection,
  requestConnection,
} from "@/lib/connections";

export type ConnectionLookupState = {
  error?: string;
  success?: string;
};

const LOOKUP_SUCCESS =
  "If that email or profile has a Toucan account, they'll see your request.";

function revalidateConnectionPaths(hostSlug?: string) {
  revalidatePath("/dash/connections");
  revalidatePath("/dash");
  if (hostSlug) revalidatePath(`/${hostSlug}`);
}

export async function requestConnectionByUserIdAction(formData: FormData) {
  const user = await requireUser();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const hostSlug = String(formData.get("hostSlug") ?? "").trim();
  const result = await requestConnection({
    fromUserId: user.id,
    toUserId: targetUserId,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  revalidateConnectionPaths(hostSlug || undefined);
}

export async function requestConnectionByLookupAction(
  _prev: ConnectionLookupState,
  formData: FormData,
): Promise<ConnectionLookupState> {
  const user = await requireUser();
  const lookup = String(formData.get("lookup") ?? "").trim();
  if (!lookup) {
    return { error: "Enter an email or profile path" };
  }

  const found = await findUserByConnectionLookup(lookup);
  if (!found) {
    return { success: LOOKUP_SUCCESS };
  }

  const result = await requestConnection({
    fromUserId: user.id,
    toUserId: found.id,
  });
  if (!result.ok) {
    return { error: result.error };
  }
  if (result.outcome === "already_connected") {
    return { success: "You're already connected." };
  }
  if (result.outcome === "accepted") {
    revalidateConnectionPaths();
    return { success: "You're now connected." };
  }

  revalidateConnectionPaths();
  return { success: LOOKUP_SUCCESS };
}

export async function acceptConnectionAction(formData: FormData) {
  const user = await requireUser();
  const connectionId = String(formData.get("connectionId") ?? "");
  const parsed = z.string().min(1).safeParse(connectionId);
  if (!parsed.success) throw new Error("Request not found");
  const result = await acceptConnection({
    userId: user.id,
    connectionId: parsed.data,
  });
  if (!result.ok) throw new Error(result.error);
  const hostSlug = String(formData.get("hostSlug") ?? "").trim();
  revalidateConnectionPaths(hostSlug || undefined);
}

export async function removeConnectionAction(formData: FormData) {
  const user = await requireUser();
  const connectionId = String(formData.get("connectionId") ?? "");
  const parsed = z.string().min(1).safeParse(connectionId);
  if (!parsed.success) throw new Error("Connection not found");
  const result = await removeConnection({
    userId: user.id,
    connectionId: parsed.data,
  });
  if (!result.ok) throw new Error(result.error);
  const hostSlug = String(formData.get("hostSlug") ?? "").trim();
  revalidateConnectionPaths(hostSlug || undefined);
}
