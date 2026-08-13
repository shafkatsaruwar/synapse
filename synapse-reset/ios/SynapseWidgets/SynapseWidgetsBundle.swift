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
    SynapseSleepWidget()
    SynapseSickModeWidget()
    SynapseFlareForecastWidget()
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
