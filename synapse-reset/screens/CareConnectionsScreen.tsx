import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Share, Switch, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import { settingsStorage } from "@/lib/storage-self";
import {
  acceptInvitation, completeWithAcceptance, confirmVerification, createOutgoingInvitation, detectCareMessageKind, encodeLink, extractJsonFromInput, INVITE_LINK_PREFIX,
  getMyFingerprint, getVerificationCode, isTrusted, linkConnectionProfile, loadConnections, previewInvitation, rejectInvitation,
  removeConnection, revokeConnection, setGrants, setGuardianClaim, type InvitationPreview,
} from "@/lib/care/connections";
import {
  applyImport, buildExportPayload, createExportPackage, describePayload, freshnessLabel, importFailureMessage, loadSharedData, previewImport,
  type ImportPreview,
} from "@/lib/care/sharing";
import { deviceTimeZone } from "@/lib/care/time-zone";
import { EDITABLE_CATEGORIES, SHARING_CATEGORIES, type AppliedEdit, type CareConnection, type ConnectionRole, type SharingCategory, type StoredSharedData } from "@/lib/care/types";
import { syncCheckInReminders } from "@/lib/care/checkin";
import { applyChanges, declineChanges, isSelectable, loadEdits, previewChanges, type ChangePreview } from "@/lib/care/changes";
import ChangeComposer from "@/components/care/ChangeComposer";
import { ChipRow } from "@/components/care/pickers";
import QRCode from "@/components/care/QRCode";
import QRScanner from "@/components/care/QRScanner";
import { Body, Card, Notice, Pill, PrimaryButton, Row, ScreenHeader, SecondaryButton, SectionLabel } from "@/components/care/ui";
import TextInput from "@/components/DoneTextInput";

type Props = {
  onBack?: () => void;
  /** An invitation, reply, or package that arrived through a link. */
  incoming?: string | null;
  onIncomingHandled?: () => void;
  /** Open the connection with this id straight away. */
  startConnectionId?: string | null;
};

type View_ = { name: "home" } | { name: "invite"; resume?: CareConnection } | { name: "join" } | { name: "detail"; id: string };

const ROLE_LABEL: Record<ConnectionRole, string> = {
  i_care_for_them: "I care for them",
  they_care_for_me: "They care for me",
  peers: "Looking out for each other",
};

const STATE_LABEL: Record<CareConnection["state"], { text: string; tone: "neutral" | "good" | "warn" }> = {
  invitation_created: { text: "Invitation created", tone: "neutral" },
  awaiting_confirmation: { text: "Awaiting confirmation", tone: "warn" },
  connected_locally: { text: "Connected locally", tone: "good" },
  needs_verification: { text: "Needs verification", tone: "warn" },
  revoked: { text: "Access removed", tone: "neutral" },
  removed: { text: "Removed", tone: "neutral" },
};

async function myName(): Promise<string> {
  const s = await settingsStorage.get();
  return (s.name || "").trim() || "Me";
}

export default function CareConnectionsScreen({ onBack, incoming, onIncomingHandled, startConnectionId }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: C } = useTheme();
  const [view, setView] = useState<View_>(startConnectionId ? { name: "detail", id: startConnectionId } : { name: "home" });
  const [connections, setConnections] = useState<CareConnection[]>([]);
  const refresh = useCallback(async () => setConnections(await loadConnections()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goHome = useCallback(async () => {
    await refresh();
    setView({ name: "home" });
  }, [refresh]);

  const topPad = width >= 768 ? 28 : Platform.OS === "web" ? 40 : 8;
  const active = connections.filter((c) => c.state !== "removed");

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {view.name === "home" ? (
        <Home
          connections={active}
          onBack={onBack}
          onInvite={() => setView({ name: "invite" })}
          onResume={(c) => setView({ name: "invite", resume: c })}
          onJoin={() => setView({ name: "join" })}
          onOpen={(id) => setView({ name: "detail", id })}
          incoming={incoming}
          onIncomingHandled={onIncomingHandled}
          onNeedsJoin={() => setView({ name: "join" })}
        />
      ) : null}
      {view.name === "invite" ? <InviteFlow resume={view.resume} onDone={goHome} onOpen={(id) => setView({ name: "detail", id })} /> : null}
      {view.name === "join" ? <JoinFlow initialInput={incoming ?? undefined} onDone={goHome} onOpen={(id) => setView({ name: "detail", id })} onConsumed={onIncomingHandled} /> : null}
      {view.name === "detail" ? <Detail id={view.id} onBack={goHome} /> : null}
      <Text style={{ color: C.textTertiary, fontSize: 12, marginTop: 24, lineHeight: 17 }}>
        Care connections live only on your iPhone. Synapse has no servers or accounts. Information moves only when someone chooses to share it.
      </Text>
    </ScrollView>
  );
}

