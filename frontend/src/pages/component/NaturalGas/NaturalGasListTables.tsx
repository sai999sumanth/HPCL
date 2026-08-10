import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Card, CardContent } from "@/@/components/ui/card";
import { toast } from "sonner";
import { ConnectionPreviewTables } from "./ConnectionPreviewTables";
import {
  NATURAL_GAS_CONNECTIONS_LIST_API,
  NATURAL_GAS_LIST_DEFAULT_LIMIT,
  NATURAL_GAS_LIST_DEFAULT_SKIP,
  extractRecordsFromListResponse,
  normalizeJvRow,
  type ConnectionJvRow,
} from "./connectionDataUtils";

const listParams = {
  skip: NATURAL_GAS_LIST_DEFAULT_SKIP,
  limit: NATURAL_GAS_LIST_DEFAULT_LIMIT,
};

type Props = {
  /** Increment to refetch the list (e.g. after successful sync). */
  refreshSignal?: number;
};

export const NaturalGasListTables: React.FC<Props> = ({ refreshSignal = 0 }) => {
  const [connectionRows, setConnectionRows] = useState<ConnectionJvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionsRefreshing, setConnectionsRefreshing] = useState(false);

  const fetchConnectionRows = useCallback(async (): Promise<ConnectionJvRow[]> => {
    const res = await apiClient.get(NATURAL_GAS_CONNECTIONS_LIST_API, { params: listParams });
    return extractRecordsFromListResponse(res).map(normalizeJvRow);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const conn = await fetchConnectionRows();
      setConnectionRows(conn);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Could not load connections.";
      toast.error(msg);
      setConnectionRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchConnectionRows]);

  const refreshConnections = useCallback(async () => {
    setConnectionsRefreshing(true);
    try {
      const conn = await fetchConnectionRows();
      setConnectionRows(conn);
      toast.success("Natural Gas Connections refreshed.");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Could not refresh connections.";
      toast.error(msg);
      setConnectionRows([]);
    } finally {
      setConnectionsRefreshing(false);
    }
  }, [fetchConnectionRows]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial, refreshSignal]);

  return (
    <Card className="overflow-hidden border border-gray-200/90 ring-1 ring-gray-100/80">
      <CardContent className="p-2 sm:p-2.5">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            Loading connections…
          </div>
        ) : (
          <ConnectionPreviewTables
            jv={connectionRows}
            jvTitle="Natural Gas Connections"
            onRefreshConnections={refreshConnections}
            connectionsRefreshing={connectionsRefreshing}
          />
        )}
      </CardContent>
    </Card>
  );
};
