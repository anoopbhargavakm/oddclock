import { ClockConfig, mixHex, normalizeHexColor } from './clockEngine';

export function generateAppleWidgetSwift(config: ClockConfig, theme: 'dark' | 'light'): string {
  const isSolar = config.anchorMode === 'solar';
  const baseAccent = normalizeHexColor(config.accentColor, '#06B6D4');
  const darkAccent = mixHex(baseAccent, '#FFFFFF', 0.15).slice(1);
  const lightAccent = mixHex(baseAccent, '#0F172A', 0.18).slice(1);
  const bgHex = theme === 'dark' ? '0x07090E' : '0xF8FAFC';
  const fgHex = theme === 'dark' ? '0xF8FAFC' : '0x0F172A';
  const accentHex = theme === 'dark' ? `0x${darkAccent}` : `0x${lightAccent}`;
  const hourHex = theme === 'dark' ? '0xF59E0B' : '0xD97706';

  return `// OddClockWidget.swift
// Apple WidgetKit Extension (iOS 17+ / macOS 14+)
// Pre-configured for ${config.hoursPerDay}h x ${config.minutesPerHour}m x ${config.secondsPerMinute}s (${isSolar ? 'Solar 24h' : `${config.customTickHz.toFixed(2)} Hz`})

import WidgetKit
import SwiftUI

struct ChronosConfig {
    static let hoursPerDay = ${config.hoursPerDay}
    static let minutesPerHour = ${config.minutesPerHour}
    static let secondsPerMinute = ${config.secondsPerMinute}
    static let solarLocked = ${isSolar ? 'true' : 'false'}
    static let customTickHz = ${config.customTickHz.toFixed(4)}
}

struct AlternateTimeSnapshot {
    let hour: Int
    let minute: Int
    let second: Int
    let dayPhase: Double
    let hourPhase: Double
    let tickHz: Double

    static func compute(at date: Date) -> AlternateTimeSnapshot {
        let cal = Calendar.current
        let startOfDay = cal.startOfDay(for: date)
        let earthSec = date.timeIntervalSince(startOfDay)
        let totalTicks = Double(ChronosConfig.hoursPerDay * ChronosConfig.minutesPerHour * ChronosConfig.secondsPerMinute)

        let altDaySec = ChronosConfig.solarLocked ? 86_400.0 : (totalTicks / ChronosConfig.customTickHz)
        let tickHz = ChronosConfig.solarLocked ? (totalTicks / 86_400.0) : ChronosConfig.customTickHz

        let norm = earthSec.truncatingRemainder(dividingBy: altDaySec)
        let dayPhase = (norm < 0 ? norm + altDaySec : norm) / altDaySec
        let ticksExact = dayPhase * totalTicks
        let ticks = Int(floor(ticksExact))

        let ticksPerHour = ChronosConfig.minutesPerHour * ChronosConfig.secondsPerMinute
        let hour = (ticks / ticksPerHour) % ChronosConfig.hoursPerDay
        let minute = (ticks / ChronosConfig.secondsPerMinute) % ChronosConfig.minutesPerHour
        let second = ticks % ChronosConfig.secondsPerMinute
        let hourPhase = ticksExact.truncatingRemainder(dividingBy: Double(ticksPerHour)) / Double(ticksPerHour)

        return AlternateTimeSnapshot(
            hour: hour,
            minute: minute,
            second: second,
            dayPhase: dayPhase,
            hourPhase: hourPhase,
            tickHz: tickHz
        )
    }

    var formatted: String {
        String(format: "%02d:%02d:%02d", hour, minute, second)
    }
}

struct ChronosEntry: TimelineEntry {
    let date: Date
    let snapshot: AlternateTimeSnapshot
}

struct ChronosProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChronosEntry {
        ChronosEntry(date: Date(), snapshot: .compute(at: Date()))
    }

    func getSnapshot(in context: Context, completion: @escaping (ChronosEntry) -> Void) {
        let now = Date()
        completion(ChronosEntry(date: now, snapshot: .compute(at: now)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ChronosEntry>) -> Void) {
        let now = Date()
        let stepSec = max(1.0, 1.0 / ChronosConfig.customTickHz)
        var entries: [ChronosEntry] = []
        for i in 0..<60 {
            let entryDate = now.addingTimeInterval(Double(i) * stepSec)
            entries.append(ChronosEntry(date: entryDate, snapshot: .compute(at: entryDate)))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct ChronosWidgetView: View {
    @Environment(\\.widgetFamily) var family
    var entry: ChronosEntry

    private let bg = Color(rgb: ${bgHex})
    private let fg = Color(rgb: ${fgHex})
    private let cyan = Color(rgb: ${accentHex})
    private let amber = Color(rgb: ${hourHex})

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(fg.opacity(0.12), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: entry.snapshot.dayPhase)
                    .stroke(amber, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Circle()
                    .trim(from: 0, to: entry.snapshot.hourPhase)
                    .stroke(cyan, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                    .padding(9)
                    .rotationEffect(.degrees(-90))
                Text(String(format: "%02d", entry.snapshot.hour))
                    .font(.system(.headline, design: .monospaced).weight(.semibold))
                    .foregroundStyle(amber)
            }
            .frame(width: family == .systemSmall ? 64 : 88, height: family == .systemSmall ? 64 : 88)

            if family != .systemSmall {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ODDCLOCK")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(fg.opacity(0.55))
                    Text(entry.snapshot.formatted)
                        .font(.system(.title2, design: .monospaced).weight(.bold))
                        .foregroundStyle(fg)
                    Text("\\(ChronosConfig.hoursPerDay)h · \\(ChronosConfig.minutesPerHour)m · \\(String(format: "%.3f Hz", entry.snapshot.tickHz))")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(cyan)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(14)
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(fg.opacity(0.18), lineWidth: 1)
                .padding(2)
        )
        .containerBackground(for: .widget) {
            ZStack {
                Rectangle().fill(.ultraThinMaterial)
                bg.opacity(0.38)
            }
        }
    }
}

extension Color {
    init(rgb: UInt32) {
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255.0,
            green: Double((rgb >> 8) & 0xFF) / 255.0,
            blue: Double(rgb & 0xFF) / 255.0
        )
    }
}

@main
struct OddClockWidget: Widget {
    let kind = "OddClockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChronosProvider()) { entry in
            ChronosWidgetView(entry: entry)
        }
        .configurationDisplayName("OddClock Alternate Clock")
        .description("Live alternate day-division and beat frequency dial.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
`;
}

