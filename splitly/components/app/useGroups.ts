"use client";

import type { Group } from "@/lib/domain/types";
import { useLoad } from "./AppProvider";

/** The groups a person is in, read whole: for the screens that look across them. Archived groups are left out. */
export function useGroups() {
  return useLoad(async (store) => {
    const list = await store.listGroups();
    const groups = await Promise.all(list.filter((group) => !group.archivedAt).map((group) => store.getGroup(group.id)));
    return groups.filter((group): group is Group => group !== null);
  }, "groups:whole");
}
