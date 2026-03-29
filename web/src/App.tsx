import { BrowserRouter, Routes, Route, NavLink, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useCallback, useRef } from "react";
import Dashboard from "./components/Dashboard";
import ResourceTable from "./components/ResourceTable";
import ResourceDetail from "./components/ResourceDetail";
import QueryBuilder from "./components/QueryBuilder";
import KeysExplorer from "./components/KeysExplorer";

function Nav() {
  return (
    <nav className="bg-white dark:bg-gray-800 shadow mb-6">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <img src="/logo-white.png" alt="Bobtail" className="h-8 w-8 dark:hidden" />
          <img src="/logo-dark.png" alt="Bobtail" className="h-8 w-8 hidden dark:block" />
          Bobtail
        </h1>
        {([
          { to: "/", label: "Dashboard", end: true },
          { to: "/resources", label: "Resources", end: false },
          { to: "/keys", label: "Keys", end: true },
          { to: "/query", label: "Query", end: true },
        ] as const).map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `text-sm ${isActive ? "font-semibold text-blue-600" : "text-gray-500 hover:text-gray-700"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function ResourcesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <ResourceTable
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      onSelect={(id) => navigate(`/resources/${id}`)}
    />
  );
}

function ResourceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <ResourceDetail
      resourceId={Number(id)}
      onBack={() => navigate(-1)}
    />
  );
}

function KeysPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <KeysExplorer
      searchParams={searchParams}
      setSearchParams={setSearchParams}
      onSelectResource={(id) => navigate(`/resources/${id}`)}
    />
  );
}

function QueryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  return <QueryBuilder searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 pb-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/resources/:id" element={<ResourceDetailPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/query" element={<QueryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