export function generateAndroidGlanceKotlin(config: ClockConfig, theme: 'dark' | 'light'): string {
  const isSolar = config.anchorMode === 'solar';
  const baseAccent = normalizeHexColor(config.accentColor, '#06B6D4');
  const darkAccent = mixHex(baseAccent, '#FFFFFF', 0.22).slice(1);
  const lightAccent = mixHex(baseAccent, '#0F172A', 0.18).slice(1);
  const bgHex = theme === 'dark' ? '0xFF07090E' : '0xFFF8FAFC';
  const cardHex = theme === 'dark' ? '0xFF0B0F17' : '0xFFFFFFFF';
  const fgHex = theme === 'dark' ? '0xFFF8FAFC' : '0xFF0F172A';
  const cyanHex = theme === 'dark' ? `0xFF${darkAccent}` : `0xFF${lightAccent}`;
  const amberHex = theme === 'dark' ? '0xFFFBBF24' : '0xFFD97706';

  return `// OddClockWidget.kt
// Android Jetpack Glance AppWidget (androidx.glance:glance-appwidget:1.1.0+)
// Pre-configured for ${config.hoursPerDay}h x ${config.minutesPerHour}m x ${config.secondsPerMinute}s (${isSolar ? 'Solar 24h' : `${config.customTickHz.toFixed(2)} Hz`})

package com.oddclock.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import java.util.Calendar
import kotlin.math.floor

object ChronosSpec {
    const val HOURS_PER_DAY = ${config.hoursPerDay}
    const val MINUTES_PER_HOUR = ${config.minutesPerHour}
    const val SECONDS_PER_MINUTE = ${config.secondsPerMinute}
    const val SOLAR_LOCKED = ${isSolar ? 'true' : 'false'}
    const val CUSTOM_TICK_HZ = ${config.customTickHz.toFixed(4)}
}

data class AltClockState(
    val formatted: String,
    val tickHz: Double,
    val dayProgressPct: Int
)

fun computeAlternateClockNow(): AltClockState {
    val cal = Calendar.getInstance()
    val earthSec = cal.get(Calendar.HOUR_OF_DAY) * 3600.0 +
        cal.get(Calendar.MINUTE) * 60.0 +
        cal.get(Calendar.SECOND) +
        cal.get(Calendar.MILLISECOND) / 1000.0

    val totalTicks = (ChronosSpec.HOURS_PER_DAY * ChronosSpec.MINUTES_PER_HOUR * ChronosSpec.SECONDS_PER_MINUTE).toDouble()
    val altDaySec = if (ChronosSpec.SOLAR_LOCKED) 86_400.0 else totalTicks / ChronosSpec.CUSTOM_TICK_HZ
    val tickHz = if (ChronosSpec.SOLAR_LOCKED) totalTicks / 86_400.0 else ChronosSpec.CUSTOM_TICK_HZ

    val norm = ((earthSec % altDaySec) + altDaySec) % altDaySec
    val dayPhase = norm / altDaySec
    val ticks = floor(dayPhase * totalTicks).toLong()

    val ticksPerHour = (ChronosSpec.MINUTES_PER_HOUR * ChronosSpec.SECONDS_PER_MINUTE).toLong()
    val h = ((ticks / ticksPerHour) % ChronosSpec.HOURS_PER_DAY).toInt()
    val m = ((ticks / ChronosSpec.SECONDS_PER_MINUTE) % ChronosSpec.MINUTES_PER_HOUR).toInt()
    val s = (ticks % ChronosSpec.SECONDS_PER_MINUTE).toInt()

    return AltClockState(
        formatted = "%02d:%02d:%02d".format(h, m, s),
        tickHz = tickHz,
        dayProgressPct = (dayPhase * 100).toInt()
    )
}

class OddClockWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val state = computeAlternateClockNow()
        provideContent {
            ChronosWidgetContent(state)
        }
    }

    @Composable
    private fun ChronosWidgetContent(state: AltClockState) {
        val bg = Color(${bgHex})
        val card = Color(${cardHex})
        val fg = Color(${fgHex})
        val cyan = Color(${cyanHex})
        val amber = Color(${amberHex})

        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(bg.copy(alpha = 0.68f))
                .cornerRadius(24.dp)
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "OddClock",
                    style = TextStyle(color = ColorProvider(fg.copy(alpha = 0.8f)), fontSize = 11.sp)
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Text(
                    text = "\${state.dayProgressPct}% day",
                    style = TextStyle(color = ColorProvider(amber), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                )
            }

            Spacer(modifier = GlanceModifier.height(6.dp))

            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(card.copy(alpha = 0.52f))
                    .cornerRadius(16.dp)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                Column {
                    Text(
                        text = state.formatted,
                        style = TextStyle(
                            color = ColorProvider(fg),
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    )
                    Spacer(modifier = GlanceModifier.height(2.dp))
                    Text(
                        text = "\${ChronosSpec.HOURS_PER_DAY}h · \${ChronosSpec.MINUTES_PER_HOUR}m · %.3f Hz".format(state.tickHz),
                        style = TextStyle(
                            color = ColorProvider(cyan),
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    )
                }
            }
        }
    }
}

class OddClockWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = OddClockWidget()
}
`;
}

