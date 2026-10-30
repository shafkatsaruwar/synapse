import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Privacy Policy",
  description:
    "Synapse Health Companion privacy policy: local-first storage, no account required, no sale of health data, and manual backups you control.",
  path: "/privacy",
});

type Block = { p?: string[]; ul?: string[]; dl?: [string, string][]; note?: string };
type Section = { id: string; title: string; blocks: Block[] };

const intro = [
  "Synapse Health Companion (“Synapse,” “the App,” “we,” or “us”) is a personal health organization application designed to help you keep important health information together in one place.",
  "Synapse is built around a simple principle: Your health information belongs to you.",
  "This Privacy Policy explains how Synapse handles information, what choices you have, and what you should know about protecting your data.",
];

const sections: Section[] = [
  {
    id: "principles",
    title: "1. Our Privacy Principles",
    blocks: [
      { p: ["Synapse is designed with privacy at its foundation."] },
      {
        ul: [
          "Local-first: Your health information is stored on your device.",
          "No account required: You can use Synapse without registering, signing in, or providing an email address.",
          "No sale of health data: We do not sell your health information.",
          "No advertising profiles: We do not use your health information to create advertising profiles.",
          "User-controlled backups: You decide when to create a manual backup and where to store it.",
          "Your choice: You decide what information to enter, update, export, or delete.",
        ],
      },
      { p: ["These principles guide how Synapse is designed and developed."] },
    ],
  },
  {
    id: "stored",
    title: "2. Information You Choose to Store",
    blocks: [
      { p: ["Synapse allows you to organize different kinds of personal and health-related information. Depending on the features you use, this may include:"] },
      {
        ul: [
          "Personal information: Names, dates of birth, and profile details.",
          "Medical information: Health conditions, allergies, medical history, and related notes.",
          "Medications: Medication names, dosages, schedules, instructions, and tracking history.",
          "Appointments: Healthcare provider information, appointment dates, locations, and notes.",
          "Health records: Documents, images, and other records you choose to save.",
          "Health observations: Symptoms, mood, energy, sleep, and personal health logs.",
          "Cycle information: Menstrual cycle details, symptoms, and related notes, where supported.",
          "Emergency information: Medical details and emergency contacts that you choose to provide.",
          "Caregiver information: Information entered on behalf of another person when using Synapse to help organize their care.",
        ],
      },
      { p: ["You decide what to enter. Synapse does not require you to complete every field or use every feature."] },
    ],
  },
  {
    id: "storage",
    title: "3. Where Your Information Is Stored",
    blocks: [
      { p: ["Local device storage. Synapse stores your health information locally on your device."] },
      { p: ["Your device’s operating system provides security protections, including encryption and access controls, subject to your device configuration."] },
      { p: ["Synapse does not require you to create an online account to store your health information."] },
      { p: ["No automatic Synapse cloud synchronization. Synapse does not automatically synchronize your health records through a Synapse-operated cloud service. If you use Synapse on multiple devices, information does not automatically transfer between them through a Synapse account."] },
      { p: ["Device-level backups. Your operating system may provide its own backup capabilities. Depending on your device settings and how iOS handles Synapse’s stored files, some application data may be included in an Apple-managed device backup. These operating-system backups are separate from Synapse’s manual backup feature. We recommend reviewing your device’s backup settings to understand what information is included."] },
    ],
  },
  {
    id: "backup",
    title: "4. Manual Backup and Restore",
    blocks: [
      { p: ["Synapse provides a manual backup process with instructions to help you preserve and restore your information. When you create a backup:"] },
      {
        ul: [
          "You initiate the backup process.",
          "You choose where to save the exported file, where supported.",
          "You are responsible for protecting the backup and retaining access to it.",
          "You can use Synapse’s restore instructions to recover supported information.",
        ],
      },
      { p: ["Depending on the storage options available on your device, you may choose to save exported files locally, in iCloud Drive, or through another compatible storage service."] },
      { note: "Important: A backup stored outside Synapse is subject to the privacy and security practices of the service or location you select. Synapse does not control third-party storage providers." },
      { p: ["Manual backups are not the same as automatic synchronization. You should create updated backups periodically, particularly before changing devices, reinstalling the App, or performing major device maintenance."] },
    ],
  },
  {
    id: "use",
    title: "5. How Your Information Is Used",
    blocks: [
      { p: ["Information entered into Synapse is used to provide the functionality you choose to use. This may include:"] },
      {
        ul: [
          "Displaying and organizing your health information.",
          "Managing medications and schedules.",
          "Tracking medication activity.",
          "Organizing appointments.",
          "Maintaining health records.",
          "Recording symptoms and observations.",
          "Displaying emergency information.",
          "Providing reminders and notifications.",
          "Supporting manual backup and restoration.",
          "Displaying relevant information through supported widgets and interface features.",
        ],
      },
      { p: ["Synapse is intended to help you organize and access your information. It is not a substitute for professional medical care."] },
    ],
  },
  {
    id: "notifications",
    title: "6. Notifications and Reminders",
    blocks: [
      { p: ["Synapse may request permission to send notifications for features such as medication reminders or scheduled activities. You can manage notification permissions through your device’s settings."] },
      { p: ["Notification content may be visible on your device’s lock screen or to other people who can access your device, depending on your notification privacy settings. We recommend reviewing notification previews and lock-screen settings if you store sensitive information in Synapse."] },
      { p: ["Reminders are organizational tools. Their delivery may be affected by device settings, operating-system restrictions, or other technical conditions."] },
    ],
  },
  {
    id: "permissions",
    title: "7. Device Permissions and Integrations",
    blocks: [
      { p: ["Some Synapse features may require access to device capabilities or information. Depending on the features available in your version of Synapse, these may include:"] },
      {
        dl: [
          ["Camera and Photos", "Used when you choose to capture, import, or attach images and documents."],
          ["Files", "Used when you choose to import documents, export information, or manage backup files."],
          ["Notifications", "Used to provide reminders and other notifications you enable."],
          ["Calendar", "Where supported, used to import or work with appointment information at your direction."],
          ["Apple Health", "If a version of Synapse supports Apple Health integration, access to HealthKit information requires the relevant permissions. Synapse will only request access associated with supported functionality."],
        ],
      },
      { p: ["You can manage applicable permissions through iOS settings. Not every integration described above is necessarily available in every version of Synapse."] },
    ],
  },
  {
    id: "ai",
    title: "8. AI, Automation, and Smart Features",
    blocks: [
      { p: ["Synapse may include features that help organize, summarize, or present information more conveniently. Where such features are available, their data handling depends on the specific technology used."] },
      { p: ["Synapse does not use your health information to build advertising profiles or sell it for AI training."] },
      { p: ["Any feature that transmits health information to an external processing service must be disclosed accurately, including the service’s role and the information involved. We aim to make data processing understandable so users can make informed choices."] },
    ],
  },
  {
    id: "sharing",
    title: "9. Sharing and Exporting Information",
    blocks: [
      { p: ["Synapse is designed to give you control over your information. You may choose to export, copy, save, or share information using supported features and device capabilities. For example, you may choose to share an exported document with a healthcare professional or store a backup using another service."] },
      { p: ["When you intentionally share information outside Synapse, the recipient or destination may handle that information under its own privacy practices. Before sharing sensitive information, review the recipient and destination carefully."] },
      { p: ["Synapse does not sell your health information to advertisers or data brokers."] },
    ],
  },
  {
    id: "security",
    title: "10. Security",
    blocks: [
      { p: ["Protecting sensitive health information is an important part of Synapse’s design. Synapse relies on applicable iOS security protections for information stored on your device. However, no device, application, or storage system can guarantee absolute security."] },
      {
        ul: [
          "Using a strong device passcode.",
          "Keeping iOS and Synapse updated.",
          "Protecting access to your device.",
          "Reviewing lock-screen notification settings.",
          "Storing exported backups securely.",
          "Avoiding sharing sensitive backup files with untrusted recipients.",
        ],
      },
      { p: ["If your device is lost, compromised, or accessible to another person, information stored on it may be at risk."] },
    ],
  },
  {
    id: "choices",
    title: "11. Your Choices and Control",
    blocks: [
      { p: ["Synapse is designed to let you manage the information you store. Depending on the feature, you can:"] },
      {
        ul: [
          "Add information.",
          "Edit existing information.",
          "Remove individual entries.",
          "Manage reminders and notifications.",
          "Choose whether to use optional features.",
          "Create manual backups.",
          "Restore supported information from a compatible backup.",
          "Delete locally stored information through available controls.",
        ],
      },
      { p: ["Because Synapse stores health information locally, maintaining a current backup is important if you want to preserve information when changing devices."] },
    ],
  },
  {
    id: "retention",
    title: "12. Data Retention and Deletion",
    blocks: [
      { p: ["Information stored locally in Synapse generally remains on your device until you delete it, reset applicable application data, or remove the App. Deleting Synapse may remove locally stored application information."] },
      { note: "Deleting the App does not necessarily delete exported backup files." },
      { p: ["Files that you previously saved to Files, iCloud Drive, external storage, or third-party services may remain there until you delete them separately. Operating-system backups may also remain according to Apple’s backup settings and retention practices. If you want to remove exported copies, you must delete them from their respective storage locations."] },
    ],
  },
  {
    id: "others",
    title: "13. Information About Other People",
    blocks: [
      { p: ["Synapse may be used to organize information for someone other than the device owner, including a family member or a person receiving care. If you enter information about another person, you should have appropriate permission or authority to do so. Take particular care when storing information about children or individuals who may not be able to manage their own information. You are responsible for choosing what information to enter and with whom to share it."] },
    ],
  },
  {
    id: "children",
    title: "14. Children’s Privacy",
    blocks: [
      { p: ["Synapse is not designed to solicit personal information directly from children under 13. A parent, guardian, or authorized caregiver may use the App to organize information relating to a child, subject to applicable law and the App’s supported functionality. Synapse does not require a child to create an online account. If you have questions about children’s privacy and Synapse, please contact us using the information below."] },
    ],
  },
  {
    id: "third-party",
    title: "15. Third-Party Services",
    blocks: [
      { p: ["Some device functions and user-initiated actions may involve services operated by other organizations, including Apple or a storage provider selected by the user. These services have their own privacy policies and security practices. Examples may include:"] },
      {
        ul: [
          "Apple operating-system services.",
          "iCloud Drive or other file storage destinations.",
          "Services you choose when sharing or exporting information.",
        ],
      },
      { p: ["Use of these services may be governed by their respective terms and privacy policies."] },
    ],
  },
  {
    id: "purchases",
    title: "16. In-App Purchases (Synapse Plus)",
    blocks: [
      {
        p: [
          "Synapse may offer optional Synapse Plus purchases through Apple’s In-App Purchase system on iOS. Payment processing, billing, receipts, and subscription management are handled by Apple. Synapse does not receive your full payment card number and does not process payments outside Apple’s supported purchase flow for digital Plus features.",
        ],
      },
      {
        ul: [
          "Purchase status may be verified on device using Apple StoreKit transaction information so Plus features can unlock.",
          "Canceling or letting a subscription expire does not delete your health records. Essential Emergency Card information remains available.",
          "Restore Purchases uses your Apple ID purchase history through Apple’s APIs.",
        ],
      },
    ],
  },
  {
    id: "disclaimer",
    title: "17. Health and Medical Disclaimer",
    blocks: [
      { p: ["Synapse is a personal health organization tool. It is not a medical device, emergency response service, or replacement for a licensed healthcare professional."] },
      { p: ["Information stored, displayed, or organized in Synapse should not be treated as a diagnosis, treatment recommendation, or guarantee of medical accuracy. Always consult an appropriate healthcare professional regarding medical concerns, treatment decisions, or medication changes. In an emergency, contact local emergency services."] },
    ],
  },
  {
    id: "changes",
    title: "18. Changes to This Privacy Policy",
    blocks: [
      { p: ["We may update this Privacy Policy as Synapse evolves, including when functionality, integrations, or data practices change. When we make material changes, we will update the effective date and provide notice as appropriate. The current version of this policy will remain available through the App or its official privacy policy page."] },
    ],
  },
  {
    id: "contact",
    title: "19. Contact Us",
    blocks: [
      { p: ["If you have questions, concerns, or feedback about this Privacy Policy or how Synapse handles information, you can contact:"] },
      { p: ["Synapse Health Companion. Email: mohammedshafkatsaruwar@gmail.com"] },
    ],
  },
];

function renderBlock(block: Block, key: string) {
  if (block.note) {
    return (
      <p key={key} className="privacy-note-block">
        {block.note}
      </p>
    );
  }
  if (block.ul) {
    return (
      <ul key={key}>
        {block.ul.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.dl) {
    return (
      <dl key={key} className="privacy-dl">
        {block.dl.map(([term, def]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{def}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div key={key}>
      {block.p?.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="page prose">
      <header className="page-hero">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy Policy</h1>
        <p className="lede">Your health. Your information. Your choice.</p>
        <p>
          <strong>Effective Date:</strong> October 22, 2026
          <br />
          <strong>Last Updated:</strong> October 22, 2026
        </p>
      </header>

      {intro.map((text) => (
        <p key={text}>{text}</p>
      ))}

      {sections.map((section) => (
        <section key={section.id} id={section.id}>
          <h2>{section.title}</h2>
          {section.blocks.map((block, i) => renderBlock(block, `${section.id}-${i}`))}
        </section>
      ))}

      <p>
        <em>Synapse Health Companion.</em>
        <br />
        <em>Your health. Your information. Your choice.</em>
        <br />
        <em>Private by design. Built for real life.</em>
      </p>
    </div>
  );
}
