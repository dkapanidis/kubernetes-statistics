import { useRef, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import ResourceTable from "./components/ResourceTable";
import ResourceDetail from "./components/ResourceDetail";
import QueryBuilder from "./components/QueryBuilder";
import KeysExplorer from "./components/KeysExplorer";
import { useRoute } from "./hooks/useRoute";

function App() {
  const { route, navigate } = useRoute();
  const previousPage = useRef("resources");

  const goToDetail = useCallback(
    (id: number, from: string) => {
      previousPage.current = from;
      navigate("resources/" + id);
    },
    [navigate],
  );

  const page = route.page;
  const resourceMatch = page.match(/^resources\/(\d+)$/);
  const isDetail = !!resourceMatch;
  const selectedResource = resourceMatch ? Number(resourceMatch[1]) : null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="bg-white dark:bg-gray-800 shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-600">K8s Statistics</h1>
          {(
            [
              ["dashboard", "Dashboard"],
              ["resources", "Resources"],
              ["keys", "Keys"],
              ["query", "Query"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`text-sm ${
                page === v || (v === "resources" && isDetail)
                  ? "font-semibold text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => navigate(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {page === "dashboard" && <Dashboard />}
        {page === "resources" && (
          <ResourceTable
            params={route.params}
            onSelect={(id) => goToDetail(id, "resources")}
          />
        )}
        {page === "keys" && (
          <KeysExplorer
            params={route.params}
            onSelectResource={(id) => goToDetail(id, "keys")}
          />
        )}
        {isDetail && selectedResource && (
          <ResourceDetail
            resourceId={selectedResource}
            onBack={() => navigate(previousPage.current)}
          />
        )}
        {page === "query" && <QueryBuilder params={route.params} />}
      </main>
    </div>
  );
}

export default App;