// ---------- home ----------

function Home({
  connections, onBack, onInvite, onResume, onJoin, onOpen, incoming, onIncomingHandled, onNeedsJoin,
}: {
  connections: CareConnection[];
  onBack?: () => void;
  onInvite: () => void;
  onResume: (c: CareConnection) => void;
  onJoin: () => void;
  onOpen: (id: string) => void;
  incoming?: string | null;
  onIncomingHandled?: () => void;
  onNeedsJoin: () => void;
}) {
  const pending = connections.filter((c) => c.state === "invitation_created" || c.state === "awaiting_confirmation" || c.state === "needs_verification");
  const settled = connections.filter((c) => !pending.includes(c));

  useEffect(() => {
    if (!incoming) return;
    // A link that arrived while this screen was open: route it to the right step.
    const kind = detectCareMessageKind(incoming);
    if (kind === "invite" || kind === "accept") onNeedsJoin();
  }, [incoming, onNeedsJoin]);
  void onIncomingHandled;

  return (
    <>
      <ScreenHeader title="Care Connections" subtitle="Trusted relationships you set up on purpose, with people who also use Synapse." onBack={onBack} />
      <Card>
        <Row icon="qr-code-outline" title="Connect with Someone" subtitle="Start a connection and show or send an invitation" onPress={onInvite} />
        <Row icon="enter-outline" title="I Have an Invitation" subtitle="Scan a QR code, paste a link, or open a file" onPress={onJoin} />
      </Card>

      <Notice>A connection is not live syncing. It lets you share chosen information, one update at a time, and only after both of you confirm.</Notice>

      {pending.length ? (
        <>
          <SectionLabel>Pending</SectionLabel>
          <Card>
            {pending.map((c) => (
              <Row
                key={c.id}
                icon="hourglass-outline"
                title={c.peerName}
                subtitle={`${ROLE_LABEL[c.role]} · ${c.state === "invitation_created" && Date.now() - Date.parse(c.createdAt) > 7 * 86_400_000 ? "Invitation expired" : STATE_LABEL[c.state].text}`}
                onPress={() => (c.state === "invitation_created" && c.invitationJson ? onResume(c) : onOpen(c.id))}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel>My Care Connections</SectionLabel>
      {settled.length ? (
        <Card>
          {settled.map((c) => (
            <Row key={c.id} icon="people-outline" title={c.peerName} subtitle={`${ROLE_LABEL[c.role]} · ${STATE_LABEL[c.state].text}`} onPress={() => onOpen(c.id)} />
          ))}
        </Card>
      ) : (
        <Body>No connections yet.</Body>
      )}
    </>
  );
}

// ---------- invite (inviter side) ----------

function InviteFlow({ resume, onDone, onOpen }: { resume?: CareConnection; onDone: () => void; onOpen: (id: string) => void }) {
  const { activeProfile, profiles } = useCareProfiles();
  const [role, setRole] = useState<ConnectionRole>("they_care_for_me");
  const [requests, setRequests] = useState<SharingCategory[]>([]);
  const [created, setCreated] = useState<{ connection: CareConnection; link: string; json: string } | null>(
    resume?.invitationJson ? { connection: resume, json: resume.invitationJson, link: encodeLink(INVITE_LINK_PREFIX, JSON.parse(resume.invitationJson)) } : null,
  );
  const [reply, setReply] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const aboutProfile = role === "i_care_for_them" ? profiles.find((p) => p.type === "caregiver_managed" && p.id === activeProfile.id)?.id : undefined;

  const create = async () => {
    setBusy(true);
    try {
      const { connection, invitation, link } = await createOutgoingInvitation({ myName: await myName(), myTimeZone: deviceTimeZone(), role, requests, profileId: aboutProfile });
      setCreated({ connection, link, json: JSON.stringify(invitation) });
    } finally {
      setBusy(false);
    }
  };

  const shareInvitation = async () => {
    if (!created) return;
    try {
      await Share.share({ message: `I'd like to connect with you on Synapse. Open this on your iPhone with Synapse installed:\n\n${created.link}` });
    } catch {
      // The share sheet was dismissed.
    }
  };

  const shareFile = async () => {
    if (!created) return;
    try {
      const uri = `${FileSystem.cacheDirectory}Synapse-Invitation.json`;
      await FileSystem.writeAsStringAsync(uri, created.json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: "Send invitation" });
    } catch {
      Alert.alert("Couldn't share the file", "Try sharing the link instead.");
    }
  };

  const applyReply = async (text: string) => {
    setError("");
    const result = await completeWithAcceptance(text);
    if (!result.ok) {
      setError(result.reason === "no_matching_invitation" ? "That reply doesn't match an invitation you created." : "That reply couldn't be verified. Ask them to send it again.");
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onOpen(result.connection.id);
  };

  if (!created) {
    return (
      <>
        <ScreenHeader title="Connect with Someone" subtitle="Create an invitation for a person you trust." onBack={onDone} />
        <SectionLabel>How are you connected?</SectionLabel>
        <Card>
          {(["they_care_for_me", "i_care_for_them", "peers"] as ConnectionRole[]).map((r) => (
            <Row key={r} title={ROLE_LABEL[r]} subtitle={r === "i_care_for_them" ? "You look after their health" : r === "they_care_for_me" ? "They look after your health" : "Neither of you is the caregiver"} onPress={() => setRole(r)} right={<Pill label={role === r ? "Selected" : "Choose"} tone={role === r ? "good" : "neutral"} />} />
          ))}
        </Card>
        <SectionLabel>What would you like them to share with you?</SectionLabel>
        <Card>
          <Body>This is only a request. They decide what, if anything, to share.</Body>
          {SHARING_CATEGORIES.map((c) => {
            const on = requests.includes(c.id);
            return (
              <Row key={c.id} title={c.label} subtitle={c.blurb} right={<Switch value={on} onValueChange={(v) => setRequests((r) => (v ? [...r, c.id] : r.filter((x) => x !== c.id)))} />} />
            );
          })}
        </Card>
        <View style={{ gap: 10, marginTop: 16 }}>
          <PrimaryButton label="Create invitation" onPress={create} busy={busy} icon="qr-code-outline" />
        </View>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="Invitation ready" subtitle="Step 1 of 3: show or send this to the other person." onBack={onDone} />
      <Card style={{ alignItems: "center" }}>
        <QRCode value={created.json} size={Math.min(260, 300)} />
        <Body style={{ textAlign: "center" } as never}>In person: have them scan this with Synapse. The invitation holds your name and a signed key. It holds no health information.</Body>
      </Card>
      <View style={{ gap: 10, marginTop: 12 }}>
        <SecondaryButton label="Send link with the share sheet" icon="share-outline" onPress={shareInvitation} />
        <SecondaryButton label="Send as a file (AirDrop)" icon="document-outline" onPress={shareFile} />
      </View>
      <Notice>The invitation expires in 7 days. Apple's Messages or AirDrop may process what you send through them, though Synapse itself uses no server.</Notice>

      <SectionLabel>Step 2: when they reply</SectionLabel>
      <Card>
        <Body>After they accept, their phone shows a reply. Scan it, or paste it here.</Body>
        <SecondaryButton label="Scan their reply" icon="scan-outline" onPress={() => setScanOpen(true)} />
        <TextInput value={reply} onChangeText={setReply} placeholder="Paste their reply link" multiline style={inputStyle} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Paste reply" />
        <PrimaryButton label="Use this reply" onPress={() => applyReply(reply)} disabled={!reply.trim()} />
        {error ? <Text style={{ color: "#C0392B", fontSize: 13, fontWeight: "600" }}>{error}</Text> : null}
      </Card>
      <QRScanner visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={(t) => { setScanOpen(false); void applyReply(t); }} />
    </>
  );
}

// ---------- join (recipient side) ----------

function JoinFlow({ initialInput, onDone, onOpen, onConsumed }: { initialInput?: string; onDone: () => void; onOpen: (id: string) => void; onConsumed?: () => void }) {
  const [input, setInput] = useState(initialInput ?? "");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [grants, setGrantsState] = useState<SharingCategory[]>([]);
  const [reply, setReply] = useState<{ link: string; connectionId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const evaluate = useCallback(async (text: string) => {
    const kind = detectCareMessageKind(text);
    if (kind && kind !== "invite") {
      setPreview({ ok: false, reason: "malformed" });
      return;
    }
    const p = await previewInvitation(text);
    setPreview(p);
    if (p.ok) setGrantsState([]);
  }, []);

  useEffect(() => {
    if (initialInput) {
      void evaluate(initialInput);
      onConsumed?.();
    }
  }, [evaluate, initialInput, onConsumed]);

  const pickFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const text = await FileSystem.readAsStringAsync(r.assets[0].uri);
      if (text.length > 4000) {
        setPreview({ ok: false, reason: "malformed" });
        return;
      }
      setInput(text);
      await evaluate(text);
    } catch {
      Alert.alert("Couldn't open that file");
    }
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setInput(text);
      await evaluate(text);
    }
  };

  const accept = async () => {
    if (!preview?.ok) return;
    setBusy(true);
    try {
      const r = await acceptInvitation(preview.invitation, { myName: await myName(), myTimeZone: deviceTimeZone(), grants });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReply({ link: r.replyLink, connectionId: r.connection.id });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (preview?.ok) await rejectInvitation(preview.invitation);
    onDone();
  };

  if (reply) {
    const json = extractJsonFromInput(reply.link) ?? "";
    return (
      <>
        <ScreenHeader title="Send your reply" subtitle="Step 2 of 3: they need this to finish connecting." onBack={onDone} />
        <Card style={{ alignItems: "center" }}>
          <QRCode value={json} size={260} />
          <Body style={{ textAlign: "center" } as never}>Have them scan this, or send it to them.</Body>
        </Card>
        <View style={{ gap: 10, marginTop: 12 }}>
          <SecondaryButton label="Send reply with the share sheet" icon="share-outline" onPress={() => void Share.share({ message: `Here's my reply to your Synapse invitation:\n\n${reply.link}` }).catch(() => {})} />
          <PrimaryButton label="Next: compare the code" onPress={() => onOpen(reply.connectionId)} />
        </View>
      </>
    );
  }

  return (
    <>
      <ScreenHeader title="I Have an Invitation" subtitle="Check who is asking before you accept." onBack={onDone} />
      {!preview ? (
        <>
          <Card>
            <SecondaryButton label="Scan a QR code" icon="scan-outline" onPress={() => setScanOpen(true)} />
            <SecondaryButton label="Paste from clipboard" icon="clipboard-outline" onPress={paste} />
            <SecondaryButton label="Open an invitation file" icon="document-outline" onPress={pickFile} />
            <TextInput value={input} onChangeText={setInput} placeholder="Or paste the link here" multiline style={inputStyle} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Paste invitation" />
            <PrimaryButton label="Check invitation" onPress={() => evaluate(input)} disabled={!input.trim()} />
          </Card>
          <QRScanner visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={(t) => { setScanOpen(false); setInput(t); void evaluate(t); }} />
        </>
      ) : !preview.ok ? (
        <Card>
          <Text style={{ fontWeight: "700", fontSize: 16, color: "#C0392B" }}>This invitation can't be used</Text>
          <Body>
            {preview.reason === "expired"
              ? "It has expired. Ask them to create a new one."
              : preview.reason === "bad_signature"
                ? "It failed its safety check and may have been changed. Ask them to send it again."
                : preview.reason === "unsupported_version"
                  ? "It was made by a newer version of Synapse. Update the app and try again."
                  : "It doesn't look like a Synapse invitation."}
          </Body>
          <SecondaryButton label="Try another" onPress={() => { setPreview(null); setInput(""); }} />
        </Card>
      ) : preview.ownInvitation ? (
        <Card>
          <Body>This is your own invitation. Send it to someone else.</Body>
          <SecondaryButton label="Back" onPress={() => { setPreview(null); setInput(""); }} />
        </Card>
      ) : preview.alreadyHandled ? (
        <Card>
          <Body>You've already responded to this invitation.</Body>
          <SecondaryButton label="Back" onPress={() => { setPreview(null); setInput(""); }} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 20 }}>{preview.invitation.name} wants to connect</Text>
            <Row title="Their relationship to you" subtitle={preview.invitation.relationship === "caregiver" ? "They would be your caregiver" : preview.invitation.relationship === "cared_for" ? "You would be their caregiver" : "You'd look out for each other"} />
            <Row title="Their device fingerprint" subtitle={preview.fingerprint} />
            <Row title="Time zone" subtitle={preview.invitation.timeZone} />
            {preview.invitation.requests.length ? (
              <Row title="They'd like to receive" subtitle={preview.invitation.requests.map((r) => SHARING_CATEGORIES.find((c) => c.id === r)?.label ?? r).join(", ")} />
            ) : null}
          </Card>
          <Notice icon="shield-checkmark-outline">
            Having this invitation doesn't prove who they are. After you accept, you'll both read a short code aloud to confirm it's really them.
          </Notice>
          <SectionLabel>What this connection is not</SectionLabel>
          <Card>
            <Body>It does not give anyone access to your records. It is not live syncing, and it cannot track you. Nothing is shared unless you choose to export it, and no one can change your records without you accepting it.</Body>
          </Card>
          <SectionLabel>What you'll allow them to receive</SectionLabel>
          <Card>
            <Body>Nothing is selected by default. You can change this any time. Later you can also let them suggest edits, which you approve one by one.</Body>
            {SHARING_CATEGORIES.map((c) => (
              <Row key={c.id} title={c.label} subtitle={c.blurb} right={<Switch value={grants.includes(c.id)} onValueChange={(v) => setGrantsState((g) => (v ? [...g, c.id] : g.filter((x) => x !== c.id)))} />} />
            ))}
          </Card>
          <View style={{ gap: 10, marginTop: 16 }}>
            <PrimaryButton label="Accept and continue" onPress={accept} busy={busy} />
            <SecondaryButton label="Decline" onPress={reject} />
          </View>
        </>
      )}
    </>
  );
}

// ---------- detail ----------

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const { colors: C } = useTheme();
  const { createProfile } = useCareProfiles();
  const [conn, setConn] = useState<CareConnection | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [fp, setFp] = useState("");
  const [shared, setShared] = useState<StoredSharedData | null>(null);
  const [exportPreview, setExportPreview] = useState<{ rows: ReturnType<typeof describePayload>; json: string } | null>(null);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<ImportPreview | null>(null);
  const [changePreview, setChangePreview] = useState<ChangePreview | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<AppliedEdit[]>([]);
  const [meName, setMeName] = useState("Me");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const c = (await loadConnections()).find((x) => x.id === id) ?? null;
    setConn(c);
    setCode(c ? await getVerificationCode(c) : null);
    setFp(await getMyFingerprint());
    setShared(c ? await loadSharedData(c.id) : null);
    setEdits(c ? await loadEdits(c.id) : []);
    setMeName(await myName());
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!conn) {
    return (
      <>
        <ScreenHeader title="Connection" onBack={onBack} />
        <Body>This connection is no longer on this iPhone.</Body>
      </>
    );
  }

  const trusted = isTrusted(conn);
  const state = STATE_LABEL[conn.state];

  const accessOf = (cat: SharingCategory): "off" | "view" | "edit" => conn.grants.find((g) => g.category === cat)?.access ?? "off";

  const setAccess = async (cat: SharingCategory, access: "off" | "view" | "edit") => {
    const others = conn.grants.filter((g) => g.category !== cat);
    await setGrants(conn.id, access === "off" ? others : [...others, { category: cat, access }]);
    await reload();
  };

  const buildExport = async () => {
    setBusy(true);
    setMessage("");
    try {
      const s = await settingsStorage.get();
      const payload = await buildExportPayload(conn, (s.name || "").trim() || "Me", deviceTimeZone());
      const rows = describePayload(payload);
      if (rows.length === 0) {
        setMessage("Nothing to share yet. Turn on at least one category above. Some categories are held back for a minor's profile unless guardianship is declared.");
        return;
      }
      if (rows.length < conn.grants.length) setMessage("Some categories were left out because they involve a minor's sensitive information.");
      const result = await createExportPackage(conn, payload);
      if (!result.ok) {
        setMessage(result.reason === "not_verified" ? "Confirm the verification code first." : "That's too much to share at once.");
        return;
      }
      setExportPreview({ rows, json: result.json });
    } finally {
      setBusy(false);
    }
  };

  const sendExport = async () => {
    if (!exportPreview) return;
    try {
      const uri = `${FileSystem.cacheDirectory}Synapse-Update-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, exportPreview.json);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: `Share update with ${conn.peerName}` });
      setExportPreview(null);
      await reload();
    } catch {
      Alert.alert("Couldn't share the file");
    }
  };

  const runImport = async (text: string) => {
    setImportResult(null);
    setChangePreview(null);
    const result = await previewImport(text);
    if (!result.ok && result.reason === "is_changes") {
      const cp = await previewChanges(text);
      setChangePreview(cp);
      if (cp.ok) setAccepted(new Set(cp.rows.filter((r) => r.status === "ok").map((r) => r.change.id)));
      return;
    }
    setImportResult(result);
  };

  const applyReview = async () => {
    if (!changePreview?.ok) return;
    const r = await applyChanges(changePreview, [...accepted]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage(`Applied ${r.applied} change${r.applied === 1 ? "" : "s"}${r.skipped ? `. ${r.skipped} not applied.` : "."}`);
    setChangePreview(null);
    setImportText("");
    await reload();
  };

  const declineReview = async () => {
    if (changePreview?.ok) await declineChanges(changePreview);
    setChangePreview(null);
    setImportText("");
    setMessage("Declined. Nothing was changed.");
  };

  const pickImportFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const info = await FileSystem.getInfoAsync(r.assets[0].uri);
      if (info.exists && "size" in info && typeof info.size === "number" && info.size > 1_100_000) {
        setImportResult({ ok: false, reason: "malformed" });
        return;
      }
      await runImport(await FileSystem.readAsStringAsync(r.assets[0].uri));
    } catch {
      Alert.alert("Couldn't open that file");
    }
  };

  const confirmImport = async () => {
    if (!importResult?.ok) return;
    const applied = await applyImport(importResult);
    if (!applied) {
      Alert.alert("Not imported", "This update is older than the one you already have.");
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage("Imported. This is a saved copy, not live information.");
      void syncCheckInReminders().catch(() => {});
    }
    setImportResult(null);
    setImportText("");
    await reload();
  };

  const revoke = () =>
    Alert.alert(
      "Stop sharing with " + conn.peerName + "?",
      "Synapse will stop letting you export anything to them and will forget their key. Anything you already shared stays on their phone. We can't reach it, and we can't tell their phone. You can reconnect later with a new invitation.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Stop sharing", style: "destructive", onPress: async () => { await revokeConnection(conn.id); await reload(); } },
      ],
    );

  const remove = () =>
    Alert.alert("Remove this connection?", `This deletes ${conn.peerName}'s saved updates from this iPhone. Anything you already shared with them stays on their phone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await removeConnection(conn.id); onBack(); } },
    ]);

  const makeReferenceProfile = async () => {
    const p = await createProfile({ type: "connected_reference", displayName: conn.peerName, connectionId: conn.id, timeZone: conn.peerTimeZone });
    await linkConnectionProfile(conn.id, { referenceProfileId: p.id });
    await reload();
  };

  return (
    <>
      <ScreenHeader title={conn.peerName} subtitle={ROLE_LABEL[conn.role]} onBack={onBack} />
      <Card>
        <Pill label={state.text} tone={state.tone} />
        {conn.state === "invitation_created" ? <Body>Waiting for their reply. Open this invitation again from "Connect with Someone" to show the QR code.</Body> : null}
        {conn.peerTimeZone ? <Row icon="globe-outline" title="Their time zone" subtitle={conn.peerTimeZone} /> : null}
        <Row icon="finger-print-outline" title="Your device fingerprint" subtitle={fp} />
        {shared?.med_schedule || shared?.upcoming_appointments ? <Row icon="time-outline" title={freshnessLabel((shared.med_schedule ?? shared.upcoming_appointments)!.provenance.importedAt)} subtitle="A saved copy, not live information." /> : <Row icon="time-outline" title="Nothing shared yet" />}
      </Card>

      {(conn.state === "awaiting_confirmation" || conn.state === "needs_verification") && code ? (
        <>
          <SectionLabel>Confirm it's really them</SectionLabel>
          <Card>
            <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: 3, textAlign: "center", color: C.text }} accessibilityLabel={`Verification code ${code.split("").join(" ")}`}>{code}</Text>
            <Body>Read this code to {conn.peerName} in person or by phone, and ask them to read theirs. Only continue if the two codes are exactly the same.</Body>
            <PrimaryButton label="The codes match" onPress={async () => { await confirmVerification(conn.id, true); await reload(); }} />
            <SecondaryButton label="They don't match" destructive onPress={async () => { await confirmVerification(conn.id, false); await reload(); }} />
          </Card>
        </>
      ) : null}

      {trusted ? (
        <>
          <SectionLabel>What I may share with {conn.peerName}</SectionLabel>
          <Card>
            <Body>Nothing is sent automatically. These choices decide what you include when you share an update, and whether {conn.peerName} may suggest changes.</Body>
            {SHARING_CATEGORIES.map((c) =>
              EDITABLE_CATEGORIES.includes(c.id) ? (
                <View key={c.id} style={{ gap: 8, paddingVertical: 6 }}>
                  <Row title={c.label} subtitle={c.blurb} />
                  <ChipRow options={["off", "view", "edit"] as const} value={accessOf(c.id)} onChange={(v) => setAccess(c.id, v)} format={(v) => (v === "off" ? "Off" : v === "view" ? "View only" : "Suggest edits")} />
                </View>
              ) : (
                <Row key={c.id} title={c.label} subtitle={c.blurb} right={<Switch value={accessOf(c.id) !== "off"} onValueChange={(v) => setAccess(c.id, v ? "view" : "off")} accessibilityLabel={`Allow sharing ${c.label}`} />} />
              ),
            )}
            <Notice icon="create-outline">"Suggest edits" lets {conn.peerName} send you suggested changes to that category. You review every suggestion on your own iPhone, and nothing changes unless you accept it. You can switch this back any time.</Notice>
          </Card>

          <SectionLabel>Share an update</SectionLabel>
          <Card>
            {!exportPreview ? (
              <>
                <Body>You'll see exactly what's included before anything leaves this iPhone.</Body>
                <PrimaryButton label="Review what I'd share" onPress={buildExport} busy={busy} icon="eye-outline" />
              </>
            ) : (
              <>
                <Text style={{ fontWeight: "700", fontSize: 15, color: C.text }}>This update includes</Text>
                {exportPreview.rows.map((r) => (
                  <Row key={r.category} title={r.label} subtitle={`${r.count} ${r.count === 1 ? "item" : "items"}`} />
                ))}
                <Body>It's encrypted so only {conn.peerName}'s Synapse can open it. Apple's AirDrop or Messages may handle the file in transit.</Body>
                <PrimaryButton label="Send with AirDrop or share sheet" onPress={sendExport} icon="share-outline" />
                <SecondaryButton label="Cancel" onPress={() => setExportPreview(null)} />
              </>
            )}
          </Card>

          <SectionLabel>Import an update from {conn.peerName}</SectionLabel>
          <Card>
            <SecondaryButton label="Open an update file" icon="document-outline" onPress={pickImportFile} />
            <TextInput value={importText} onChangeText={setImportText} placeholder="Or paste the update here" multiline style={inputStyle} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Paste update" />
            <SecondaryButton label="Review update" onPress={() => runImport(importText)} disabled={!importText.trim()} />
            {changePreview && !changePreview.ok ? <Text style={{ color: "#C0392B", fontSize: 13, fontWeight: "600" }}>{importFailureMessage(changePreview.reason)}</Text> : null}
            {changePreview?.ok ? (
              <>
                <Text style={{ fontWeight: "700", fontSize: 15, color: C.text }}>{changePreview.senderName} suggests {changePreview.rows.length} change{changePreview.rows.length === 1 ? "" : "s"}</Text>
                <Body>Nothing has changed yet. Choose which ones to accept.</Body>
                {changePreview.rows.map((r) => (
                  <View key={r.change.id} style={{ gap: 4, paddingVertical: 4 }}>
                    <Row
                      title={r.summary}
                      subtitle={r.status === "missing" ? "That record no longer exists" : r.status === "not_authorized" ? "You haven't allowed suggestions for this" : r.status === "conflict" ? `Differs from what they saw: ${r.conflicts.join(", ")}` : undefined}
                      right={<Switch value={accepted.has(r.change.id)} disabled={!isSelectable(r)} onValueChange={(v) => setAccepted((a) => { const n = new Set(a); if (v) n.add(r.change.id); else n.delete(r.change.id); return n; })} accessibilityLabel={`Accept: ${r.summary}`} />}
                    />
                    {r.fields.map((f) => (
                      <Text key={f.field} style={{ color: C.textSecondary, fontSize: 12, marginLeft: 50 }}>{f.field}: {f.from} → {f.to}</Text>
                    ))}
                  </View>
                ))}
                <PrimaryButton label={`Apply ${accepted.size} change${accepted.size === 1 ? "" : "s"}`} onPress={applyReview} disabled={accepted.size === 0} />
                <SecondaryButton label="Decline all" onPress={declineReview} />
              </>
            ) : null}
            {importResult && !importResult.ok ? <Text style={{ color: "#C0392B", fontSize: 13, fontWeight: "600" }}>{importFailureMessage(importResult.reason)}</Text> : null}
            {importResult?.ok ? (
              <>
                <Text style={{ fontWeight: "700", fontSize: 15, color: C.text }}>Preview</Text>
                {importResult.diffs.map((d) => (
                  <Row key={d.category} title={d.label} subtitle={`${d.added} new · ${d.updated} updated · ${d.unchanged} unchanged · ${d.removed} no longer shared`} />
                ))}
                <Body>From {importResult.connection.peerName}. Exported {new Date(importResult.exportedAt).toLocaleString()}. Saved as a separate copy. It never changes your own records.</Body>
                {importResult.olderThanStored ? <Notice icon="alert-circle-outline">This update is older than the one you already have, so it can't be imported.</Notice> : null}
                <PrimaryButton label="Import as saved copy" onPress={confirmImport} disabled={importResult.olderThanStored} />
                <SecondaryButton label="Cancel" onPress={() => setImportResult(null)} />
              </>
            ) : null}
            {message ? <Body>{message}</Body> : null}
          </Card>

          {shared?.med_schedule || shared?.upcoming_appointments || shared?.selected_records || shared?.emergency_info || shared?.med_confirmations ? <SharedCopy shared={shared} /> : null}

          {shared && shared.editable.length > 0 ? <ChangeComposer conn={conn} shared={shared} myName={meName} myTimeZone={deviceTimeZone()} onSent={() => setMessage("Suggestions ready. They'll review them on their iPhone.")} /> : null}

          {edits.length ? (
            <>
              <SectionLabel>Changes you accepted from {conn.peerName}</SectionLabel>
              <Card>
                {[...edits].reverse().slice(0, 15).map((e) => (
                  <Row key={e.id} icon="create-outline" title={e.summary} subtitle={new Date(e.at).toLocaleString()} />
                ))}
              </Card>
            </>
          ) : null}

          {!conn.referenceProfileId ? (
            <Card style={{ marginTop: 12 }}>
              <Body>Keep {conn.peerName}'s shared updates as a view-only profile you can open from the profile switcher.</Body>
              <SecondaryButton label="Add as a view-only profile" icon="person-add-outline" onPress={makeReferenceProfile} />
            </Card>
          ) : null}
        </>
      ) : null}

      <SectionLabel>Care role</SectionLabel>
      <Card>
        <Row title={ROLE_LABEL[conn.role]} subtitle={conn.guardianClaim === "self_declared" ? "Guardian role self-declared. Synapse can't verify guardianship." : "Not a verified guardian relationship"} />
        {conn.role === "i_care_for_them" ? (
          <>
            <Row title="I'm this person's parent or legal guardian" subtitle="Self-declared only. Synapse can't check legal status offline, and sensitive information still needs their authorization." right={<Switch value={conn.guardianClaim === "self_declared"} onValueChange={async (v) => { await setGuardianClaim(conn.id, v ? "self_declared" : "none"); await reload(); }} />} />
          </>
        ) : null}
      </Card>

      <SectionLabel>Manage</SectionLabel>
      <View style={{ gap: 10 }}>
        {conn.state !== "revoked" ? <SecondaryButton label="Stop sharing" icon="hand-left-outline" destructive onPress={revoke} /> : <Notice>Sharing was stopped on {conn.revokedAt ? new Date(conn.revokedAt).toLocaleDateString() : "this iPhone"}. Anything shared before remains on their phone.</Notice>}
        <SecondaryButton label="Remove connection" icon="trash-outline" destructive onPress={remove} />
      </View>
    </>
  );
}