export function generateAndroidWidgetXml(): string {
  return `<!-- res/xml/oddclock_widget_info.xml -->
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:targetCellWidth="3"
    android:targetCellHeight="2"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:updatePeriodMillis="1800000"
    android:description="@string/chronosynth_widget_description" />
`;
}

export interface GeneratedProjectFile {
  path: string;
  content: string;
}

export function generateAndroidProjectFiles(
  config: ClockConfig,
  theme: 'dark' | 'light'
): GeneratedProjectFile[] {
  const bgHex = theme === 'dark' ? '0xFF07090E' : '0xFFF1F5F9';
  const cardHex = theme === 'dark' ? '0xFF0B0F17' : '0xFFFFFFFF';
  const fgHex = theme === 'dark' ? '0xFFF8FAFC' : '0xFF0F172A';
  const cyanHex = theme === 'dark' ? '0xFF22D3EE' : '0xFF0891B2';
  const amberHex = theme === 'dark' ? '0xFFFBBF24' : '0xFFD97706';

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "OddClock"
include(":app")
`;

  const rootBuildGradle = `plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;

  const gradleWrapperProps = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

  const appBuildGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.oddclock.widget"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.oddclock.widget"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.compose.ui:ui:1.6.8")
    implementation("androidx.compose.material3:material3:1.2.1")
    implementation("androidx.glance:glance-appwidget:1.1.0")
    implementation("androidx.glance:glance-material3:1.1.0")
}
`;

  const androidManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_oddclock"
        android:label="@string/app_name"
        android:roundIcon="@drawable/ic_oddclock"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoTitleBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <receiver
            android:name=".OddClockWidgetReceiver"
            android:exported="true"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/oddclock_widget_info" />
        </receiver>
    </application>
</manifest>
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">OddClock</string>
    <string name="chronosynth_widget_description">Alternate day-division and harmonic frequency glass clock widget.</string>
</resources>
`;

  const iconDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#07090E"
        android:pathData="M24,0h60a24,24 0 0 1 24,24v60a24,24 0 0 1 -24,24h-60a24,24 0 0 1 -24,-24v-60a24,24 0 0 1 24,-24z" />
    <path
        android:strokeColor="#22D3EE"
        android:strokeWidth="4.5"
        android:fillColor="#00000000"
        android:pathData="M54,22a32,32 0 1,0 0,64a32,32 0 1,0 0,-64" />
    <path
        android:strokeColor="#F59E0B"
        android:strokeWidth="5"
        android:strokeLineCap="round"
        android:fillColor="#00000000"
        android:pathData="M54,32a22,22 0 1,1 -15.5,37.5" />
    <path
        android:strokeColor="#22D3EE"
        android:strokeWidth="4"
        android:strokeLineCap="round"
        android:pathData="M54,54L68,38" />
    <path
        android:fillColor="#FBBF24"
        android:pathData="M54,50a4,4 0 1,0 0,8a4,4 0 1,0 0,-8" />
