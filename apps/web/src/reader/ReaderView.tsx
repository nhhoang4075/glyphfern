import {
  type PageCurl,
  type Paginator,
  clampPage,
  collectSegments,
  createPageCurl,
  createPaginator,
  drawPage,
  gapFor,
  step,
} from "@glyphfern/ui";
import {
  type CSSProperties,
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { indexBook } from "../app/bookIndex";
import { useApp } from "../app/useApp";
import { Button, IconButton } from "../ui";
import { Drawer, type DrawerTab } from "./Drawer";
import { Flow } from "./Flow";
import { TopBar } from "./TopBar";
import { TypePopover } from "./TypePopover";
import { type ActiveWord, WordPanel } from "./WordPanel";
import {
  CLOSED_REVEAL,
  type RevealState,
  bookmarksOnPage,
  chapterRows,
  escapeTarget,
  groupMembers,
  highlightClass,
  popoverPlacement,
  sentenceText,
  toggleReveal,
} from "./readerLogic";
import { parseSentenceKey, sentenceKey } from "./sentenceKey";

interface ViewState {
  page: number;
  pages: number;
  starts: number[];
}

interface PanelState {
  open: boolean;
  word: ActiveWord | null;
}

const BAR_REVEAL_MS = 3200;
const PULSE_MS = 900;
const WIPE_MS = 900;

function sameView(a: ViewState, b: ViewState): boolean {
  return (
    a.page === b.page &&
    a.pages === b.pages &&
    a.starts.length === b.starts.length &&
    a.starts.every((start, index) => start === b.starts[index])
  );
}

function bumpWordsDock() {
  const target = document.querySelector<HTMLElement>('nav.dock [data-route="words"]');
  target?.animate(
    [
      { transform: "scale(1)", easing: "cubic-bezier(.4,0,.2,1)" },
      { transform: "scale(1.2)", offset: 0.45, easing: "cubic-bezier(.4,0,.2,1)" },
      { transform: "scale(1)" },
    ],
    { duration: 560 },
  );
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ReaderView() {
  const { state, actions } = useApp();
  const { pack, preferences, route } = state;
  const visible = route === "read";
  const index = useMemo(() => indexBook(pack.book), [pack.book]);

  const rootRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const underFlowRef = useRef<HTMLDivElement>(null);
  const pageTopRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const shadowCreaseRef = useRef<HTMLDivElement>(null);
  const shadowFlapRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const cornerRightRef = useRef<HTMLDivElement>(null);
  const cornerLeftRef = useRef<HTMLDivElement>(null);
  const aaRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paginatorRef = useRef<Paginator | null>(null);
  const curlRef = useRef<PageCurl | null>(null);
  const pendingAnchor = useRef<string | null>(null);
  const frameRef = useRef(0);
  const barTimer = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const previousHighlights = useRef(preferences.hl);

  const [view, setView] = useState<ViewState>({ page: 0, pages: 1, starts: [] });
  const [panel, setPanel] = useState<PanelState>({ open: false, word: null });
  const [reveal, setReveal] = useState<RevealState>(CLOSED_REVEAL);
  const [popOpen, setPopOpen] = useState(false);
  const [placement, setPlacement] = useState({ right: 18, top: 60 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("toc");
  const [fullscreen, setFullscreen] = useState(false);
  const [barShown, setBarShown] = useState(false);

  const paginator = paginatorRef.current;
  const ranges = paginator?.ranges() ?? [];
  const spans = ranges.flatMap((range) => {
    const id = parseSentenceKey(range.id);
    return id === null ? [] : [{ id, startPage: range.startPage, endPage: range.endPage }];
  });
  const markedOnPage = bookmarksOnPage(spans, state.bookmarks, view.page);
  const bookmarked = markedOnPage.length > 0;

  const live = useRef({
    pack,
    bookmarks: state.bookmarks,
    spans,
    panelOpen: panel.open,
    popOpen,
    drawerOpen,
    fullscreen,
    turn: preferences.turn,
    visible,
  });
  live.current = {
    pack,
    bookmarks: state.bookmarks,
    spans,
    panelOpen: panel.open,
    popOpen,
    drawerOpen,
    fullscreen,
    turn: preferences.turn,
    visible,
  };

  const sync = useCallback(() => {
    const current = paginatorRef.current;
    if (!current) return;
    const starts = live.current.pack.book.chapters.map(
      (_, chapter) => current.chapterStartPages().get(chapter) ?? 0,
    );
    const next: ViewState = { page: current.current(), pages: current.pages(), starts };
    setView((previous) => (sameView(previous, next) ? previous : next));
  }, []);

  const relayout = useCallback(
    (anchor?: string) => {
      if (anchor !== undefined) pendingAnchor.current = anchor;
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = window.requestAnimationFrame(() => {
        const current = paginatorRef.current;
        const sheet = sheetRef.current;
        if (!current || !sheet || sheet.clientWidth === 0) return;
        const target = pendingAnchor.current ?? current.sentenceOnCurrentPage() ?? undefined;
        pendingAnchor.current = null;
        current.layout(target);
        sync();
      });
    },
    [sync],
  );

  const closePanel = useCallback(() => {
    setPanel((previous) => (previous.open ? { ...previous, open: false } : previous));
  }, []);

  const goTo = useCallback(
    (page: number) => {
      const current = paginatorRef.current;
      if (!current) return;
      current.go(page);
      sync();
    },
    [sync],
  );

  const goToSentence = useCallback(
    (sentenceId: number) => {
      const current = paginatorRef.current;
      const range = current?.ranges().find((candidate) => candidate.id === sentenceKey(sentenceId));
      closePanel();
      goTo(range?.startPage ?? 0);
    },
    [closePanel, goTo],
  );

  const turn = useCallback(
    (direction: 1 | -1) => {
      closePanel();
      const current = paginatorRef.current;
      if (!current) return;
      if (live.current.turn === "curl" && curlRef.current) {
        curlRef.current.turn(direction);
        return;
      }
      goTo(current.current() + direction);
    },
    [closePanel, goTo],
  );

  const openWord = useCallback((sentenceId: number, tokenIndex: number) => {
    const sentence = indexBook(live.current.pack.book).byId.get(sentenceId);
    if (!sentence || !sentence.tokens[tokenIndex]) return;
    setPanel({ open: true, word: { sentence, tokenIndex } });
    setReveal(CLOSED_REVEAL);
  }, []);

  const showBar = useCallback(() => {
    setBarShown(true);
    window.clearTimeout(barTimer.current);
    barTimer.current = window.setTimeout(() => {
      if (!live.current.popOpen && !live.current.drawerOpen) setBarShown(false);
    }, BAR_REVEAL_MS);
  }, []);

  const closeLayers = useCallback(() => {
    closePanel();
    setPopOpen(false);
    setDrawerOpen(false);
  }, [closePanel]);

  useEffect(() => {
    const flow = flowRef.current;
    const sheet = sheetRef.current;
    if (!flow || !sheet) return;
    paginatorRef.current = createPaginator({ flow, sheet });
    const observer = new ResizeObserver(() => relayout());
    observer.observe(sheet);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameRef.current);
      paginatorRef.current = null;
    };
  }, [relayout]);

  useEffect(() => {
    const refresh = () => relayout();
    document.fonts?.ready.then(refresh);
    document.fonts?.addEventListener("loadingdone", refresh);
    return () => document.fonts?.removeEventListener("loadingdone", refresh);
  }, [relayout]);

  useLayoutEffect(() => {
    const first = pack.book.chapters[0]?.title.id;
    setPanel({ open: false, word: null });
    relayout(first === undefined ? undefined : sentenceKey(first));
  }, [pack, relayout]);

  const layoutKey = `${preferences.size}|${preferences.lh}|${preferences.font}`;
  const appliedLayoutKey = useRef(layoutKey);
  useEffect(() => {
    if (appliedLayoutKey.current === layoutKey) return;
    appliedLayoutKey.current = layoutKey;
    relayout();
  }, [layoutKey, relayout]);

  useLayoutEffect(() => {
    const flow = flowRef.current;
    if (!flow || !pack) return;
    for (const element of flow.querySelectorAll<HTMLElement>(".w[data-l]")) {
      element.classList.remove("l1", "l2", "l3");
      const name = highlightClass(state.wordStates[element.dataset.l ?? ""] ?? { kind: "new" });
      if (name) element.classList.add(name);
    }
  }, [state.wordStates, pack]);

  useLayoutEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    for (const element of flow.querySelectorAll(".w.sel, .w.grp")) {
      element.classList.remove("sel", "grp");
    }
    if (!panel.open || !panel.word) return;
    const { sentence, tokenIndex } = panel.word;
    const key = sentenceKey(sentence.id);
    for (const member of groupMembers(sentence, tokenIndex)) {
      flow
        .querySelector(`.w[data-s="${key}"][data-i="${member}"]`)
        ?.classList.add(member === tokenIndex ? "sel" : "grp");
    }
  }, [panel]);

  useEffect(() => {
    const flow = flowRef.current;
    const wasOff = previousHighlights.current === 0;
    previousHighlights.current = preferences.hl;
    if (!flow || !wasOff || preferences.hl !== 1) return;
    flow.classList.add("hlin");
    const timer = window.setTimeout(() => flow.classList.remove("hlin"), WIPE_MS);
    return () => {
      window.clearTimeout(timer);
      flow.classList.remove("hlin");
    };
  }, [preferences.hl]);

  useEffect(() => {
    const book = bookRef.current;
    const sheet = sheetRef.current;
    const flow = flowRef.current;
    const underFlow = underFlowRef.current;
    const pageTop = pageTopRef.current;
    const flap = flapRef.current;
    const shadowCrease = shadowCreaseRef.current;
    const shadowFlap = shadowFlapRef.current;
    const glCanvas = glRef.current;
    const cornerRight = cornerRightRef.current;
    const cornerLeft = cornerLeftRef.current;
    if (
      !book ||
      !sheet ||
      !flow ||
      !underFlow ||
      !pageTop ||
      !flap ||
      !shadowCrease ||
      !shadowFlap ||
      !glCanvas ||
      !cornerRight ||
      !cornerLeft
    ) {
      return;
    }
    const front = document.createElement("canvas");
    const under = document.createElement("canvas");

    const stepPx = () => step(sheet.clientWidth, gapFor(sheet.clientWidth));

    const pageHasBookmark = (page: number) =>
      bookmarksOnPage(live.current.spans, live.current.bookmarks, page).length > 0;

    const curl = createPageCurl({
      book,
      cornerRight,
      cornerLeft,
      glCanvas,
      prefersReducedMotion: () => false,
      getPageSurface: (direction) => {
        const current = paginatorRef.current;
        const page = current?.current() ?? 0;
        const target = clampPage(page + direction, current?.pages() ?? 1);
        const segments = collectSegments(flow);
        const base = {
          step: stepPx(),
          width: book.clientWidth,
          height: book.clientHeight,
          sheet: {
            left: sheet.offsetLeft,
            top: sheet.offsetTop,
            width: sheet.clientWidth,
            height: sheet.clientHeight,
          },
          background: getComputedStyle(pageTop).backgroundColor,
          ribbonColor:
            getComputedStyle(document.documentElement).getPropertyValue("--lamp").trim() ||
            "#C2D94C",
        };
        drawPage(front, segments, {
          ...base,
          pageIndex: page,
          bookmarked: pageHasBookmark(page),
        });
        drawPage(under, segments, {
          ...base,
          pageIndex: target,
          bookmarked: pageHasBookmark(target),
        });
        return { front, under };
      },
      onTurn: (direction) => {
        const current = paginatorRef.current;
        if (!current) return;
        setPanel((previous) => (previous.open ? { ...previous, open: false } : previous));
        current.go(current.current() + direction);
        sync();
      },
      canTurn: (direction) => {
        const current = paginatorRef.current;
        if (!current) return false;
        const target = current.current() + direction;
        return target >= 0 && target < current.pages();
      },
      domFold: {
        top: pageTop,
        flap,
        shadowCrease,
        shadowFlap,
        prepare: (corner) => {
          const current = paginatorRef.current;
          if (!current) return;
          const target = clampPage(current.current() + (corner === "r" ? 1 : -1), current.pages());
          underFlow.innerHTML = flow.innerHTML;
          underFlow.className = flow.className;
          underFlow.style.cssText = flow.style.cssText;
          underFlow.style.transition = "none";
          underFlow.style.transform = `translateX(${-target * stepPx()}px)`;
        },
      },
    });
    curlRef.current = curl;
    if (live.current.turn === "curl") curl.enable();
    const closeOnGrab = () => setPanel((previous) => ({ ...previous, open: false }));
    cornerRight.addEventListener("pointerdown", closeOnGrab);
    cornerLeft.addEventListener("pointerdown", closeOnGrab);
    return () => {
      cornerRight.removeEventListener("pointerdown", closeOnGrab);
      cornerLeft.removeEventListener("pointerdown", closeOnGrab);
      curl.destroy();
      curlRef.current = null;
    };
  }, [sync]);

  useEffect(() => {
    const curl = curlRef.current;
    if (!curl) return;
    if (preferences.turn === "curl") curl.enable();
    else curl.disable();
  }, [preferences.turn]);

  useEffect(() => {
    if (!visible) {
      closeLayers();
      setFullscreen(false);
    }
  }, [visible, closeLayers]);

  useEffect(() => {
    const app = document.getElementById("app");
    if (!app) return;
    app.classList.toggle("fs", fullscreen && visible);
    return () => app.classList.remove("fs");
  }, [fullscreen, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") {
        const target = escapeTarget({
          popover: live.current.popOpen,
          drawer: live.current.drawerOpen,
          panel: live.current.panelOpen,
          fullscreen: live.current.fullscreen,
        });
        if (target === "popover") setPopOpen(false);
        else if (target === "drawer") setDrawerOpen(false);
        else if (target === "panel") closePanel();
        else if (target === "fullscreen") {
          setFullscreen(false);
          setBarShown(false);
        }
        return;
      }
      if (isEditable(event.target)) return;
      if (event.key === "ArrowRight") turn(1);
      else if (event.key === "ArrowLeft") turn(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, turn, closePanel]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onClick = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".w")) return;
      closePanel();
    };
    stage.addEventListener("click", onClick);
    return () => stage.removeEventListener("click", onClick);
  }, [closePanel]);

  useEffect(() => {
    if (!popOpen) return;
    const onClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".pop") || target.closest("[data-aa]")) return;
      setPopOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [popOpen]);

  useEffect(() => {
    if (!popOpen) return;
    const place = () => {
      const button = aaRef.current?.getBoundingClientRect();
      const parent = rootRef.current?.getBoundingClientRect();
      if (button && parent) setPlacement(popoverPlacement(button, parent));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [popOpen]);

  useEffect(() => {
    if (!visible || !state.focusRequest) return;
    const request = actions.consumeFocus();
    if (!request) return;
    const sentence = index.byId.get(request.sentenceId);
    if (!sentence) return;
    const found = sentence.tokens.findIndex((token) => token.lemma === request.lemma);
    relayout(sentenceKey(sentence.id));
    openWord(sentence.id, Math.max(0, found));
  }, [visible, state.focusRequest, actions, index, relayout, openWord]);

  const pulse = () => {
    const element = flowRef.current?.querySelector<HTMLElement>(".w.sel");
    if (element) {
      element.classList.remove("pulse");
      void element.offsetWidth;
      element.classList.add("pulse");
      window.setTimeout(() => element.classList.remove("pulse"), PULSE_MS);
    }
    bumpWordsDock();
  };

  const wordFromEvent = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const element = target.closest<HTMLElement>(".w");
    const id = parseSentenceKey(element?.dataset.s);
    const tokenIndex = Number(element?.dataset.i);
    if (!element || id === null || !Number.isInteger(tokenIndex)) return null;
    return { id, tokenIndex };
  };

  const onFlowClick = (event: MouseEvent) => {
    const word = wordFromEvent(event.target);
    if (word) openWord(word.id, word.tokenIndex);
  };

  const onFlowKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const word = wordFromEvent(event.target);
    if (!word) return;
    event.preventDefault();
    openWord(word.id, word.tokenIndex);
  };

  const onFlowFocus = (event: React.FocusEvent) => {
    const word = wordFromEvent(event.target);
    const sheet = sheetRef.current;
    if (sheet) sheet.scrollLeft = 0;
    const current = paginatorRef.current;
    if (!word || !current) return;
    const range = current.ranges().find((candidate) => candidate.id === sentenceKey(word.id));
    if (range && (current.current() < range.startPage || current.current() > range.endPage)) {
      goTo(range.startPage);
    }
  };

  const toggleBookmark = () => {
    const current = paginatorRef.current;
    if (!current) return;
    if (markedOnPage.length > 0) {
      for (const id of markedOnPage) actions.toggleBookmark(id);
      return;
    }
    const id = parseSentenceKey(current.sentenceOnCurrentPage() ?? undefined);
    if (id !== null) actions.toggleBookmark(id);
  };

  const openDrawer = () => {
    closePanel();
    setPopOpen(false);
    setDrawerOpen(true);
  };

  const toggleType = () => {
    closePanel();
    setPopOpen((previous) => !previous);
  };

  const toggleFullscreen = () => {
    closeLayers();
    setBarShown(false);
    setFullscreen((previous) => !previous);
  };

  const currentSentence = parseSentenceKey(paginator?.sentenceOnCurrentPage() ?? undefined);
  const currentChapter =
    currentSentence === null ? 0 : (index.byId.get(currentSentence)?.chapter ?? 0);
  const rows = chapterRows(view.starts, view.page, view.pages, currentChapter);
  const drawerChapters = rows.map((row) => {
    const title = pack.book.chapters[row.index]?.title;
    return { row, title: title ? sentenceText(title) : "" };
  });
  const bookmarkSentences = [...state.bookmarks]
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const sentence = index.byId.get(id);
      return sentence ? [sentence] : [];
    });

  const rootStyle = { "--sheet": preferences.paper } as CSSProperties;
  const rootClass = fullscreen ? "rd fs" : "rd";
  const bookClass = preferences.turn === "curl" ? "book curl" : "book";

  return (
    <div className={rootClass} ref={rootRef} style={rootStyle} data-view="read">
      <TopBar
        aaRef={aaRef}
        shown={barShown}
        page={view.page}
        pages={view.pages}
        chapterStarts={view.starts}
        bookmarked={bookmarked}
        fullscreen={fullscreen}
        onContents={openDrawer}
        onSeek={(page) => {
          closePanel();
          goTo(page);
        }}
        onBookmark={toggleBookmark}
        onType={toggleType}
        onFullscreen={toggleFullscreen}
        onPointerMove={() => {
          if (fullscreen) showBar();
        }}
      />
      <Button
        className="topzone"
        aria-label="Thanh công cụ"
        tabIndex={-1}
        onMouseEnter={showBar}
        onClick={() => (barShown ? setBarShown(false) : showBar())}
      />
      <div className={panel.open ? "stage pan" : "stage"} ref={stageRef}>
        <div
          className={bookClass}
          ref={bookRef}
          onTouchStart={(event) => {
            const onCorner = event.target instanceof Element && event.target.closest(".corner");
            touchStartX.current = onCorner ? null : (event.touches[0]?.clientX ?? null);
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined) return;
            if (Math.abs(end - start) > 50) turn(end - start < 0 ? 1 : -1);
          }}
        >
          <div className="cl">
            <div className="under">
              <div className="sheet">
                <div className="flow" ref={underFlowRef} />
              </div>
            </div>
            <div className="sh" ref={shadowCreaseRef} />
            <div className="pgtop" ref={pageTopRef}>
              <svg
                className={bookmarked ? "rib on" : "rib"}
                viewBox="0 0 22 60"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M0 0h22v60l-11-12L0 60z" fill="currentColor" />
              </svg>
              <div className="sheet" ref={sheetRef}>
                <div
                  className={preferences.hl === 1 ? "flow" : "flow nohl"}
                  ref={flowRef}
                  lang={pack.lang}
                  role="presentation"
                  onClick={onFlowClick}
                  onKeyDown={onFlowKeyDown}
                  onFocus={onFlowFocus}
                >
                  <Flow pack={pack} />
                </div>
              </div>
            </div>
            <div className="flap" ref={flapRef} />
            <div className="sh" ref={shadowFlapRef} />
            <canvas className="gl" ref={glRef} />
          </div>
          <div className="corner r" ref={cornerRightRef} />
          <div className="corner l" ref={cornerLeftRef} />
          <IconButton
            variant="hit"
            className="l"
            icon="left"
            label="Trang trước"
            disabled={view.page === 0}
            onClick={() => turn(-1)}
          />
          <IconButton
            variant="hit"
            className="r"
            icon="right"
            label="Trang sau"
            disabled={view.page >= view.pages - 1}
            onClick={() => turn(1)}
          />
        </div>
      </div>
      <TypePopover open={popOpen} placement={placement} />
      <WordPanel
        open={panel.open}
        word={panel.word}
        reveal={reveal}
        onToggleReveal={(which) => setReveal((previous) => toggleReveal(previous, which))}
        onPulse={pulse}
      />
      <Drawer
        open={drawerOpen}
        tab={drawerTab}
        onTab={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        chapters={drawerChapters}
        bookmarks={bookmarkSentences}
        sentences={index.sentences}
        onChapter={(startPage) => {
          setDrawerOpen(false);
          closePanel();
          goTo(startPage);
        }}
        onSentence={(id) => {
          setDrawerOpen(false);
          goToSentence(id);
        }}
        onRemoveBookmark={(id) => actions.toggleBookmark(id)}
      />
    </div>
  );
}
