import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import IcsImportPreviewScreen from "@/screens/IcsImportPreviewScreen";
import { getPendingIcsImport, type IcsImportPayload } from "@/lib/ics-import";

export default function AppointmentImportRoute() {
  const [payload, setPayload] = useState<IcsImportPayload | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getPendingIcsImport()
      .then((next) => {
        if (!mounted) return;
        setPayload(next);
      })
      .catch(() => {
        if (!mounted) return;
        setPayload(null);
      })
      .finally(() => {
        if (!mounted) return;
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <IcsImportPreviewScreen
      visible={ready}
      payload={payload}
      modal={false}
      onClose={() => router.replace("/")}
      onImported={() => router.replace("/?widgetTarget=appointments")}
    />
  );
}
