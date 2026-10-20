"use client";
import React from "react";

type Item = {
  id: number;
  name: string;
  category: string;
  value: number;
};

export default function DataList() {
  const [data, setData] = React.useState<Item[]>([]);
  const [filter, setFilter] = React.useState<string>("all");

  React.useEffect(() => {
    fetch("/data.json")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  const filtered = React.useMemo(() => {
    if (filter === "all") return data;
    return data.filter((item) => item.category === filter);
  }, [data, filter]);

  const categories = React.useMemo(() => {
    const set = new Set(data.map((item) => item.category));
    return Array.from(set);
  }, [data]);

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="mb-4">
        <label className="mr-2 font-medium text-gray-700 dark:text-gray-200">
          Filter by category:
        </label>
        <select
          className="rounded border p-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-2">
        {filtered.map((item) => (
          <li key={item.id} className="p-2 bg-white dark:bg-gray-700 rounded shadow-sm">
            <strong>{item.name}</strong> – Category: {item.category}, Value: {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
