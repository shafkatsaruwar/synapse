import AppKit
import Foundation
import PDFKit

struct BulletSection {
  let title: String
  let bullets: [String]
}

struct Theme {
  let page = NSColor(calibratedRed: 0.992, green: 0.945, blue: 0.898, alpha: 1.0)
  let ink = NSColor(calibratedRed: 0.129, green: 0.102, blue: 0.086, alpha: 1.0)
  let muted = NSColor(calibratedRed: 0.365, green: 0.286, blue: 0.247, alpha: 1.0)
  let accent = NSColor(calibratedRed: 0.502, green: 0.0, blue: 0.125, alpha: 1.0)
  let border = NSColor(calibratedRed: 0.839, green: 0.741, blue: 0.675, alpha: 1.0)
  let card = NSColor(calibratedRed: 1.0, green: 0.979, blue: 0.956, alpha: 1.0)
}

let theme = Theme()
let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
let margin: CGFloat = 34
let gutter: CGFloat = 16
let leftColWidth: CGFloat = 268
let rightColWidth: CGFloat = pageRect.width - (margin * 2) - gutter - leftColWidth

let title = "Synapse App Summary"
let subtitle = "Repo-based one-page brief for the active mobile app in synapse-reset/"

let whatItIs = "Synapse is an Expo/React Native health tracking app for logging daily health, medications, symptoms, appointments, reports, and privacy-first exports. The active product lives in synapse-reset/, while the repo root still contains an older app variant."

let whoItsFor = "Primary persona: people managing chronic illness or complex day-to-day health routines, including users who want fasting/Ramadan support."

let features = BulletSection(
  title: "What It Does",
  bullets: [
    "Tracks daily logs for energy, mood, sleep, fasting, and notes.",
    "Manages medications with multi-dose schedules, reminders, adherence logs, and sick-day stress dosing.",
    "Records symptoms, vitals, monthly check-ins, eating entries, and comfort items.",
    "Handles appointments, doctor info, pharmacies, and doctor notes-style context.",
    "Generates reports, privacy exports, and an emergency card from saved health data.",
    "Supports sick mode, mental health day flows, onboarding, walkthroughs, and accessibility settings.",
    "Offers AI document analysis, medication comparison, and health insights through backend API routes."
  ]
)

let architecture = BulletSection(
  title: "How It Works",
  bullets: [
    "App shell: expo-router entrypoints in synapse-reset/app/ wrap the app with QueryClientProvider, ThemeProvider, AuthProvider, SafeAreaProvider, and notification setup.",
    "Navigation: synapse-reset/app/(tabs)/index.tsx keeps one active screen in state and renders SidebarLayout or TabletSidebar plus screen components from synapse-reset/screens/.",
    "Local data: most health entities are defined in synapse-reset/lib/storage.ts and stored in AsyncStorage; SidebarLayout notes the app is treated as fully local.",
    "Device services: notification-manager schedules reminders, expo-local-authentication powers BiometricGate, and sharing/speech/view-shot support exports and read-aloud flows.",
    "Network services: synapse-reset/lib/api.ts calls /api routes for analyze-document, health-insights, compare-medications, and send-email; server/routes.ts forwards AI work to OpenAI and email to Resend.",
    "Cloud config: supabase.ts plus backup/doctors/appointments helpers show optional Supabase-backed config, backup, and appointment sync paths."
  ]
)

let gettingStarted = BulletSection(
  title: "How To Run",
  bullets: [
    "cd synapse-reset",
    "npm install",
    "Optional for Supabase-backed sign-in/features: copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    "Run npm start for Expo, npm run ios for iOS, or npm run web for browser testing."
  ]
)

let repoNotes = BulletSection(
  title: "Repo Notes",
  bullets: [
    "Source of truth for the current mobile product: synapse-reset/.",
    "Legacy root Expo app still exists in parallel.",
    "Primary user count and production traffic: Not found in repo."
  ]
)

func paragraphStyle(lineHeight: CGFloat) -> NSMutableParagraphStyle {
  let style = NSMutableParagraphStyle()
  style.minimumLineHeight = lineHeight
  style.maximumLineHeight = lineHeight
  return style
}

func textAttributes(fontSize: CGFloat, weight: NSFont.Weight = .regular, color: NSColor, lineHeight: CGFloat? = nil) -> [NSAttributedString.Key: Any] {
  var attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: fontSize, weight: weight),
    .foregroundColor: color
  ]
  if let lineHeight {
    attrs[.paragraphStyle] = paragraphStyle(lineHeight: lineHeight)
  }
  return attrs
}

func drawWrappedText(_ text: String, rect: CGRect, attrs: [NSAttributedString.Key: Any]) -> CGFloat {
  let attributed = NSAttributedString(string: text, attributes: attrs)
  let box = attributed.boundingRect(with: CGSize(width: rect.width, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading])
  let height = ceil(box.height)
  let drawRect = CGRect(x: rect.minX, y: pageRect.height - rect.minY - height, width: rect.width, height: height)
  attributed.draw(with: drawRect, options: [.usesLineFragmentOrigin, .usesFontLeading])
  return height
}

