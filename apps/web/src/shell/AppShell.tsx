import type { ReactNode } from "react";
import type { Route } from "../app/api";
import { useApp } from "../app/useApp";
import { LibraryView } from "../library/LibraryView";
import { ReaderView } from "../reader/ReaderView";
import { ReviewView } from "../review/ReviewView";
import { WordsView } from "../words/WordsView";
import { Dock } from "./Dock";

function View({ route, children }: { route: Route; children: ReactNode }) {
  const { state } = useApp();
  return (
    <section className={state.route === route ? "view on" : "view"} id={`v-${route}`}>
      {children}
    </section>
  );
}

export function AppShell() {
  return (
    <div id="app">
      <Dock />
      <main>
        <View route="library">
          <LibraryView />
        </View>
        <View route="read">
          <ReaderView />
        </View>
        <View route="words">
          <WordsView />
        </View>
        <View route="review">
          <ReviewView />
        </View>
      </main>
    </div>
  );
}
