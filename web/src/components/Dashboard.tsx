import { useEffect, useState } from "react";
import { fetchStats } from "../api/client";
import type { Stats } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats().then(setStats);
  }, []);

  if (!stats) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">
            {stats.totalResources}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total Resources</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">
            {stats.byKind.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Resource Kinds</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">
            {stats.byCluster.length}
          </div>
          <div className="text-sm text-gray-500 mt-1">Clusters</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">By Kind</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.byKind}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">By Cluster</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.byCluster}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
