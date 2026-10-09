# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# --- Alerta Ciudadana: release minimizado/ofuscado (R8) ---
# Capacitor y sus plugins se registran por reflexión y anotaciones.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public <methods>; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class co.alertaciudadana.app.** { *; }
# Firebase Messaging (push)
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.**
# Puente JavaScript del WebView
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-renamesourcefileattribute SourceFile
