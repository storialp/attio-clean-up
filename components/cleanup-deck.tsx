"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { DeletionLogItem, SimplifiedCompany } from "@/lib/types";

const LOAD_THRESHOLD = 5;
const SWIPE_THRESHOLD = 110;

type DragState = {
  pointerId: number;
  startX: number;
};

export function CleanupDeck() {
  const [deck, setDeck] = useState<SimplifiedCompany[]>([]);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [status, setStatus] = useState("Load companies to start reviewing your Attio workspace.");
  const [logItems, setLogItems] = useState<DeletionLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const dragStateRef = useRef<DragState | null>(null);
  const dragXRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const deckRef = useRef<SimplifiedCompany[]>([]);
  const nextOffsetRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const isSwipingRef = useRef(false);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    nextOffsetRef.current = nextOffset;
  }, [nextOffset]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isSwipingRef.current = isSwiping;
  }, [isSwiping]);

  useEffect(() => {
    refreshLog();
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        void handleSwipe("delete");
      }
      if (event.key === "ArrowRight") {
        void handleSwipe("keep");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadCompanies(reset = false) {
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    if (reset) {
      setStatus("Loading companies from Attio...");
    }

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offset: reset ? null : nextOffsetRef.current,
        }),
      });

      const payload = (await response.json()) as {
        companies?: SimplifiedCompany[];
        nextOffset?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load companies.");
      }

      const companies = payload.companies ?? [];
      const nextDeck = reset ? companies : [...deckRef.current, ...companies];
      deckRef.current = nextDeck;
      nextOffsetRef.current = payload.nextOffset ?? null;
      setDeck(nextDeck);
      setNextOffset(payload.nextOffset ?? null);
      setStatus(
        nextDeck.length
          ? "Swipe left to delete. Swipe right to keep."
          : "No companies came back from Attio.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load companies.");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }

  async function refreshLog() {
    try {
      const response = await fetch("/api/deletions", { cache: "no-store" });
      const payload = (await response.json()) as {
        items?: DeletionLogItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load deletion log.");
      }

      const items = payload.items ?? [];
      setLogItems(items);
      setDeletedCount(items.length);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load deletion log.");
    }
  }

  async function handleLoadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeck([]);
    setNextOffset(null);
    setDragX(0);
    dragXRef.current = 0;
    await loadCompanies(true);
    await refreshLog();
  }

  async function handleSwipe(action: "keep" | "delete") {
    if (!deckRef.current.length || isSwipingRef.current) {
      return;
    }

    const company = deckRef.current[0];
    const remainingDeck = deckRef.current.slice(1);
    const previousDeck = deckRef.current;

    isSwipingRef.current = true;
    setIsSwiping(true);
    setDragX(action === "delete" ? -540 : 540);
    dragXRef.current = action === "delete" ? -540 : 540;

    window.setTimeout(() => {
      dragXRef.current = 0;
      setDragX(0);
    }, 120);

    deckRef.current = remainingDeck;
    startTransition(() => {
      setDeck(remainingDeck);
    });
    setStatus(action === "delete" ? `${company.name} deleted.` : `${company.name} kept.`);

    if (action === "delete") {
      setDeletedCount((count) => count + 1);
      showToast(`Deleted ${company.name}`);
      void refreshLog();
    } else {
      showToast(`Kept ${company.name}`);
    }

    if (remainingDeck.length < LOAD_THRESHOLD && nextOffsetRef.current) {
      void loadCompanies(false);
    }

    try {
      const response = await fetch("/api/swipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          company,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to process swipe.");
      }
      if (action === "delete") {
        void refreshLog();
      }
    } catch (error) {
      deckRef.current = previousDeck;
      setDeck(previousDeck);
      if (action === "delete") {
        setDeletedCount((count) => Math.max(0, count - 1));
      }
      dragXRef.current = 0;
      setStatus(error instanceof Error ? error.message : "Unable to process swipe.");
    } finally {
      isSwipingRef.current = false;
      setIsSwiping(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800);
  }

  function onPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (isSwipingRef.current || !deckRef.current.length) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || isSwipingRef.current) {
      return;
    }

    const nextDragX = event.clientX - dragState.startX;
    dragXRef.current = nextDragX;
    setDragX(nextDragX);
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (dragXRef.current <= -SWIPE_THRESHOLD) {
      void handleSwipe("delete");
      return;
    }

    if (dragXRef.current >= SWIPE_THRESHOLD) {
      void handleSwipe("keep");
      return;
    }

    setDragX(0);
    dragXRef.current = 0;
  }

  function onPointerCancel() {
    dragStateRef.current = null;
    setDragX(0);
    dragXRef.current = 0;
  }

  const topCard = deck[0];
  const nextCard = deck[1];
  const thirdCard = deck[2];
  const topCardStyle = {
    transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
    opacity: Math.max(0.5, 1 - Math.abs(dragX) / 420),
  };

  return (
    <main className="page-shell">
      <aside className="side-panel">
        <p className="eyebrow">Attio Cleanup Deck</p>
        <h1>Swipe through companies like a live deletion queue.</h1>
        <p className="lede">
          Left deletes the record in Attio and writes a Postgres audit log. Right keeps it and moves on.
        </p>

        <form className="api-form" onSubmit={handleLoadSubmit}>
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Load companies"}
          </button>
        </form>

        <div className="status-strip">
          <div>
            <span className="status-label">Deck</span>
            <strong>{deck.length} ready</strong>
          </div>
          <div>
            <span className="status-label">Deleted</span>
            <strong>{deletedCount} logged</strong>
          </div>
        </div>

        <div className="shortcut-card">
          <span>Controls</span>
          <p>Drag the top card, tap the buttons, or use the arrow keys.</p>
          <div className="shortcut-row">
            <kbd>&larr;</kbd>
            <span>Delete</span>
          </div>
          <div className="shortcut-row">
            <kbd>&rarr;</kbd>
            <span>Keep</span>
          </div>
        </div>

        <section className="log-panel">
          <div className="section-head">
            <p>Deletion log</p>
            <button type="button" className="ghost-button" onClick={() => void refreshLog()}>
              Refresh
            </button>
          </div>

          <div className="log-list">
            {logItems.length ? (
              logItems.map((item) => (
                <div className="log-item" key={item.id}>
                  <div>
                    <strong>{item.companyName || "Untitled company"}</strong>
                    <p>{item.primaryDomain || "No primary domain"}</p>
                  </div>
                  <p>{new Date(item.deletedAt).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No deletions recorded yet.</p>
            )}
          </div>
        </section>
      </aside>

      <section className="deck-panel">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <div className="deck-frame">
          <div className="deck-caption">
            <div>
              <p className="eyebrow">Decision deck</p>
              <p>{status}</p>
            </div>
          </div>

          <div className="swipe-stage">
            <div className="swipe-hint swipe-hint-left">Delete</div>
            <div className="swipe-hint swipe-hint-right">Keep</div>

            <div className="card-stack">
              {thirdCard ? <PreviewCard company={thirdCard} className="third-card" /> : null}
              {nextCard ? <PreviewCard company={nextCard} className="next-card" /> : null}

              {topCard ? (
                <TopCard
                  company={topCard}
                  style={topCardStyle}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                />
              ) : (
                <EmptyCard />
              )}
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="danger-button" onClick={() => void handleSwipe("delete")}>
              Swipe left
            </button>
            <button type="button" className="safe-button" onClick={() => void handleSwipe("keep")}>
              Swipe right
            </button>
          </div>
        </div>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}

function PreviewCard({
  company,
  className,
}: {
  company: SimplifiedCompany;
  className: string;
}) {
  return (
    <article className={`company-card ${className}`}>
      <CardContent company={company} />
    </article>
  );
}

function TopCard({
  company,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  company: SimplifiedCompany;
  style: React.CSSProperties;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}) {
  return (
    <article
      className="company-card top-card"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <CardContent company={company} />
    </article>
  );
}

function CardContent({ company }: { company: SimplifiedCompany }) {
  return (
    <>
      <div className="card-noise" />
      <div className="card-topline">
        <span className="card-tag">Company</span>
        {company.webUrl ? (
          <a className="card-link" href={company.webUrl} target="_blank" rel="noreferrer">
            Open in Attio
          </a>
        ) : (
          <span className="card-link muted-link">No Attio link</span>
        )}
      </div>

      <div className="card-body">
        <p className="company-domain">{company.domain || "No primary domain"}</p>
        <h2 className="company-name">{company.name}</h2>
        <p className="company-description">
          {company.description || "No description available for this company in Attio."}
        </p>
      </div>

      <div className="card-meta">
        <div>
          <span>Employees</span>
          <strong>{company.employeeRange || "Unknown"}</strong>
        </div>
        <div>
          <span>Tags</span>
          <strong>{company.tags.length ? company.tags.join(", ") : "Uncategorized"}</strong>
        </div>
      </div>
    </>
  );
}

function EmptyCard() {
  return (
    <article className="company-card top-card">
      <div className="card-body">
        <p className="company-domain">Deck empty</p>
        <h2 className="company-name">Reload</h2>
        <p className="company-description">
          There are no companies ready to review right now. Load a fresh batch to keep going.
        </p>
      </div>
    </article>
  );
}
