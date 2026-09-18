"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { useAuth } from "@/hooks/useAuth";
import { useNow } from "@/hooks/useNow";
import Alert from "@/components/ui/alert/Alert";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { toUserFacingError } from "@/lib/userFacingError";
import { formatRequestTime } from "../../_components/accessLabels";
import { describeGrantStatus, isGrantLive } from "../../_components/emergencyLabels";

type EmergencyGrantCardProps = {
  grant: {
    grantId: string;
    grantedAt: number;
    expiresAt: number;
    revokedAt?: number;
    justification: string;
  };
  /** Holders and security reviewers may end access early. */
  canRevoke: boolean;
};

export function EmergencyGrantCard({ grant, canRevoke }: EmergencyGrantCardProps) {
  const { sessionToken } = useAuth();
  const now = useNow();
  const revokeEmergencyAccess = useMutation(api.emergency.revokeEmergencyAccess);
  const [isRevoking, setIsRevoking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLive = isGrantLive(grant, now);

  const handleRevoke = async () => {
    if (!sessionToken) {
      return;
    }
    setErrorMessage(null);
    setIsRevoking(true);
    try {
      await revokeEmergencyAccess({ token: sessionToken, grantId: grant.grantId });
    } catch (error) {
      console.error("Error revoking emergency access:", error);
      setErrorMessage(
        toUserFacingError(error, "Emergency access could not be ended. Try again."),
      );
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={isLive ? "warning" : "light"} variant={isLive ? "solid" : "light"} size="sm">
          Break-glass
        </Badge>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {describeGrantStatus(grant, now)}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">Justification</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{grant.justification}</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Granted {formatRequestTime(grant.grantedAt)}. No risk decision applies — the grant
        governs access and security has been notified.
      </p>
      {errorMessage && (
        <Alert variant="error" title="Access not ended" message={errorMessage} />
      )}
      {canRevoke && isLive && (
        <Button variant="outline" size="sm" onClick={handleRevoke} disabled={isRevoking}>
          {isRevoking ? "Ending…" : "End access now"}
        </Button>
      )}
    </div>
  );
}
