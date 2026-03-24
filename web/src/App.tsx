import { useState } from "react";
import Dashboard from "./components/Dashboard";
import ResourceTable from "./components/ResourceTable";
import ResourceDetail from "./components/ResourceDetail";

type View = "dashboard" | "resources" | "detail";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="bg-white dark:bg-gray-800 shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-600">K8s Statistics</h1>
          <button
            className={`text-sm ${view === "dashboard" ? "font-semibold text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`text-sm ${view === "resources" || view === "detail" ? "font-semibold text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => {
              setView("resources");
              setSelectedResource(null);
            }}
          >
            Resources
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {view === "dashboard" && <Dashboard />}
        {view === "resources" && (
          <ResourceTable
            onSelect={(id) => {
              setSelectedResource(id);
              setView("detail");
            }}
          />
        )}
        {view === "detail" && selectedResource && (
          <ResourceDetail
            resourceId={selectedResource}
            onBack={() => {
              setView("resources");
              setSelectedResource(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
