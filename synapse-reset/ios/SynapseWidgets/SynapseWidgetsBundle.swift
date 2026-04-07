import SwiftUI
import WidgetKit

@main
struct SynapseWidgetsBundle: WidgetBundle {
  var body: some Widget {
    SynapseOverviewWidget()
    SynapseMedicationWidget()
    SynapseAppointmentWidget()
  }
}