func drawSection(_ section: BulletSection, x: CGFloat, y: inout CGFloat, width: CGFloat) {
  let titleAttrs = textAttributes(fontSize: 12, weight: .semibold, color: theme.accent, lineHeight: 15)
  let bulletAttrs = textAttributes(fontSize: 9.6, weight: .regular, color: theme.ink, lineHeight: 12.8)
  let bulletLeadAttrs = textAttributes(fontSize: 11, weight: .bold, color: theme.accent)

  let titleHeight = drawWrappedText(section.title.uppercased(), rect: CGRect(x: x, y: y, width: width, height: 40), attrs: titleAttrs)
  y += titleHeight + 6

  for bullet in section.bullets {
    let bulletX = x + 12
    let bulletY = y + 0.8
    _ = drawWrappedText("•", rect: CGRect(x: x, y: bulletY - 2, width: 12, height: 20), attrs: bulletLeadAttrs)
    let h = drawWrappedText(bullet, rect: CGRect(x: bulletX, y: y, width: width - 12, height: 80), attrs: bulletAttrs)
    y += h + 5
  }
}

func drawCard(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) {
  let path = NSBezierPath(roundedRect: CGRect(x: x, y: y, width: width, height: height), xRadius: 16, yRadius: 16)
  theme.card.setFill()
  path.fill()
  theme.border.setStroke()
  path.lineWidth = 1
  path.stroke()
}

let pdf = NSMutableData()
guard let consumer = CGDataConsumer(data: pdf as CFMutableData) else {
  fputs("Failed to create PDF consumer\n", stderr)
  exit(1)
}

var mediaBox = pageRect
guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
  fputs("Failed to create PDF context\n", stderr)
  exit(1)
}

context.beginPDFPage(nil)
let graphics = NSGraphicsContext(cgContext: context, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphics

theme.page.setFill()
pageRect.fill()

drawCard(x: margin, y: margin, width: pageRect.width - margin * 2, height: pageRect.height - margin * 2)

let titleAttrs = textAttributes(fontSize: 23, weight: .bold, color: theme.ink, lineHeight: 26)
let subtitleAttrs = textAttributes(fontSize: 10.5, weight: .regular, color: theme.muted, lineHeight: 14)
let labelAttrs = textAttributes(fontSize: 12, weight: .semibold, color: theme.accent, lineHeight: 15)
let bodyAttrs = textAttributes(fontSize: 10.1, weight: .regular, color: theme.ink, lineHeight: 14)

var leftY: CGFloat = margin + 28
var rightY: CGFloat = margin + 28
let leftX = margin + 22
let rightX = margin + 22 + leftColWidth + gutter

let titleHeight = drawWrappedText(title, rect: CGRect(x: leftX, y: leftY, width: pageRect.width - (margin + 22) * 2, height: 50), attrs: titleAttrs)
leftY += titleHeight + 4
let subtitleHeight = drawWrappedText(subtitle, rect: CGRect(x: leftX, y: leftY, width: pageRect.width - (margin + 22) * 2, height: 32), attrs: subtitleAttrs)
leftY += subtitleHeight + 16
rightY = leftY

let whatLabelHeight = drawWrappedText("WHAT IT IS", rect: CGRect(x: leftX, y: leftY, width: leftColWidth, height: 20), attrs: labelAttrs)
leftY += whatLabelHeight + 6
leftY += drawWrappedText(whatItIs, rect: CGRect(x: leftX, y: leftY, width: leftColWidth, height: 100), attrs: bodyAttrs) + 14

let whoLabelHeight = drawWrappedText("WHO IT'S FOR", rect: CGRect(x: leftX, y: leftY, width: leftColWidth, height: 20), attrs: labelAttrs)
leftY += whoLabelHeight + 6
leftY += drawWrappedText(whoItsFor, rect: CGRect(x: leftX, y: leftY, width: leftColWidth, height: 80), attrs: bodyAttrs) + 16

drawSection(features, x: leftX, y: &leftY, width: leftColWidth)

drawSection(architecture, x: rightX, y: &rightY, width: rightColWidth)
rightY += 8
drawSection(gettingStarted, x: rightX, y: &rightY, width: rightColWidth)
rightY += 8
drawSection(repoNotes, x: rightX, y: &rightY, width: rightColWidth)

let footerAttrs = textAttributes(fontSize: 8.0, weight: .regular, color: theme.muted, lineHeight: 10)
_ = drawWrappedText(
  "Evidence sources: README.md, replit.md, synapse-reset/app/, screens/, lib/, package.json, ENV.md, server/routes.ts, server/index.ts.",
  rect: CGRect(x: leftX, y: pageRect.height - margin - 26, width: pageRect.width - (margin + 22) * 2, height: 24),
  attrs: footerAttrs
)

NSGraphicsContext.restoreGraphicsState()
context.endPDFPage()
context.closePDF()

let outputPath = "/Users/mohammed/Developer/Synapse/output/pdf/synapse-app-summary.pdf"
if !FileManager.default.createFile(atPath: outputPath, contents: pdf as Data) {
  fputs("Failed to write PDF file\n", stderr)
  exit(1)
}

let previewPath = "/Users/mohammed/Developer/Synapse/tmp/pdfs/synapse-app-summary-preview.png"
if let pdfDocument = PDFDocument(url: URL(fileURLWithPath: outputPath)),
   let page = pdfDocument.page(at: 0) {
  let targetSize = CGSize(width: pageRect.width * 2, height: pageRect.height * 2)
  let image = page.thumbnail(of: targetSize, for: .mediaBox)
  if let tiff = image.tiffRepresentation,
     let rep = NSBitmapImageRep(data: tiff),
     let png = rep.representation(using: .png, properties: [:]) {
    try? png.write(to: URL(fileURLWithPath: previewPath))
  }
}

print(outputPath)
