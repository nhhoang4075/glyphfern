import type { ReactNode } from "react";
import type { Route } from "../app/api";
import { useApp } from "../app/use-app";
import { LibraryView } from "../library/library-view";
import { ReaderView } from "../reader/reader-view";
import { ReviewView } from "../review/review-view";
import { WordsView } from "../words/words-view";
import { Dock } from "./dock";

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
