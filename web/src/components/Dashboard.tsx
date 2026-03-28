import { useState, useCallback } from "react";
import { Responsive, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { WidgetConfig } from "../types";
import DashboardWidget from "./DashboardWidget";
import WidgetEditor from "./WidgetEditor";

const STORAGE_KEY = "dashboard-widgets";

function minSize(type: WidgetConfig["type"]): { minW: number; minH: number } {
  if (type === "counter") return { minW: 2, minH: 2 };
  return { minW: 3, minH: 3 };
}

function defaultLayout(widget: WidgetConfig, index: number): Layout {
  const mins = minSize(widget.type);
  if (widget.layout) {
    return { i: widget.id, ...widget.layout, ...mins };
  }
  if (widget.type === "counter") {
    return { i: widget.id, x: (index * 4) % 12, y: 0, w: 4, h: 2, ...mins };
  }
  return { i: widget.id, x: (index * 6) % 12, y: 10, w: 6, h: 5, ...mins };
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: "total-resources",
    type: "counter",
    title: "Total Resources",
    query: { kind: "*", groupBy: "kind" },
    counterMode: "total",
    color: "text-blue-600",
    layout: { x: 0, y: 0, w: 4, h: 2 },
  },
  {
    id: "resource-kinds",
    type: "counter",
    title: "Resource Kinds",
    query: { kind: "*", groupBy: "kind" },
    counterMode: "distinct",
    color: "text-green-600",
    layout: { x: 4, y: 0, w: 4, h: 2 },
  },
  {
    id: "clusters",
    type: "counter",
    title: "Clusters",
    query: { kind: "*", groupBy: "cluster" },
    counterMode: "distinct",
    color: "text-purple-600",
    layout: { x: 8, y: 0, w: 4, h: 2 },
  },
  {
    id: "by-kind",
    type: "bar",
    title: "By Kind",
    query: { kind: "*", groupBy: "kind" },
    barColor: "#3b82f6",
    layout: { x: 0, y: 2, w: 6, h: 5 },
  },
  {
    id: "by-cluster",
    type: "bar",
    title: "By Cluster",
    query: { kind: "*", groupBy: "cluster" },
    barColor: "#8b5cf6",
    layout: { x: 6, y: 2, w: 6, h: 5 },
  },
];

function loadWidgets(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS;
}

function saveWidgets(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets);
  const [editing, setEditing] = useState(false);
  const [editorTarget, setEditorTarget] = useState<WidgetConfig | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const persist = useCallback((updated: WidgetConfig[]) => {
    setWidgets(updated);
    saveWidgets(updated);
  }, []);

  function handleDelete(id: string) {
    persist(widgets.filter((w) => w.id !== id));
  }

  function handleSave(widget: WidgetConfig) {
    if (editorTarget) {
      persist(widgets.map((w) => (w.id === editorTarget.id ? { ...widget, layout: w.layout } : w)));
    } else {
      // New widget — place at bottom
      const maxY = widgets.reduce((max, w) => {
        const ly = (w.layout?.y ?? 0) + (w.layout?.h ?? 2);
        return Math.max(max, ly);
      }, 0);
      const newWidget = {
        ...widget,
        layout: {
          x: 0,
          y: maxY,
          w: widget.type === "counter" ? 4 : 6,
          h: widget.type === "counter" ? 2 : 5,
        },
      };
      persist([...widgets, newWidget]);
    }
    setShowEditor(false);
    setEditorTarget(null);
  }

  function handleReset() {
    persist(DEFAULT_WIDGETS);
  }

  function handleLayoutChange(layout: Layout[]) {
    const updated = widgets.map((w) => {
      const l = layout.find((item) => item.i === w.id);
      if (l) {
        return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
      }
      return w;
    });
    persist(updated);
  }

  const layouts = {
    lg: widgets.map((w, i) => ({
      ...defaultLayout(w, i),
      static: !editing,
    })),
  };

  const { containerRef, width: containerWidth } = useContainerWidth();

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3">
        {editing && (
          <>
            <button
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                setEditorTarget(null);
                setShowEditor(true);
              }}
            >
              + Add widget
            </button>
            <button
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500"
              onClick={handleReset}
            >
              Reset to defaults
            </button>
          </>
        )}
        <button
          className={`px-3 py-1.5 text-sm rounded ${
            editing
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Grid */}
      <Responsive
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 0 }}
        cols={{ lg: 12 }}
        rowHeight={50}
        width={containerWidth}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={handleLayoutChange}
        onDragStart={() => document.body.classList.add("rgl-dragging")}
        onDragStop={() => document.body.classList.remove("rgl-dragging")}
        onResizeStart={() => document.body.classList.add("rgl-dragging")}
        onResizeStop={() => document.body.classList.remove("rgl-dragging")}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
      >
        {widgets.map((w) => (
          <div key={w.id}>
            <WidgetWrapper
              widget={w}
              editing={editing}
              onEdit={() => { setEditorTarget(w); setShowEditor(true); }}
              onDelete={() => handleDelete(w.id)}
            >
              <DashboardWidget config={w} />
            </WidgetWrapper>
          </div>
        ))}
      </Responsive>

      {widgets.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No widgets. Click "Edit" then "+ Add widget" to get started.
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <WidgetEditor
          widget={editorTarget ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditorTarget(null); }}
        />
      )}
    </div>
  );
}

function WidgetWrapper({
  widget,
  editing,
  onEdit,
  onDelete,
  children,
}: {
  widget: WidgetConfig;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`h-full ${editing ? "relative group" : ""}`}>
      {editing && (
        <>
          <div
            className="widget-drag-handle absolute inset-0 z-[5] cursor-grab active:cursor-grabbing"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)" }}
          />
          <div className="absolute -top-2 -right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 text-xs shadow"
              onClick={onEdit}
              title="Edit"
            >
              E
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 text-xs shadow"
              onClick={onDelete}
              title="Delete"
            >
              X
            </button>
          </div>
          <div className="ring-1 ring-dashed ring-blue-500/50 rounded-lg h-full overflow-hidden">
            {children}
          </div>
          {/* Resize grip */}
          <svg
            className="absolute bottom-1 right-1 w-3 h-3 text-gray-400 pointer-events-none"
            viewBox="0 0 6 6"
            fill="currentColor"
          >
            <circle cx="5" cy="1" r="0.7" />
            <circle cx="3" cy="3" r="0.7" />
            <circle cx="5" cy="3" r="0.7" />
            <circle cx="1" cy="5" r="0.7" />
            <circle cx="3" cy="5" r="0.7" />
            <circle cx="5" cy="5" r="0.7" />
          </svg>
        </>
      )}
      {!editing && <div className="h-full overflow-hidden">{children}</div>}
    </div>
  );
}