export function SharedCopy({ shared }: { shared: StoredSharedData }) {
  return (
    <>
      <SectionLabel>Latest from {shared.fromName}</SectionLabel>
      <Card>
        <Notice icon="time-outline">Saved copies from their last updates. This isn't live.</Notice>
        {shared.med_schedule ? (
          <>
            <Text style={sharedHeading}>Medication schedule · {freshnessLabel(shared.med_schedule.provenance.exportedAt)}</Text>
            {shared.med_schedule.items.map((m) => (
              <Row key={m.key} title={m.name} subtitle={[m.dose, m.times.join(", ")].filter(Boolean).join(" · ")} />
            ))}
          </>
        ) : null}
        {shared.upcoming_appointments ? (
          <>
            <Text style={sharedHeading}>Upcoming appointments · {freshnessLabel(shared.upcoming_appointments.provenance.exportedAt)}</Text>
            {shared.upcoming_appointments.items.map((a) => (
              <Row key={a.key} title={a.doctorName || "Appointment"} subtitle={[a.date, a.time, a.location].filter(Boolean).join(" · ")} />
            ))}
          </>
        ) : null}
        {shared.med_confirmations ? (
          <>
            <Text style={sharedHeading}>Medication confirmations · {freshnessLabel(shared.med_confirmations.provenance.exportedAt)}</Text>
            {shared.med_confirmations.items.slice(0, 20).map((c) => (
              <Row key={c.key} title={c.medicationName} subtitle={`${c.date} · ${c.taken ? "Marked taken" : "Not marked"}${c.enteredBy === "caregiver" ? " by caregiver" : ""}`} />
            ))}
          </>
        ) : null}
        {shared.selected_records ? (
          <>
            <Text style={sharedHeading}>Health records · {freshnessLabel(shared.selected_records.provenance.exportedAt)}</Text>
            {shared.selected_records.items.map((r) => (
              <Row key={r.key} title={r.label} subtitle={r.kind === "allergy" ? "Allergy" : "Condition"} />
            ))}
          </>
        ) : null}
        {shared.emergency_info ? (
          <>
            <Text style={sharedHeading}>Emergency information · {freshnessLabel(shared.emergency_info.provenance.exportedAt)}</Text>
            {shared.emergency_info.items.allergies ? <Row title="Allergies" subtitle={shared.emergency_info.items.allergies} /> : null}
            {shared.emergency_info.items.notes ? <Row title="Notes" subtitle={shared.emergency_info.items.notes} /> : null}
          </>
        ) : null}
      </Card>
    </>
  );
}

const sharedHeading = { fontWeight: "700" as const, fontSize: 13, marginTop: 8 };
const inputStyle = { minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: "rgba(120,120,120,0.35)", padding: 10, fontSize: 13 } as const;
