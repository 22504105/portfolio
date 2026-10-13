"use client";

import {
  Camera,
  Focus,
  ImagePlus,
  ImageUp,
  Keyboard,
  Lock,
  ReceiptText,
  RotateCw,
  ScanLine,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import { errorText, useApp, useLoad } from "@/components/app/AppProvider";
import { Button, Field, inputClass, Loading, Problem } from "@/components/ui/controls";
import type { Group } from "@/lib/domain/types";
import { fill } from "@/lib/i18n";
import { checkFile, hashOf, prepare, type ImageProblem, type ImageType, type Turn } from "@/lib/receipt/image";
import { OCR_LANGUAGES, OcrError, recognise, type OcrFailure, type OcrLanguage } from "@/lib/receipt/ocr";
import { mergeReadings, parseReceipt } from "@/lib/receipt/parse";
import { cn } from "@/lib/utils";
import { AssignStep, ResultStep, type Outcome } from "./AssignStep";
import { draftFrom, readCorrections, readTranslate, rememberTranslate, withTranslation, type Draft } from "./draft";
import { ReviewStep } from "./ReviewStep";
import { ScanHeader } from "./ScanHeader";

// The scanner, after the concept's screens 4 to 7: a photo of a receipt, read
// on the device, checked by the person, given out line by line, and stored as
// one expense. At every point where reading fails there is a way on by hand.

type Photo = { file: Blob; type: ImageType; hash: string; turn: Turn; enhance: boolean; preview: string };
type Step =
  | { name: "capture" }
  | { name: "reading"; fraction: number }
  | { name: "review" | "assign"; draft: Draft; hash: string; type: ImageType; fromPhoto: boolean }
  | { name: "result"; outcome: Outcome };

const LANGUAGE_OF_CURRENCY: Record<string, OcrLanguage> = { TRY: "tur", RUB: "rus", KZT: "rus", UAH: "rus" };

export function ScanScreen() {
  const { t, base } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: groups, error } = useLoad((store) => store.listGroups(), "groups");
  const open = groups?.filter((group) => !group.archivedAt) ?? [];
  const groupId = params.get("group") ?? open[0]?.id ?? null;
  const { data: group, error: groupError } = useLoad(async (store) => (groupId ? store.getGroup(groupId) : null), `group:${groupId}`);

  return (
    <>
      {(error || groupError) && <Problem className="mt-6">{errorText(t, error ?? groupError)}</Problem>}
      {!groups && !error && <Loading label={t.common.loading} />}
      {groups && open.length === 0 && (
        <>
          <h1 className="type-title">{t.scan.title}</h1>
          <p className="text-ink-muted mt-3">{t.expense.noGroups}</p>
          <Link
            href={`${base}/groups`}
            className="rounded-control bg-primary text-on-primary mt-5 inline-flex h-12 items-center px-5 font-semibold"
          >
            {t.groups.create}
          </Link>
        </>
      )}
      {groups && open.length > 0 && group === undefined && !groupError && <Loading label={t.common.loading} />}
      {group === null && <Problem className="mt-6">{t.errors.not_found}</Problem>}
      {group && group.archivedAt && <Problem className="mt-6">{t.group.archivedNote}</Problem>}
      {group && !group.archivedAt && (
        <Flow
          key={group.id}
          group={group}
          groups={open.map((item) => ({ id: item.id, name: item.name }))}
          onGroup={(id) => router.replace(`${base}/scan?group=${id}`)}
        />
      )}
    </>
  );
}

