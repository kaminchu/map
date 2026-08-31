import { Route, Switch } from "wouter";
import { MapPage } from "../pages/MapPage/MapPage";
import { OfflinePage } from "../pages/OfflinePage/OfflinePage";
import { OfflineDetailPage } from "../pages/OfflineDetailPage/OfflineDetailPage";
import { SettingsPage } from "../pages/SettingsPage/SettingsPage";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/offline/:id" component={OfflineDetailPage} />
      <Route path="/offline" component={OfflinePage} />
      <Route path="/settings" component={SettingsPage} />
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}
function NotFound() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>ページが見つかりません</h1>
      <a href="/">地図へ戻る</a>
    </main>
  );
}
