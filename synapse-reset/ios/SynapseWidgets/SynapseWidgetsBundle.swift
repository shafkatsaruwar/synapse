import SwiftUI
import WidgetKit

@main
struct SynapseWidgetsBundle: WidgetBundle {
  var body: some Widget {
    // Widgets 2.0 — primary five (stable kind identifiers reused)
    SynapseMedicationWidget()   // Next Dose
    SynapseOverviewWidget()     // My Day
    SynapseAppointmentWidget()  // Next Appointment
    SynapseSickModeWidget()     // Sick Mode
    SynapseCaregiverWidget()    // Care Circle
    // Legacy kinds — remain registered so installed Home Screen widgets stay valid
    SynapseRecoveryWidget()
    SynapseHydrationWidget()
    SynapsePrnMedicationWidget()
    SynapsePainWidget()
    SynapseSleepWidget()
    SynapseFlareForecastWidget()
    SynapseWellnessWidget()
    SynapseMedicationDayWidget()
    SynapseMentalHealthWidget()
    SynapseLabsWidget()
    SynapseReportWidget()
  }
}