function Flow({ group, groups, onGroup }: { group: Group; groups: { id: string; name: string }[]; onGroup: (id: string) => void }) {
  const { t, base, locale } = useApp();
  const [step, setStep] = useState<Step>({ name: "capture" });
  const [language, setLanguage] = useState<OcrLanguage>(LANGUAGE_OF_CURRENCY[group.baseCurrency] ?? "eng");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  // Names are shown as printed unless this person has asked, here before, for them to be translated.
  // (Their choice is kept on the device and looked up when a receipt is read; null until it is changed here.)
  const [chosen, setTranslate] = useState<boolean | null>(null);
  const wantsTranslation = () => chosen ?? readTranslate();
  const picker = useRef<HTMLInputElement>(null);
  const currency = group.baseCurrency;

  // The preview's address is this page's own; let go of it when the photo changes or the screen closes.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.preview)), [photo]);
  // A new step starts at the top of the screen.
  // (In braces: newer browsers return a promise from scrollTo, and an effect may only return a clean-up.)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step.name]);

  async function take(file: Blob) {
    setProblem(null);
    setCamera(false);
    const wrong = checkFile(file);
    if (wrong) return setProblem(t.scan.imageProblems[wrong]);
    try {
      // Opening it now finds a broken or absurdly sized file before anything else happens.
      const shown = await prepare(file, 0, false);
      setPhoto({
        file,
        type: file.type as ImageType,
        hash: await hashOf(file),
        turn: 0,
        enhance: false,
        preview: URL.createObjectURL(shown.blob),
      });
    } catch (caught) {
      setProblem(
        t.scan.imageProblems[
          ((caught as Error).message as ImageProblem) in t.scan.imageProblems ? ((caught as Error).message as ImageProblem) : "unreadable"
        ],
      );
    }
  }

  async function adjust(change: Partial<Pick<Photo, "turn" | "enhance">>) {
    if (!photo) return;
    const next = { ...photo, ...change };
    const shown = await prepare(photo.file, next.turn, next.enhance);
    setPhoto({ ...next, preview: URL.createObjectURL(shown.blob) });
  }

  async function read() {
    if (!photo) return;
    setProblem(null);
    setStep({ name: "reading", fraction: 0 });
    try {
      // Read twice, prepared in two ways: each way loses different rows, and together they find more.
      const plain = await prepare(photo.file, photo.turn, photo.enhance);
      const evened = await prepare(photo.file, photo.turn, false, "evened");
      const readings = await recognise([plain.blob, evened.blob], language, (fraction) => setStep({ name: "reading", fraction }));
      const parsed = readings.map((lines) => parseReceipt(lines, currency)).reduce(mergeReadings);
      if (parsed.lines.length === 0) throw new OcrError("empty");
      setStep({
        name: "review",
        draft: draftFrom(parsed, currency, locale, readCorrections(), wantsTranslation(), (n) => `${t.scan.kinds.item} ${n}`),
        hash: photo.hash,
        type: photo.type,
        fromPhoto: true,
      });
    } catch (caught) {
      const reason: OcrFailure = caught instanceof OcrError ? caught.reason : "engine";
      setProblem(t.scan.ocrProblems[reason]);
      setStep({ name: "capture" });
    }
  }

  /** No photo, or a photo that could not be read: the same review screen, with the lines typed in. */
  async function byHand() {
    // Something has to stand where a photo's hash would be; it is unique, so nothing is ever taken for a repeat of it.
    const hash = photo?.hash ?? (await hashOf(new Blob([crypto.randomUUID()])));
    setProblem(null);
    setStep({
      name: "review",
      draft: { lines: [], printedTotal: "", includedTaxMinor: null, unmatched: [] },
      hash,
      type: photo?.type ?? "image/jpeg",
      fromPhoto: false,
    });
  }

  if (step.name === "review") {
    return (
      <ReviewStep
        group={group}
        draft={step.draft}
        fromPhoto={step.fromPhoto}
        translate={wantsTranslation()}
        onTranslate={(on) => {
          setTranslate(on);
          rememberTranslate(on);
          setStep({ ...step, draft: withTranslation(step.draft, locale, readCorrections(), on) });
        }}
        onChange={(draft) => setStep({ ...step, draft })}
        onBack={() => setStep({ name: "capture" })}
        onContinue={() => setStep({ ...step, name: "assign" })}
      />
    );
  }
  if (step.name === "assign") {
    return (
      <AssignStep
        group={group}
        draft={step.draft}
        contentHash={step.hash}
        mimeType={step.type}
        onChange={(draft) => setStep({ ...step, draft })}
        onBack={() => setStep({ ...step, name: "review" })}
        onDone={(outcome) => setStep({ name: "result", outcome })}
      />
    );
  }
  if (step.name === "result") {
    return (
      <ResultStep
        group={group}
        outcome={step.outcome}
        onAnother={() => {
          setPhoto(null);
          setStep({ name: "capture" });
        }}
      />
    );
  }

  return (
    <>
      <ScanHeader title={t.scan.title} stage="capture" back={`${base}/groups/${group.id}`} />

      {step.name === "reading" ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-stage rounded-sheet mt-5 flex flex-col items-center gap-4 px-6 py-12 text-center text-white"
        >
          <ScanLine aria-hidden="true" className="text-mint size-10 animate-pulse" />
          <p className="type-heading">{fill(t.scan.reading, { n: Math.round(step.fraction * 100) })}</p>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              className="bg-mint h-full rounded-full transition-[width]"
              style={{ width: `${Math.max(4, Math.round(step.fraction * 100))}%` }}
            />
          </div>
          <p className="type-small text-white/80">{t.scan.readingHint}</p>
        </div>
      ) : (
        <>
          {problem && (
            <div className="mt-5 flex flex-col items-start gap-3">
              <Problem>{problem}</Problem>
              <Button variant="secondary" small onClick={byHand}>
                <Keyboard aria-hidden="true" className="size-4" />
                {t.scan.manual}
              </Button>
            </div>
          )}

          {/* The viewfinder: dark in both themes, as a camera is. */}
          <div className="bg-stage rounded-sheet relative mt-5 overflow-hidden text-white">
            {photo ? (
              // The person's own photo, shown from memory: not a file of the site.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt={t.scan.photo} className="mx-auto max-h-[58dvh] w-auto max-w-full object-contain" />
            ) : (
              <div className="flex aspect-square max-h-[44dvh] w-full flex-col items-center justify-center gap-3 px-12 text-center">
                <Corners className="border-mint/80 inset-5" />
                <ReceiptText aria-hidden="true" className="text-mint size-10" />
                <p className="type-small text-white/85">{t.scan.lead}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[0.8125rem] leading-5 font-medium">
                  <Focus aria-hidden="true" className="size-4 shrink-0" />
                  {t.scan.frameHint}
                </p>
              </div>
            )}
          </div>

          {photo ? (
            <>
              <div className="card mt-3 grid grid-cols-3 gap-2 p-2.5">
                <Tile icon={RotateCw} label={t.scan.rotate} onClick={() => adjust({ turn: ((photo.turn + 90) % 360) as Turn })} />
                <Tile
                  icon={Sparkles}
                  label={t.scan.enhance}
                  aria-pressed={photo.enhance}
                  onClick={() => adjust({ enhance: !photo.enhance })}
                />
                <Tile icon={ImagePlus} label={t.scan.retake} onClick={() => setPhoto(null)} />
              </div>
              <Button className="mt-3 h-14 w-full text-[1.0625rem]" onClick={read}>
                <ScanLine aria-hidden="true" className="size-5" />
                {t.scan.read}
              </Button>
            </>
          ) : (
            <div className="card mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-2.5">
              <Tile icon={ImageUp} label={t.scan.upload} onClick={() => picker.current?.click()} />
              <button
                type="button"
                onClick={() => setCamera(true)}
                aria-label={t.scan.camera}
                title={t.scan.camera}
                className="bg-primary text-on-primary hover:bg-primary-hover ring-accent-soft mx-2 flex size-18 items-center justify-center rounded-full ring-8 transition-colors"
              >
                <Camera aria-hidden="true" className="size-7" />
              </button>
              <Tile icon={Keyboard} label={t.scan.manual} onClick={byHand} />
            </div>
          )}
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t.scan.upload}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void take(file);
            }}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {groups.length > 1 && (
              <Field label={t.expense.group}>
                {(control) => (
                  <select {...control} className={inputClass} value={group.id} onChange={(event) => onGroup(event.target.value)}>
                    {groups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <Field label={t.scan.language} hint={t.scan.languageHint}>
              {(control) => (
                <select
                  {...control}
                  className={inputClass}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as OcrLanguage)}
                >
                  {OCR_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {t.scan.languages[code]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <p className="type-small bg-surface-2 text-ink-muted rounded-control mt-4 flex items-start gap-2.5 p-3.5">
            <Lock aria-hidden="true" className="text-positive mt-0.5 size-4 shrink-0" />
            {t.scan.privacy}
          </p>
        </>
      )}

      {camera && (
        <CameraView
          onShot={take}
          onClose={() => setCamera(false)}
          onUnavailable={(message) => (setCamera(false), setProblem(message), picker.current?.click())}
        />
      )}
    </>
  );
}

/** One of the squares in the tray under the viewfinder: a picture with its word beneath. */
function Tile({ icon: Icon, label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "bg-surface-2 text-ink hover:bg-accent-soft rounded-control aria-pressed:bg-accent-soft aria-pressed:text-on-accent aria-pressed:ring-primary flex min-h-18 flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-center text-[0.75rem] leading-4 font-medium transition-colors aria-pressed:ring-2",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-5.5" />
      {label}
    </button>
  );
}

/** The frame to aim with: four corners, as in the concept. */
function Corners({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute", className)}>
      {[
        "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
        "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
        "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
        "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
      ].map((corner) => (
        <span key={corner} className={cn("absolute size-10 border-inherit", corner)} />
      ))}
    </div>
  );
}

/** The concept's camera screen: the picture from the back camera, a frame to aim with, and a shutter. */
function CameraView({
  onShot,
  onClose,
  onUnavailable,
}: {
  onShot: (photo: Blob) => void;
  onClose: () => void;
  onUnavailable: (message: string) => void;
}) {
  const { t } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const unavailable = useRef(onUnavailable);
  useEffect(() => {
    unavailable.current = onUnavailable;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let closed = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return unavailable.current(t.scan.cameraMissing);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (closed) return stream.getTracks().forEach((track) => track.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
          setReady(true);
        }
      } catch (caught) {
        // Refused, or there is no camera: say which, and offer the photo picker instead.
        unavailable.current((caught as DOMException)?.name === "NotAllowedError" ? t.scan.cameraDenied : t.scan.cameraMissing);
      }
    })();
    return () => {
      closed = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [t]);

  function shoot() {
    const source = video.current;
    if (!source || !source.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
    canvas.toBlob((blob) => blob && onShot(blob), "image/jpeg", 0.92);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.scan.camera} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="inline-flex size-12 items-center justify-center rounded-full"
        >
          <X aria-hidden="true" className="size-6" />
        </button>
        <p className="type-small font-semibold">{t.scan.frameHint}</p>
        <span className="size-12" />
      </div>
      <div className="relative min-h-0 flex-1">
        <video ref={video} playsInline muted className="size-full object-cover" />
        <Corners className="inset-x-[8%] inset-y-[6%] border-white" />
      </div>
      <div className="flex items-center justify-center pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label={t.scan.shutter}
          className="flex size-18 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="size-13 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
