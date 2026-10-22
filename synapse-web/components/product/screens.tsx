import { demo } from "@/lib/feature-content/content";

export function TodayScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Synapse</p>
      <h3>Today</h3>
      <p className="app-quiet">A quiet moment for your health.</p>
      <section>
        <h4>Medications today</h4>
        <ul>
          {demo.meds.map((med) => (
            <li key={`${med.name}-${med.when}`}>
              <span>
                {med.name}
                <small>{med.dose}</small>
              </span>
              <em className={med.state === "Due" ? "is-due" : ""}>
                {med.when} · {med.state}
              </em>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4>Upcoming</h4>
        <ul>
          <li>
            <span>
              {demo.appointment.who}
              <small>{demo.appointment.where}</small>
            </span>
            <em>{demo.appointment.when}</em>
          </li>
        </ul>
      </section>
      <section>
        <h4>How you’re feeling</h4>
        <ul>
          {demo.feeling.slice(0, 3).map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <em>{item.value}</em>
            </li>
          ))}
        </ul>
      </section>
      <p className="app-footnote">Sample information. Not a real record.</p>
    </div>
  );
}

export function MedicationsScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Synapse</p>
      <h3>Medications</h3>
      <p className="app-quiet">Scheduled and as-needed.</p>
      <ul className="app-list">
        {demo.meds.map((med) => (
          <li key={`${med.name}-${med.when}`}>
            <span>
              {med.name}
              <small>
                {med.dose} · {med.when}
              </small>
            </span>
            <em className={med.state === "Due" ? "is-due" : ""}>{med.state}</em>
          </li>
        ))}
        <li>
          <span>
            Sample tablet
            <small>As needed</small>
          </span>
          <em>PRN</em>
        </li>
      </ul>
      <p className="app-footnote">Fictional doses for a sample day.</p>
    </div>
  );
}

export function AppointmentsScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Synapse</p>
      <h3>Appointments</h3>
      <p className="app-quiet">Upcoming</p>
      <article className="app-visit">
        <p>{demo.appointment.when}</p>
        <h4>{demo.appointment.who}</h4>
        <p>{demo.appointment.where}</p>
        <p className="app-quiet">Leave around 2:05 PM · 25 min drive</p>
        <p>{demo.appointment.note}</p>
      </article>
      <p className="app-footnote">Sample visit. Not a real appointment.</p>
    </div>
  );
}

export function RecordsScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Synapse</p>
      <h3>Lab work</h3>
      <p className="app-quiet">Entered by you. Not synced from a clinic.</p>
      <ul className="app-list">
        {demo.labs.map((lab) => (
          <li key={lab.name}>
            <span>
              {lab.name}
              <small>{lab.note}</small>
            </span>
            <em>{lab.value}</em>
          </li>
        ))}
      </ul>
      <section>
        <h4>Profile</h4>
        <ul>
          <li>
            <span>Allergies</span>
            <em>{demo.allergies}</em>
          </li>
        </ul>
      </section>
      <p className="app-footnote">Fictional results.</p>
    </div>
  );
}

export function FeelingScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Synapse</p>
      <h3>Daily log</h3>
      <p className="app-quiet">How are you feeling?</p>
      <ul className="meters">
        {demo.feeling.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <i aria-hidden="true" />
            <em>{item.value}</em>
          </li>
        ))}
        <li>
          <span>Fatigue</span>
          <i aria-hidden="true" />
          <em>Low</em>
        </li>
      </ul>
      <p className="app-footnote">A sample check-in. Not medical advice.</p>
    </div>
  );
}

export function SickScreen() {
  return (
    <div className="app-screen app-screen-sick">
      <p className="app-mark">Sick Mode</p>
      <h3>Rest first.</h3>
      <p className="app-quiet">Check-ins stay gentle. This does not diagnose or treat.</p>
      <ul className="app-list">
        <li>
          <span>
            Temperature
            <small>Logged this morning</small>
          </span>
          <em>99.4°F</em>
        </li>
        <li>
          <span>Hydration</span>
          <em>3 glasses</em>
        </li>
        <li>
          <span>Rest</span>
          <em>On and off</em>
        </li>
      </ul>
      <p className="app-footnote">Sample logs. Seek care yourself if symptoms are severe.</p>
    </div>
  );
}

export function EmergencyScreen() {
  return (
    <div className="app-screen">
      <p className="app-mark">Emergency card</p>
      <h3>{demo.person}</h3>
      <p className="app-quiet">Born {demo.dob}</p>
      <ul className="app-list">
        <li>
          <span>Allergies</span>
          <em>{demo.allergies}</em>
        </li>
        <li>
          <span>Medications</span>
          <em>Vitamin D</em>
        </li>
        <li>
          <span>
            Contact
            <small>{demo.contact.name}</small>
          </span>
          <em>{demo.contact.phone}</em>
        </li>
        <li>
          <span>
            Doctor
            <small>{demo.doctor.name}</small>
          </span>
          <em>{demo.doctor.phone}</em>
        </li>
      </ul>
      <p className="app-footnote">Fictional card. Synapse does not call anyone.</p>
    </div>
  );
}

export function ScreenFor({ name }: { name: "today" | "medications" | "appointments" | "records" | "feeling" | "sick" | "emergency" }) {
  if (name === "today") return <TodayScreen />;
  if (name === "medications") return <MedicationsScreen />;
  if (name === "appointments") return <AppointmentsScreen />;
  if (name === "records") return <RecordsScreen />;
  if (name === "feeling") return <FeelingScreen />;
  if (name === "sick") return <SickScreen />;
  return <EmergencyScreen />;
}
