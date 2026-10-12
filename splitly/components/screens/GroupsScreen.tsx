"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import { fill } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money/currency";
import { preferredCurrency } from "@/lib/preferences";
import { StoreError } from "@/lib/store/types";
import { GroupCard } from "./parts";

/** Every group, a search over them, and a way to make another. */
export function GroupsScreen() {
  const { t, store, base, changed, notify } = useApp();
  const router = useRouter();
  const { data: groups, error } = useLoad((current) => current.listGroups(), "groups");

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  // The currency they chose in their profile, if they did; asked for when the form is opened, not while the page is prepared.
  const [chosen, setCurrency] = useState<string | null>(null);
  const currency = chosen ?? (creating ? preferredCurrency() : "TRY");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ name?: string; form?: string }>({});

  const needle = query.trim().toLocaleLowerCase();
  const shown = groups?.filter((group) => group.name.toLocaleLowerCase().includes(needle)) ?? [];

  async function create(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 1 || name.trim().length > 80) return setProblem({ name: t.groups.nameProblem });
    setBusy(true);
    setProblem({});
    try {
      const id = await store.createGroup({ name, baseCurrency: currency });
      changed();
      notify(t.groups.created);
      router.push(`${base}/groups/${id}`);
    } catch (caught) {
      setProblem(
        caught instanceof StoreError && caught.details.field === "name" ? { name: t.groups.nameProblem } : { form: errorText(t, caught) },
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="type-title">{t.groups.title}</h1>
          <p className="type-lead text-ink-muted mt-2">{t.groups.lead}</p>
        </div>
      </div>

      {!creating ? (
        <Button className="mt-6" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" className="size-5" />
          {t.groups.create}
        </Button>
      ) : (
        <form onSubmit={create} noValidate aria-labelledby="new-group" className="card mt-6 flex flex-col gap-4 p-5 sm:p-6">
          <h2 id="new-group" className="type-heading">
            {t.groups.create}
          </h2>
          <Field label={t.groups.name} error={problem.name}>
            {(control) => (
              <input
                {...control}
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.groups.namePlaceholder}
                maxLength={80}
                autoFocus
                autoComplete="off"
              />
            )}
          </Field>
          <Field label={t.groups.currency} hint={t.groups.currencyHint}>
            {(control) => (
              <select {...control} className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            )}
          </Field>
          {problem.form && <Problem>{problem.form}</Problem>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={busy}>
              {t.groups.createSubmit}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}

      {error && <Problem className="mt-6">{errorText(t, error)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}

      {groups && groups.length === 0 && <p className="text-ink-muted mt-8">{t.groups.empty}</p>}
      {groups && groups.length > 0 && (
        <section aria-label={t.groups.title} className="mt-8">
          <div className="relative mb-4">
            <Search aria-hidden="true" className="text-ink-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
            <input
              type="search"
              aria-label={t.groups.search}
              placeholder={t.groups.search}
              className={`${inputClass} pl-11`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {shown.length === 0 ? (
            <p role="status" className="text-ink-muted">
              {fill(t.groups.nothingFound, { query: query.trim() })}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
