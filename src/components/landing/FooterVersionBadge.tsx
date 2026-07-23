"use client";

import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";

type VersionInfo = {
  version: string;
  commit: string;
  branch: string;
  buildTime: string;
  environment: string;
};

type BackendVersionResponse = VersionInfo & {
  service?: string;
  error?: string;
};

function formatBuildTime(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function VersionSection({
  label,
  info,
}: {
  label: string;
  info: VersionInfo | null;
}) {
  if (!info) {
    return (
      <div className="mt-2 first:mt-0">
        <p className="font-medium text-white">{label}</p>
        <p className="mt-1 text-slate-400">Unavailable</p>
      </div>
    );
  }

  return (
    <div className="mt-2 first:mt-0">
      <p className="font-medium text-white">
        {label} v{info.version}
      </p>
      <p className="mt-1 font-mono text-slate-100">Commit: {info.commit}</p>
      <p className="mt-1 text-slate-300">
        Built: {formatBuildTime(info.buildTime)}
      </p>
      <p className="mt-1 text-slate-300">Env: {info.environment}</p>
    </div>
  );
}

export function FooterVersionBadge() {
  const [frontend, setFrontend] = useState<VersionInfo | null>(null);
  const [backend, setBackend] = useState<VersionInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadVersions() {
      const [frontendRes, backendRes] = await Promise.allSettled([
        fetch("/version.json", { cache: "no-store" }).then((res) =>
          res.ok ? res.json() : null,
        ),
        fetch("/api/backend-version", { cache: "no-store" }).then((res) =>
          res.ok ? res.json() : null,
        ),
      ]);

      if (cancelled) return;

      if (frontendRes.status === "fulfilled") {
        const data = frontendRes.value as VersionInfo | null;
        if (data?.version && data?.commit) setFrontend(data);
      }

      if (backendRes.status === "fulfilled") {
        const data = backendRes.value as BackendVersionResponse | null;
        if (data?.version && data?.commit && !data.error) setBackend(data);
      }
    }

    void loadVersions();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!frontend && !backend) return null;

  const tooltipId = "footer-version-tooltip";
  const frontendCommit = frontend?.commit ?? "—";
  const backendCommit = backend?.commit ?? "—";

  return (
    <div className="relative inline-block group">
      <button
        type="button"
        className="text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-default font-mono"
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
      >
        Frontend {frontendCommit} · Backend {backendCommit}
      </button>

      <div
        id={tooltipId}
        role="tooltip"
        className={`absolute bottom-full left-0 mb-2 z-10 min-w-[14rem] rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-left text-xs text-slate-200 shadow-lg ${
          open ? "block" : "hidden group-hover:block"
        }`}
      >
        <VersionSection label="Frontend" info={frontend} />
        {frontend && backend ? (
          <div className="my-2 border-t border-slate-700" />
        ) : null}
        <VersionSection label="Backend" info={backend} />
      </div>
    </div>
  );
}
