import React, { useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { useCareProfiles } from "@/contexts/CareProfileContext";
import { useRole } from "@/contexts/RoleContext";
import { loadConnections } from "@/lib/care/connections";
import { profileAgeLabel } from "@/lib/care/profiles";
import type { CareConnection } from "@/lib/care/types";
import CaregiverSetupFlow from "./CaregiverSetupFlow";
import { Body, Card, Notice, Pill, Row, SecondaryButton, SectionLabel } from "./ui";

type Props = {
  onNavigate?: (key: string) => void;
  backupOn: boolean;
  onToggleBackup: (on: boolean) => void;
};

/**
 * Care & Sharing: My Roles, People I Care For, Care Connections, and Sharing & Privacy. Backup
 * People keeps its existing editor in SettingsScreen. Roles are independent switches, so someone
 * can look after their own health and care for others at the same time.
 */
export default function CareSharingSections({ onNavigate, backupOn, onToggleBackup }: Props) {
  const { profiles, roleFlags, setRoleFlag, switchProfile, activeProfile } = useCareProfiles();
  const { setRole, role } = useRole();
  const [setupOpen, setSetupOpen] = useState(false);
  const [connections, setConnections] = useState<CareConnection[]>([]);
  const managed = profiles.filter((p) => p.type === "caregiver_managed");

  useEffect(() => {
    void loadConnections().then(setConnections);
  }, []);

  const toggleCaregiver = (on: boolean) => {
    if (on) {
      if (managed.length === 0) setSetupOpen(true);
      else void setRoleFlag("caregiver", true);
      return;
    }
    Alert.alert("Turn off the caregiver role?", "The people you've added stay on this iPhone. You can turn this back on any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Turn off", style: "destructive", onPress: () => void setRoleFlag("caregiver", false) },
    ]);
  };

  const active = connections.filter((c) => c.state !== "removed");
  const connected = active.filter((c) => c.state === "connected_locally").length;

  return (
    <>
      <SectionLabel>My Roles</SectionLabel>
      <Card>
        <Row icon="person-outline" title="Managing my own health" subtitle="Always on" right={<Pill label="On" tone="good" />} />
        <Row icon="heart-outline" title="Caregiver" subtitle="I help look after someone" right={<Switch value={roleFlags.caregiver} onValueChange={toggleCaregiver} accessibilityLabel="Caregiver role" />} />
        <Row icon="shield-outline" title="Backup person" subtitle="Someone relies on me in an emergency" right={<Switch value={backupOn} onValueChange={onToggleBackup} accessibilityLabel="Backup person role" />} />
        <Body>You can hold several roles at once. Turning one on never changes your own health records.</Body>
      </Card>

      {roleFlags.caregiver || managed.length > 0 ? (
        <>
          <SectionLabel>People I Care For</SectionLabel>
          <Card>
            {managed.length === 0 ? <Body>No one added yet.</Body> : null}
            {managed.map((p) => (
              <Row
                key={p.id}
                icon="person-outline"
                title={p.displayName}
                subtitle={[p.relationship, profileAgeLabel(p), "On this iPhone"].filter(Boolean).join(" · ")}
                onPress={() => onNavigate?.("managedperson")}
                right={activeProfile.id === p.id ? <Pill label="Viewing" tone="good" /> : undefined}
              />
            ))}
            <SecondaryButton label="Add someone" icon="person-add-outline" onPress={() => setSetupOpen(true)} />
            {managed.length > 0 ? (
              <SecondaryButton
                label={activeProfile.type === "self" ? `View ${managed[0].displayName}'s health` : "Back to my own health"}
                icon="swap-horizontal-outline"
                onPress={() => void switchProfile(activeProfile.type === "self" ? managed[0].id : "self")}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionLabel>Care Connections</SectionLabel>
      <Card>
        <Row icon="link-outline" title="Care Connections" subtitle={active.length ? `${connected} connected${active.length > connected ? ` · ${active.length - connected} pending` : ""}` : "Connect with someone who uses Synapse"} onPress={() => onNavigate?.("careconnections")} />
        <Row icon="chatbubble-ellipses-outline" title="Check-In" subtitle="Stay connected with people you care about" onPress={() => onNavigate?.("checkin")} />
      </Card>

      <SectionLabel>Sharing & Privacy</SectionLabel>
      <Card>
        <Row icon="phone-portrait-outline" title="Everything stays on this iPhone" subtitle="Synapse has no servers, accounts, or cloud syncing for care information." />
        <Row icon="share-outline" title="You choose what leaves" subtitle="Sharing is manual and you review it first. Others can only suggest edits, and you approve each one. Nothing sends in the background." />
        <Row icon="hand-left-outline" title="Taking access back" subtitle="Stopping a connection ends future sharing. Anything already shared stays on their phone." />
        <Body>Apple's Messages and AirDrop may process what you send through them. Synapse itself never does.</Body>
      </Card>
      <Notice>Roles shown here: {role === "backup" ? "backup person" : "yourself"}{roleFlags.caregiver ? " and caregiver" : ""}. Viewing someone else's profile is always labeled at the top of the screen.</Notice>

      <CaregiverSetupFlow
        visible={setupOpen}
        onClose={() => setSetupOpen(false)}
        onCreated={async (p) => {
          await setRole("self");
          await switchProfile(p.id);
          onNavigate?.("dashboard");
        }}
        onConnect={() => onNavigate?.("careconnections")}
      />
      <View style={{ height: 8 }} />
    </>
  );
}
