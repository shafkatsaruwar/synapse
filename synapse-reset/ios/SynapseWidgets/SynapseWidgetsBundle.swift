import SwiftUI
import WidgetKit

@main
struct SynapseWidgetsBundle: WidgetBundle {
  var body: some Widget {
    SynapseRecoveryWidget()
    SynapseHydrationWidget()
    SynapsePrnMedicationWidget()
    SynapseMedicationWidget()
    SynapsePainWidget()
    SynapseSickModeWidget()
    SynapseWellnessWidget()
    SynapseMedicationDayWidget()
    SynapseAppointmentWidget()
    SynapseCaregiverWidget()
    SynapseMentalHealthWidget()
    SynapseLabsWidget()
    SynapseReportWidget()
    SynapseOverviewWidget()
  }
}