</vector>
`;

  const mainActivityKt = `package com.oddclock.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var state by remember { mutableStateOf(computeAlternateClockNow()) }
            var statusMessage by remember { mutableStateOf<String?>(null) }

            LaunchedEffect(Unit) {
                while (true) {
                    state = computeAlternateClockNow()
                    delay(100L)
                }
            }

            val bg = Color(${bgHex})
            val card = Color(${cardHex})
            val fg = Color(${fgHex})
            val cyan = Color(${cyanHex})
            val amber = Color(${amberHex})

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(bg, card, bg)
                        )
                    )
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(card.copy(alpha = 0.72f), RoundedCornerShape(28.dp))
                        .border(1.dp, fg.copy(alpha = 0.16f), RoundedCornerShape(28.dp))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "OddClock",
                            color = fg,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "\${state.dayProgressPct}% day",
                            color = amber,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Text(
                        text = state.formatted,
                        color = fg,
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )

                    Text(
                        text = "\${ChronosSpec.HOURS_PER_DAY}h · \${ChronosSpec.MINUTES_PER_HOUR}m · \${ChronosSpec.SECONDS_PER_MINUTE}s · %.3f Hz".format(state.tickHz),
                        color = cyan,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Button(
                        onClick = {
                            val manager = AppWidgetManager.getInstance(this@MainActivity)
                            if (manager.isRequestPinAppWidgetSupported) {
                                val provider = ComponentName(
                                    this@MainActivity,
                                    OddClockWidgetReceiver::class.java
                                )
                                val requested = manager.requestPinAppWidget(provider, null, null)
                                if (!requested) {
                                    statusMessage = "Long-press your home screen -> Widgets -> OddClock"
                                }
                            } else {
                                statusMessage = "Long-press your home screen -> Widgets -> OddClock"
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = cyan,
                            contentColor = Color.White
                        )
                    ) {
                        Text(
                            text = "Pin Widget to Home Screen",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    statusMessage?.let { msg ->
                        Text(
                            text = msg,
                            color = fg.copy(alpha = 0.72f),
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}
`;

  const githubWorkflowYml = `name: Build OddClock Android APK

on:
  workflow_dispatch:
  push:
    branches: [ main, master ]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'

      - name: Build Debug APK
        run: gradle assembleDebug --no-daemon

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: OddClock-Widget-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const readmeMd = `# OddClock Android Home-Screen Widget

Pre-configured for **${config.hoursPerDay}h × ${config.minutesPerHour}m × ${config.secondsPerMinute}s** (${config.anchorMode === 'solar' ? 'Solar 24h' : `${config.customTickHz.toFixed(2)} Hz`}).

## Option A: Build the APK in the Cloud (No Android Studio Needed)
1. Unzip this folder and upload all files to a new GitHub repository.
2. Open the **Actions** tab on GitHub and click **Build OddClock Android APK** → **Run workflow**.
3. Once finished (about 2 minutes), download the **OddClock-Widget-APK** artifact (\`app-debug.apk\`) and install it on your Android phone.
4. Open the **OddClock** app and tap **Pin Widget to Home Screen** (or long-press your home screen → **Widgets** → **OddClock**).

## Option B: Build Locally in Android Studio
1. Open this unzipped folder in **Android Studio**.
2. Wait for Gradle sync to finish, then select **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or **Run** directly on your connected phone).
`;

  return [
    { path: 'README.md', content: readmeMd },
    { path: 'settings.gradle.kts', content: settingsGradle },
    { path: 'build.gradle.kts', content: rootBuildGradle },
    { path: 'gradle.properties', content: gradleProperties },
    { path: 'gradle/wrapper/gradle-wrapper.properties', content: gradleWrapperProps },
    { path: 'app/build.gradle.kts', content: appBuildGradle },
    { path: 'app/src/main/AndroidManifest.xml', content: androidManifest },
    { path: 'app/src/main/java/com/oddclock/widget/OddClockWidget.kt', content: generateAndroidGlanceKotlin(config, theme) },
    { path: 'app/src/main/java/com/oddclock/widget/MainActivity.kt', content: mainActivityKt },
    { path: 'app/src/main/res/values/strings.xml', content: stringsXml },
    { path: 'app/src/main/res/drawable/ic_oddclock.xml', content: iconDrawableXml },
    { path: 'app/src/main/res/xml/oddclock_widget_info.xml', content: generateAndroidWidgetXml() },
    { path: '.github/workflows/build-apk.yml', content: githubWorkflowYml },
  ];
}

